/**
 * Consumer Smart Meter Service
 *
 * Simulates consumer smart meters responding to energy trades.
 * Listens for OfferAccepted events on EnergyMarketplace and publishes
 * simulated energy delivery readings to MQTT so the oracle can settle trades.
 *
 * Flow:
 *   1. Trade accepted (OfferAccepted event)
 *   2. This service detects it and publishes a meter reading to MQTT
 *   3. Oracle picks up the reading and calls confirmDelivery + settleTrade
 *
 * Setup: Set RPC_URL, VITE_USER_REGISTRY_ADDRESS, VITE_MARKETPLACE_ADDRESS in .env
 * Run: npm run meter:consumer
 */

const mqtt = require('mqtt');
const dotenv = require('dotenv');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const RPC_URL = process.env.RPC_URL;
const USER_REGISTRY_ADDRESS = process.env.VITE_USER_REGISTRY_ADDRESS;
const MARKETPLACE_ADDRESS = process.env.VITE_MARKETPLACE_ADDRESS;

// Simulated delivery delay in ms (represents physical energy transfer time)
const DELIVERY_DELAY_MS = parseInt(process.env.DELIVERY_DELAY_MS || '10000');

if (!RPC_URL) {
  console.error('❌ ERROR: RPC_URL not set in environment');
  process.exit(1);
}

if (!USER_REGISTRY_ADDRESS) {
  console.error('❌ ERROR: VITE_USER_REGISTRY_ADDRESS not set in environment');
  process.exit(1);
}

if (!MARKETPLACE_ADDRESS) {
  console.error('❌ ERROR: VITE_MARKETPLACE_ADDRESS not set in environment');
  process.exit(1);
}

const mqttClient = mqtt.connect(MQTT_BROKER_URL, {
  clientId: 'consumer-meter-' + Math.random().toString(16).substr(2, 8),
  clean: true,
  reconnectPeriod: 5000,
});

let provider;
let userRegistry;
let marketplace;

async function initializeBlockchain() {
  try {
    console.log(`🔗 Connecting to blockchain...`);
    console.log(`   RPC: ${RPC_URL.substring(0, 50)}...`);

    provider = new ethers.JsonRpcProvider(RPC_URL);

    const network = await provider.getNetwork();
    console.log(`   Network: ${network.name} (chainId: ${network.chainId})`);

    const registryPath = path.join(__dirname, '../artifacts/contracts/UserRegistry.sol/UserRegistry.json');
    const registryData = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    userRegistry = new ethers.Contract(USER_REGISTRY_ADDRESS, registryData.abi, provider);

    const marketplacePath = path.join(__dirname, '../artifacts/contracts/EnergyMarketplace.sol/EnergyMarketplace.json');
    const marketplaceData = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));
    marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, marketplaceData.abi, provider);

    console.log(`\n📋 UserRegistry: ${USER_REGISTRY_ADDRESS}`);
    console.log(`📋 EnergyMarketplace: ${MARKETPLACE_ADDRESS}`);
    console.log('✅ Blockchain connection established\n');
  } catch (error) {
    console.error('❌ Failed to initialize blockchain:', error.message);
    process.exit(1);
  }
}

/**
 * Publish a simulated meter reading to MQTT for a consumer.
 * The oracle subscribes to meters/consumer_{address}/energy and expects
 * a JSON payload with a `currentReading` field (kWh as string/number).
 */
async function publishMeterReading(tradeId, consumer, energyAmountKwh) {
  try {
    // Get the consumer's on-chain meter to retrieve the canonical meterId
    const meter = await userRegistry.consumerMeters(consumer);
    if (!meter.owner || meter.owner === ethers.ZeroAddress) {
      console.warn(`⚠️  No meter found for consumer ${consumer.substring(0, 10)}...`);
      return;
    }

    const meterId = meter.meterId; // e.g. consumer_0xabc...
    const topic = `meters/${meterId}/energy`;

    const payload = JSON.stringify({
      tradeId,          // used by oracle to look up the exact trade — prevents cross-trade collisions
      meterId,
      owner: consumer,
      energyReceived: energyAmountKwh,
      currentReading: energyAmountKwh.toString(),
      timestamp: Math.floor(Date.now() / 1000),
      blockchainTimestamp: Math.floor(Date.now() / 1000),
    });

    mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error(`❌ Failed to publish to ${topic}:`, err);
      } else {
        console.log(`📤 Published meter reading: ${topic}`);
        console.log(`   Consumer: ${consumer.substring(0, 10)}...`);
        console.log(`   Energy delivered: ${energyAmountKwh} kWh`);
      }
    });
  } catch (error) {
    console.error('❌ Error publishing meter reading:', error.message);
  }
}

