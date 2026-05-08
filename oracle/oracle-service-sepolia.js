/**
 * Oracle Service for Sepolia Testnet
 * 
 * Connects MQTT smart meter readings to real Sepolia blockchain
 * Automatically settles energy trades on production network
 * 
 * Setup:
 * 1. Get RPC endpoint (Infura/Alchemy/public)
 * 2. Get oracle private key (account with ORACLE_ROLE)
 * 3. Update .env.sepolia
 * 4. Run: MQTT_ENV=sepolia npm run oracle:start
 */

const mqtt = require('mqtt');
const dotenv = require('dotenv');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load configuration from .env
dotenv.config({ path: path.join(__dirname, '../.env') });

// Configuration
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const RPC_URL = process.env.RPC_URL;
const ORACLE_PRIVATE_KEY = process.env.PRIVATE_KEY;
const MARKETPLACE_ADDRESS = process.env.VITE_MARKETPLACE_ADDRESS;
const USER_REGISTRY_ADDRESS = process.env.VITE_USER_REGISTRY_ADDRESS;
const NETWORK = process.env.NETWORK || 'sepolia';

// Validate configuration
if (!RPC_URL) {
  console.error('❌ ERROR: RPC_URL not configured');
  process.exit(1);
}

if (!ORACLE_PRIVATE_KEY) {
  console.error('❌ ERROR: PRIVATE_KEY not set in .env');
  process.exit(1);
}

if (!MARKETPLACE_ADDRESS) {
  console.error('❌ ERROR: VITE_MARKETPLACE_ADDRESS not set');
  process.exit(1);
}

if (!USER_REGISTRY_ADDRESS) {
  console.error('❌ ERROR: VITE_USER_REGISTRY_ADDRESS not set');
  process.exit(1);
}

// Track pending trades by tradeId — supports multiple simultaneous trades per consumer
const pendingTradesById = new Map();

// Load UserRegistry ABI
let userRegistryABI;
let userRegistry;

// MQTT Client
const mqttClient = mqtt.connect(MQTT_BROKER_URL, {
  clientId: 'oracle-sepolia-' + Math.random().toString(16).substr(2, 8),
  clean: true,
  reconnectPeriod: 5000,
});

// Blockchain setup
let signer;
let contract;
let provider;

/**
 * Initialize blockchain connection to Sepolia
 */
async function initializeBlockchain() {
  try {
    console.log(`🔗 Connecting to Sepolia testnet...`);
    console.log(`   RPC: ${RPC_URL.substring(0, 50)}...`);

    provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Verify network
    const network = await provider.getNetwork();
    console.log(`   Network: ${network.name} (chainId: ${network.chainId})`);

    if (network.chainId !== 11155111) {
      console.warn(`⚠️  WARNING: Expected chainId 11155111 (Sepolia), got ${network.chainId}`);
    }

    // Create signer from oracle private key
    signer = new ethers.Wallet(ORACLE_PRIVATE_KEY, provider);
    console.log(`\n👤 Oracle Address: ${signer.address}`);

    // Check oracle account has ETH for gas
    const balance = await provider.getBalance(signer.address);
    const balanceEth = ethers.formatEther(balance);
    console.log(`   Balance: ${balanceEth} ETH`);

    if (balance === 0n) {
      console.warn(`\n⚠️  WARNING: Oracle account has 0 ETH`);
      console.warn(`   Need ETH for gas fees to settle trades`);
      console.warn(`   Get testnet ETH from: https://www.sepoliafaucet.com`);
    }

    // Load contract ABI
    const abiPath = path.join(__dirname, '../artifacts/contracts/EnergyMarketplace.sol/EnergyMarketplace.json');
    const artifactData = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    const contractABI = artifactData.abi;

    // Initialize contract instance
    contract = new ethers.Contract(MARKETPLACE_ADDRESS, contractABI, signer);
    
    // Load UserRegistry ABI for meter storage
    const userRegistryPath = path.join(__dirname, '../artifacts/contracts/UserRegistry.sol/UserRegistry.json');
    const userRegistryData = JSON.parse(fs.readFileSync(userRegistryPath, 'utf8'));
    userRegistryABI = userRegistryData.abi;
    
    // Initialize UserRegistry (read-only, not needed for settlement)
    userRegistry = new ethers.Contract(USER_REGISTRY_ADDRESS, userRegistryABI, provider);
    
    console.log(`\n📋 EnergyMarketplace: ${MARKETPLACE_ADDRESS}`);
    console.log(`📋 UserRegistry: ${USER_REGISTRY_ADDRESS}`);
    console.log(`🌐 Network: ${NETWORK}`);
    console.log('✅ Blockchain connection established\n');
    
    // Load pending trades from contract on startup
    await loadPendingTradesFromContract();

  } catch (error) {
    console.error('❌ Failed to initialize blockchain:', error.message);
    if (error.message.includes('Invalid URL')) {
      console.error('   Verify RPC_URL in .env.sepolia is correct');
    }
    process.exit(1);
  }
}

/**
 * Load all pending trades from smart contract into pendingTradesById.
 * Keyed by tradeId so multiple simultaneous trades per consumer are all tracked.
 */
async function loadPendingTradesFromContract() {
  try {
    const nextTradeId = await contract.nextTradeId();
    console.log(`📊 Scanning for pending trades (total: ${nextTradeId.toString()})...`);

    let pendingCount = 0;

    for (let i = 1; i < nextTradeId; i++) {
      try {
        const trade = await contract.trades(i);

        if (trade.tradeId !== 0n && !trade.deliveryConfirmed && !trade.settled) {
          pendingTradesById.set(i, {
            tradeId: i,
            offerId: Number(trade.offerId),
            producer: trade.producer,
            consumer: trade.consumer,
            expectedKwh: Number(trade.energyAmount),
            totalPrice: trade.totalPrice.toString(),
            createdAt: Number(trade.createdAt),
          });

          pendingCount++;
          console.log(`  📍 Trade #${i}: Consumer ${trade.consumer.substring(0, 10)}... expects ${Number(trade.energyAmount)} kWh`);
        }
      } catch (e) {
        continue;
      }
    }

    console.log(`✅ Loaded ${pendingCount} pending trades waiting for consumer meter confirmation\n`);
  } catch (error) {
    console.error('⚠️  Could not load pending trades:', error.message);
  }
}

/**
 * Listen for OfferAccepted events so the oracle tracks new trades in real-time.
 * Without this, trades created after startup are invisible to the oracle.
 */
async function listenForNewTrades() {
  // event OfferAccepted(uint256 indexed offerId, uint256 indexed tradeId, uint256 indexed certificateId, address consumer)
  contract.on('OfferAccepted', async (_offerId, tradeId, _certificateId, consumer) => {
    try {
      const trade = await contract.trades(tradeId);
      if (trade.tradeId !== 0n && !trade.deliveryConfirmed && !trade.settled) {
        const id = Number(tradeId);
        pendingTradesById.set(id, {
          tradeId: id,
          offerId: Number(trade.offerId),
          producer: trade.producer,
          consumer: consumer,
          expectedKwh: Number(trade.energyAmount),
          totalPrice: trade.totalPrice.toString(),
          createdAt: Number(trade.createdAt),
        });
        console.log(`\n📍 New Trade #${id} registered:`);
        console.log(`   Consumer: ${consumer.substring(0, 10)}... expects ${Number(trade.energyAmount)} kWh`);
        console.log(`   Waiting for consumer meter reading...\n`);
      }
    } catch (error) {
      console.error(`❌ Error registering new trade #${tradeId}:`, error.message);
    }
  });

  console.log('📥 Listening for new trades (OfferAccepted events)...');
}

/**
 * MQTT: Connected
 */
mqttClient.on('connect', async () => {
  console.log('✅ Oracle Service connected to MQTT broker');
  console.log(`📡 Broker: ${MQTT_BROKER_URL}`);
  console.log('');

  // Initialize blockchain connection
  await initializeBlockchain();

  // Track new trades in real-time (not just at startup)
  await listenForNewTrades();

  // Subscribe to consumer meter topics - use # wildcard for flexibility
  mqttClient.subscribe('meters/#', { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Failed to subscribe:', err);
    } else {
      console.log('📥 Subscribed to: meters/#');
      console.log('   Listening for consumer meter readings...');
      console.log('⏳ Waiting for meter updates...\n');
    }
  });
});

/**
 * MQTT: Message received
 * Receives consumer meter readings in format: meters/consumer_{address}/energy
 */