/**
 * Handle a new trade — simulate energy delivery after a delay.
 */
async function handleNewTrade(tradeId, consumer, energyAmountKwh) {
  console.log(`\n⚡ Trade #${tradeId} accepted:`);
  console.log(`   Consumer: ${consumer.substring(0, 10)}...`);
  console.log(`   Energy: ${energyAmountKwh} kWh`);
  console.log(`   Simulating delivery in ${DELIVERY_DELAY_MS / 1000}s...`);

  await new Promise(resolve => setTimeout(resolve, DELIVERY_DELAY_MS));

  console.log(`\n🔋 [Trade #${tradeId}] Delivery complete — publishing meter reading`);
  await publishMeterReading(tradeId, consumer, energyAmountKwh);
}

/**
 * On startup, find all pending (unconfirmed, unsettled) trades and
 * immediately publish meter readings for them. This handles trades that
 * were accepted while the service was offline (e.g. Trade #4).
 */
async function publishReadingsForPendingTrades() {
  try {
    const nextTradeId = await marketplace.nextTradeId();
    const total = Number(nextTradeId);
    console.log(`📊 Scanning for pending trades (total: ${total})...`);

    let found = 0;
    for (let i = 1; i < total; i++) {
      try {
        const trade = await marketplace.trades(i);
        if (trade.tradeId !== 0n && !trade.deliveryConfirmed && !trade.settled) {
          const consumer = trade.consumer;
          const energyAmountKwh = Number(trade.energyAmount);
          console.log(`  📍 Pending Trade #${i}: Consumer ${consumer.substring(0, 10)}... — ${energyAmountKwh} kWh`);
          found++;
          // Publish immediately (no delay for backlog recovery)
          await publishMeterReading(i, consumer, energyAmountKwh);
        }
      } catch {
        continue;
      }
    }

    if (found === 0) {
      console.log('   No pending trades found.');
    } else {
      console.log(`✅ Published readings for ${found} pending trade(s)\n`);
    }
  } catch (error) {
    console.error('⚠️  Could not scan pending trades:', error.message);
  }
}

/**
 * Listen for OfferAccepted events on EnergyMarketplace.
 * When a new trade is created, simulate energy delivery and publish a meter reading.
 */
async function listenForNewTrades() {
  console.log('👂 Listening for new trades (OfferAccepted events)...\n');

  // event OfferAccepted(uint256 indexed offerId, uint256 indexed tradeId, uint256 indexed certificateId, address consumer)
  marketplace.on('OfferAccepted', async (_offerId, tradeId, _certificateId, consumer) => {
    try {
      const trade = await marketplace.trades(tradeId);
      const energyAmountKwh = Number(trade.energyAmount);
      await handleNewTrade(Number(tradeId), consumer, energyAmountKwh);
    } catch (error) {
      console.error(`❌ Error handling OfferAccepted for trade #${tradeId}:`, error.message);
    }
  });

  console.log('   ✅ OfferAccepted listener active\n');
}

mqttClient.on('connect', async () => {
  console.log('✅ Consumer Meter Service connected to MQTT broker');
  console.log(`📡 Broker: ${MQTT_BROKER_URL}`);
  console.log(`⏱️  Delivery simulation delay: ${DELIVERY_DELAY_MS / 1000}s\n`);

  await initializeBlockchain();

  // Recover any trades that were stuck before this service started
  await publishReadingsForPendingTrades();

  // Watch for future trades
  await listenForNewTrades();
});

mqttClient.on('error', (error) => {
  console.error('❌ MQTT Connection Error:', error);
  process.exit(1);
});

mqttClient.on('offline', () => {
  console.warn('⚠️  MQTT Broker offline');
});

mqttClient.on('reconnect', () => {
  console.log('🔄 Attempting to reconnect to MQTT broker...');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Consumer Meter Service...');
  mqttClient.end(false, () => {
    console.log('✅ Disconnected from MQTT broker');
    process.exit(0);
  });
});

console.log('🚀 Consumer Smart Meter Service starting...\n');