mqttClient.on('message', async (topic, message) => {
  // Only process consumer meter topics
  if (!topic.includes('consumer_')) {
    return;
  }
  
  try {
    const reading = JSON.parse(message.toString());

    // tradeId must be present in the payload — set by consumer-meter-service
    const tradeId = reading.tradeId;
    if (!tradeId) {
      console.warn(`⚠️  MQTT message on ${topic} missing tradeId — ignoring`);
      return;
    }

    const trade = pendingTradesById.get(tradeId);
    if (!trade) {
      console.log(`⚠️  No pending trade found for tradeId #${tradeId} — already settled or unknown`);
      return;
    }

    const deliveredKwh = parseFloat(reading.currentReading);
    const minDelivery = trade.expectedKwh * 0.95;

    console.log(`\n📨 [${new Date().toISOString()}] Meter reading for Trade #${tradeId}:`);
    console.log(`   Consumer: ${trade.consumer.substring(0, 10)}...`);
    console.log(`   Delivered: ${deliveredKwh} kWh  |  Required: ${minDelivery.toFixed(2)} kWh`);

    if (deliveredKwh >= minDelivery) {
      console.log(`✅ Delivery confirmed — settling trade #${tradeId}`);

      const balance = await provider.getBalance(signer.address);
      if (balance < ethers.parseEther('0.01')) {
        console.error(`❌ Oracle has insufficient ETH for gas (${ethers.formatEther(balance)} ETH)`);
        return;
      }

      // Remove before async call to prevent a duplicate MQTT message from re-triggering
      pendingTradesById.delete(tradeId);

      await settleTradeOnBlockchain(tradeId, reading);
    } else {
      console.log(`⏳ Delivery below threshold — waiting (${deliveredKwh} < ${minDelivery.toFixed(2)} kWh)`);
    }

    console.log('');

  } catch (error) {
    console.error('❌ Error processing meter reading:', error.message);
    console.log('');
  }
});

/**
 * Settle trade on Sepolia blockchain
 * Step 1: Confirm delivery (transfers tokens)
 * Step 2: Settle trade (releases payment)
 */
async function settleTradeOnBlockchain(tradeId, reading) {
  try {
    console.log(`⛓️  Settling trade #${tradeId} on Sepolia...`);
    console.log(`   Network: ${NETWORK}`);
    
    // Step 1: Confirm Delivery
    console.log(`   1️⃣  Confirming delivery...`);
    const confirmTx = await contract.confirmDelivery(tradeId);
    console.log(`      Tx submitted: ${confirmTx.hash}`);
    
    const confirmReceipt = await confirmTx.wait();
    if (!confirmReceipt) {
      throw new Error('Transaction confirmation failed');
    }
    console.log(`   ✅ Delivery confirmed (block: ${confirmReceipt.blockNumber})`);
    
    // Step 2: Settle Trade (release payment)
    console.log(`   2️⃣  Settling payment...`);
    const settleTx = await contract.settleTrade(tradeId);
    console.log(`      Tx submitted: ${settleTx.hash}`);
    
    const settleReceipt = await settleTx.wait();
    if (!settleReceipt) {
      throw new Error('Transaction confirmation failed');
    }
    console.log(`   ✅ Payment released (block: ${settleReceipt.blockNumber})`);
    
    // Calculate total gas used
    const totalGas = confirmReceipt.gasUsed + settleReceipt.gasUsed;
    const totalCost = (totalGas * confirmReceipt.gasPrice) / 10n ** 18n;
    console.log(`   ⛽ Gas used: ~${formatGas(totalGas)} (~${ethers.formatEther(totalCost * confirmReceipt.gasPrice)} ETH)`);
    
    console.log(`🎉 Trade #${tradeId} fully settled on Sepolia!\n`);
    
  } catch (error) {
    console.error(`❌ Failed to settle trade #${tradeId}:`, error.message);
    
    // Provide helpful error messages
    if (error.message.includes('insufficient funds')) {
      console.error('   Cause: Oracle account has insufficient ETH for gas');
      console.error('   Fix: Get testnet ETH from https://www.sepoliafaucet.com');
    } else if (error.message.includes('transaction failed')) {
      console.error('   Cause: Transaction reverted on blockchain');
      console.error('   Check: Is oracle account ORACLE_ROLE?');
    } else if (error.message.includes('network')) {
      console.error('   Cause: Network connectivity issue');
      console.error('   Check: Is RPC endpoint accessible?');
    }
    
    console.error('   This trade remains pending for manual oracle action\n');
  }
}

/**
 * Format gas amount for display
 */
function formatGas(gas) {
  if (gas > 1000000n) {
    return (gas / 1000000n).toString() + 'M';
  } else if (gas > 1000n) {
    return (gas / 1000n).toString() + 'K';
  }
  return gas.toString();
}

/**
 * MQTT: Connection error
 */
mqttClient.on('error', (error) => {
  console.error('❌ MQTT Connection Error:', error);
  process.exit(1);
});

/**
 * MQTT: Offline
 */
mqttClient.on('offline', () => {
  console.warn('⚠️  MQTT Broker offline');
});

/**
 * MQTT: Reconnecting
 */
mqttClient.on('reconnect', () => {
  console.log('🔄 Attempting to reconnect to MQTT broker...');
});

/**
 * Graceful shutdown
 */
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Oracle Service...');
  mqttClient.end(false, () => {
    console.log('✅ Disconnected from MQTT broker');
    process.exit(0);
  });
});

// Start the service
console.log('🚀 Oracle Service for Sepolia starting...\n');
