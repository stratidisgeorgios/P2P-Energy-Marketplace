/// <reference types="vite/client" />
import { BrowserProvider, Contract, ethers } from 'ethers'

// Minimal ABIs for contract interaction (NO EVENTS - they cause warnings and don't work with signers)
// Minimal ABIs for contract interaction (NO EVENTS - they cause warnings and don't work with signers)
const CONTRACTS: { [key: string]: string[] } = {
  UserRegistry: [
    'function registerUser(string _name, string _role)',
    'function deregisterUser()',
    'function isUserActive(address user) public view returns (bool)',
    'function isProducer(address user) public view returns (bool)',
    'function isConsumer(address user) public view returns (bool)',
    'function getUser(address user) public view returns (tuple(address wallet, string name, uint256 registrationTime, bool isProducer, bool isConsumer, bool isActive, string metadata))',
  ],
  EnergyToken: [
    'function balanceOf(address account) public view returns (uint256)',
    'function transfer(address to, uint256 amount) public returns (bool)',
    'function approve(address spender, uint256 amount) public returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) public returns (bool)',
    'function mint(address to, uint256 amount) public',
    'function burn(uint256 amount) public',
    'function mintEnergy(address _to, uint256 _amount) public',
  ],
  EnergyMarketplace: [
    'function mintTestEnergy(uint256 amount) public',
    'function createOffer(uint8 offerType, uint256 energyAmount, uint256 pricePerUnit) public',
    'function acceptOffer(uint256 offerId) public payable',
    'function cancelOffer(uint256 offerId) public',
    'function confirmDelivery(uint256 tradeId) public',
    'function settleTrade(uint256 tradeId) public',
    'function offers(uint256 offerId) public view returns (tuple(uint256 offerId, address creator, uint8 offerType, uint256 energyAmount, uint256 pricePerUnit, uint256 totalPrice, uint8 status, uint256 createdAt, uint256 expiresAt, address counterparty))',
    'function trades(uint256 tradeId) public view returns (tuple(uint256 tradeId, uint256 offerId, address producer, address consumer, uint256 energyAmount, uint256 totalPrice, uint256 createdAt, uint256 certificateId, bool deliveryConfirmed, bool settled))',
    'function consumerTrades(address consumer) public view returns (uint256[])',
    'function reservedTokens(address producer) public view returns (uint256)',
    'function nextOfferId() public view returns (uint256)',
    'function nextTradeId() public view returns (uint256)',
  ],
  EscrowSettlement: [
    'function depositFunds(uint256 tradeId) public payable',
    'function releaseFunds(uint256 tradeId) public',
    'function refundFunds(uint256 tradeId) public',
    'function escrows(uint256 tradeId) public view returns (tuple(uint256 amount, address payer, bool released, bool refunded))',
  ],
  RenewableEnergyCertificate: [
    'function issueCertificate(address _producer, uint8 _source, uint256 _energyAmount, string calldata _metadata) public returns (uint256)',
    'function transferCertificate(uint256 certificateId, address to) public',
    'function retireCertificate(uint256 certificateId) public',
    'function certificates(uint256) public view returns (uint256, address, uint8, uint256, uint256, uint256, string, bool, uint256)',
    'function producerCertificates(address producer) public view returns (uint256[])',
    'function balanceOf(address owner) public view returns (uint256)',
  ],
}

// Get contract addresses from environment
const getContractAddresses = (): { [key: string]: string } => ({
  UserRegistry: import.meta.env.VITE_USER_REGISTRY_ADDRESS || '',
  EnergyToken: import.meta.env.VITE_ENERGY_TOKEN_ADDRESS || '',
  EnergyMarketplace: import.meta.env.VITE_MARKETPLACE_ADDRESS || '',
  EscrowSettlement: import.meta.env.VITE_ESCROW_ADDRESS || '',
  RenewableEnergyCertificate: import.meta.env.VITE_CERTIFICATE_ADDRESS || '',
})

/**
 * BlockchainService - Handles all direct smart contract interactions
 * This replaces the backend API entirely
 */
class BlockchainService {
  private contracts: { [key: string]: Contract } = {}
  private addresses = getContractAddresses()
  private provider: BrowserProvider | null = null

  /**
   * Initialize provider and contracts
   */
  async setProvider(provider: BrowserProvider) {
    this.provider = provider
    
    // Create contract instances with signer for transactions
    const signer = await provider.getSigner()
    
    const contractNames = Object.keys(CONTRACTS)
    for (const name of contractNames) {
      const address = this.addresses[name]
      const abi = CONTRACTS[name]
      if (address && abi) {
        this.contracts[name] = new Contract(address, abi, signer)
        console.log(`📋 ${name}: ${address}`)
      }
    }

    console.log('✅ Blockchain service initialized')
  }

  /**
   * ===== USER REGISTRY FUNCTIONS =====
   */

  async registerUser(username: string, role: 'PRODUCER' | 'CONSUMER' | 'BOTH'): Promise<string> {
    if (!this.contracts.UserRegistry) throw new Error('UserRegistry contract not initialized')
    
    try {
      console.log(`🔗 Registering user: ${username} as ${role}...`)
      console.log(`📞 Calling UserRegistry.registerUser("${username}", "${role}")`)
      
      const tx = await this.contracts.UserRegistry.registerUser(username, role)
      console.log(`📝 Tx sent: ${tx.hash}`)
      
      const receipt = await tx.wait()
      console.log(`✅ User registered: ${tx.hash}`)
      console.log(`📄 Receipt:`, receipt)
      return tx.hash
    } catch (error: any) {
      console.error('❌ Registration failed:')
      console.error('  Error message:', error.message)
      console.error('  Error data:', error.data)
      console.error('  Full error:', error)
      throw new Error(`Registration failed: ${error.message}`)
    }
  }

  async deregisterUser(): Promise<string> {
    if (!this.contracts.UserRegistry) throw new Error('UserRegistry contract not initialized')
    
    try {
      console.log(`🔗 Deregistering user...`)
      console.log(`📞 Calling UserRegistry.deregisterUser()`)
      
      const tx = await this.contracts.UserRegistry.deregisterUser()
      console.log(`📝 Tx sent: ${tx.hash}`)
      
      const receipt = await tx.wait()
      console.log(`✅ User deregistered: ${tx.hash}`)
      console.log(`📄 Receipt:`, receipt)
      return tx.hash
    } catch (error: any) {
      console.error('❌ Deregistration failed:')
      console.error('  Error message:', error.message)
      console.error('  Error data:', error.data)
      console.error('  Full error:', error)
      throw new Error(`Deregistration failed: ${error.message}`)
    }
  }

  async isUserActive(address: string): Promise<boolean> {
    if (!this.contracts.UserRegistry) throw new Error('UserRegistry contract not initialized')
    try {
      return await this.contracts.UserRegistry.isUserActive(address)
    } catch (error: any) {
      console.error('Failed to check if user is active:', error.message)
      return false
    }
  }

  async isProducer(address: string): Promise<boolean> {
    if (!this.contracts.UserRegistry) throw new Error('UserRegistry contract not initialized')
    try {
      return await this.contracts.UserRegistry.isProducer(address)
    } catch (error: any) {
      console.error('Failed to check if user is producer:', error.message)
      return false
    }
  }

  async isConsumer(address: string): Promise<boolean> {
    if (!this.contracts.UserRegistry) throw new Error('UserRegistry contract not initialized')
    try {
      return await this.contracts.UserRegistry.isConsumer(address)
    } catch (error: any) {
      console.error('Failed to check if user is consumer:', error.message)
      return false
    }
  }

  /**
   * ===== TEST/DEMO FUNCTIONS =====
   */

  async mintTestEnergy(amount: string): Promise<string> {
    if (!this.contracts.EnergyMarketplace) throw new Error('Marketplace contract not initialized')
    
    try {
      console.log(`💰 Minting ${amount} test energy tokens...`)
      const tx = await this.contracts.EnergyMarketplace.mintTestEnergy(amount)
      console.log(`📝 Tx sent: ${tx.hash}`)
      
      await tx.wait()
      console.log(`✅ Test energy minted: ${tx.hash}`)
      return tx.hash
    } catch (error: any) {
      console.error('❌ Mint test energy failed:', error.message)
      throw new Error(`Mint test energy failed: ${error.message}`)
    }
  }

  /**
   * ===== ENERGY MARKETPLACE FUNCTIONS =====
   */

  async createOffer(offerType: number, energyAmount: string, pricePerUnit: string, totalPrice?: string): Promise<string> {
    if (!this.contracts.EnergyMarketplace) throw new Error('Marketplace contract not initialized')
    
    try {
      const offerTypeStr = offerType === 0 ? 'SELL' : 'BUY'
      const total = totalPrice || (BigInt(energyAmount) * BigInt(pricePerUnit)).toString()
      
      // Log the offer type and amounts
      if (offerType === 1) {
        console.log(`🔗 Creating BUY offer: ${energyAmount} kWh @ ${pricePerUnit} wei/unit (depositing ${total} wei to escrow)`)
      } else {
        console.log(`🔗 Creating SELL offer: ${energyAmount} kWh @ ${pricePerUnit} wei/unit`)
      }
      
      // For BUY offers, log additional debug info
      if (offerType === 1) {
        console.log(`📋 BUY Offer Debug:`)
        console.log(`   - energyAmount parameter: ${energyAmount}`)
        console.log(`   - pricePerUnit parameter: ${pricePerUnit}`)
        console.log(`   - totalPrice calculation: ${energyAmount} * ${pricePerUnit} = ${total} wei`)
        console.log(`   - msg.value being sent: ${total} wei`)
      }
      
      // Convert parameters to BigInt for ethers.js v6 contract calls
      const energyAmountBN = BigInt(energyAmount)
      const pricePerUnitBN = BigInt(pricePerUnit)
      const totalValueBN = BigInt(total)
      
      console.log(`📤 Calling contract with: offerType=${offerType}, energyAmount=${energyAmountBN}, pricePerUnit=${pricePerUnitBN}`)
      
      // Call contract with proper BigInt parameters
      let tx
      if (offerType === 1) {
        // BUY offer: send value for escrow
        console.log(`📤 Sending BUY transaction with value=${totalValueBN.toString()} wei`)
        tx = await this.contracts.EnergyMarketplace.createOffer(offerType, energyAmountBN, pricePerUnitBN, { value: totalValueBN })
      } else {
        // SELL offer: no value
        tx = await this.contracts.EnergyMarketplace.createOffer(offerType, energyAmountBN, pricePerUnitBN)
      }
      console.log(`📝 Tx sent: ${tx.hash}`)
      
      await tx.wait()
      console.log(`✅ ${offerTypeStr} offer created: ${tx.hash}`)
      return tx.hash
    } catch (error: any) {
      console.error('❌ Offer creation failed:', error.message)
      console.error('❌ Full error:', error)
      throw new Error(`Offer creation failed: ${error.message}`)
    }
  }

  async acceptOffer(offerId: string | number, offerType: number, totalPrice: string): Promise<string> {
    if (!this.contracts.EnergyMarketplace) throw new Error('Marketplace contract not initialized')
    
    try {
      const offerTypeStr = offerType === 0 ? 'SELL' : 'BUY'
      const txOptions: any = {}
      
      // SELL offers: consumer pays when accepting the offer
      if (offerType === 0) {
        txOptions.value = totalPrice
        console.log(`🔗 Accepting ${offerTypeStr} offer ${offerId} for ${totalPrice} wei`)
      } else {
        // BUY offers: no payment needed (funds already in escrow)
        console.log(`🔗 Accepting ${offerTypeStr} offer ${offerId} (funds already in escrow)`)
      }
      
      const tx = await this.contracts.EnergyMarketplace.acceptOffer(offerId, txOptions)
      console.log(`📝 Tx sent: ${tx.hash}`)
      
      await tx.wait()
      console.log(`✅ ${offerTypeStr} offer accepted: ${tx.hash}`)
      return tx.hash
    } catch (error: any) {
      console.error('❌ Accept offer failed:', error.message)
      throw new Error(`Accept offer failed: ${error.message}`)
    }
  }

  async cancelOffer(offerId: string | number): Promise<string> {
    if (!this.contracts.EnergyMarketplace) throw new Error('Marketplace contract not initialized')
    
    try {
      console.log(`🔗 Cancelling offer ${offerId}...`)
      const tx = await this.contracts.EnergyMarketplace.cancelOffer(offerId)
      console.log(`📝 Tx sent: ${tx.hash}`)
      
      await tx.wait()
      console.log(`✅ Offer cancelled: ${tx.hash}`)
      return tx.hash
    } catch (error: any) {
      console.error('❌ Cancel offer failed:', error.message)
      throw new Error(`Cancel offer failed: ${error.message}`)
    }
  }

  async getOffer(offerId: string | number) {
    if (!this.contracts.EnergyMarketplace) throw new Error('Marketplace contract not initialized')
    try {
      const offer = await this.contracts.EnergyMarketplace.offers(offerId)
      console.log(`🔍 Got offer ${offerId}:`, { offerId: offer.offerId, producer: offer.producer, status: Number(offer.status) })
      return offer
    } catch (error: any) {
      console.error(`❌ Failed to get offer ${offerId}:`, error.message)
      return null
    }
  }

  async getTrade(tradeId: string | number) {
    if (!this.contracts.EnergyMarketplace) throw new Error('Marketplace contract not initialized')
    try {
      const trade = await this.contracts.EnergyMarketplace.trades(tradeId)
      return trade
    } catch (error) {
      // Silently return null - expected when trade doesn't exist
      return null
    }
  }



  async getAllUserTrades(userAddress: string): Promise<number[]> {
    if (!this.contracts.EnergyMarketplace) throw new Error('Marketplace contract not initialized')
    try {
      const allTrades = new Set<number>()
      
      // Instead of using consumerTrades mapping (which may not be accessible),
      // iterate through ALL trades and check if user is producer OR consumer
      const nextTradeId = await this.getNextTradeId()
      console.log(`📊 Total trades in contract: ${nextTradeId}`)
      
      let consumerTradeCount = 0
      let producerTradeCount = 0
      let checkedCount = 0
      const normalizedUserAddress = userAddress.toLowerCase()
      
      for (let i = 1; i < nextTradeId; i++) {
        try {
          checkedCount++
          const trade = await this.getTrade(i)
          
          if (!trade) {
            console.log(`⚠️  Trade ${i}: No trade data returned`)
            continue
          }
          
          // Check if user is CONSUMER
          if (trade.consumer.toLowerCase() === normalizedUserAddress) {
            console.log(`✅ Found CONSUMER trade ${i}: consumer=${trade.consumer}, producer=${trade.producer}`)
            allTrades.add(i)
            consumerTradeCount++
          }
          // Check if user is PRODUCER
          else if (trade.producer.toLowerCase() === normalizedUserAddress) {
            console.log(`✅ Found PRODUCER trade ${i}: producer=${trade.producer}, consumer=${trade.consumer}`)
            allTrades.add(i)
            producerTradeCount++
          }
        } catch (e: any) {
          // Silently skip if trade doesn't exist
          console.log(`⚠️  Trade ${i}: Error - ${e.message?.substring(0, 50)}`)
          continue
        }
      }
      
      console.log(`📊 Checked ${checkedCount} trades`)
      console.log(`📊 Consumer trades found: ${consumerTradeCount}`)
      console.log(`📊 Producer trades found: ${producerTradeCount}`)
      const result = Array.from(allTrades).sort((a, b) => a - b)
      console.log(`📊 Total trades for user: ${result.length}`, result)
      return result
    } catch (error: any) {
      console.error('Failed to get all user trades:', error.message)
      return []
    }
  }

  async getNextTradeId(): Promise<number> {
    if (!this.contracts.EnergyMarketplace) throw new Error('Marketplace contract not initialized')
    try {
      const id = await this.contracts.EnergyMarketplace.nextTradeId()
      return Number(id)
    } catch (error: any) {
      console.error('Failed to get next trade ID:', error.message)
      return 0
    }
  }

  async debugUserStatus(userAddress: string): Promise<void> {
    if (!this.contracts.UserRegistry) throw new Error('UserRegistry contract not initialized')
    try {
      console.log(`\n=== DEBUG: User Status for ${userAddress} ===`)
      
      const isActive = await this.contracts.UserRegistry.isUserActive(userAddress)
      console.log(`✅ isUserActive: ${isActive}`)
      
      const isProducer = await this.contracts.UserRegistry.isProducer(userAddress)
      console.log(`✅ isProducer: ${isProducer}`)
      
      const isConsumer = await this.contracts.UserRegistry.isConsumer(userAddress)
      console.log(`✅ isConsumer: ${isConsumer}`)
      
      if (!isActive) {
        console.error(`❌ User not active!`)
      }
      if (!isConsumer) {
        console.error(`❌ User is not a CONSUMER! Cannot create BUY offers.`)
      }
      
      console.log(`=== END DEBUG ===\n`)
    } catch (error: any) {
      console.error('Debug failed:', error.message)
    }
  }

  async debugBuyOfferCreation(energyAmount: string, pricePerUnit: string, userAddress: string): Promise<void> {
    if (!this.contracts.EnergyMarketplace || !this.contracts.UserRegistry) {
      throw new Error('Contracts not initialized')
    }
    
    try {
      const totalPrice = (BigInt(energyAmount) * BigInt(pricePerUnit)).toString()
      
      console.log(`\n=== PRE-CHECK: BUY Offer Creation ===`)
      console.log(`User: ${userAddress}`)
      console.log(`Energy Amount: ${energyAmount}`)
      console.log(`Price Per Unit: ${pricePerUnit}`)
      console.log(`Total Price: ${totalPrice}`)
      
      // Check 1: Energy amount > 0
      const energyAmountBN = BigInt(energyAmount)
      if (energyAmountBN <= 0n) {
        console.error(`❌ FAIL: Energy amount must be > 0`)
        return
      }
      console.log(`✅ CHECK 1: Energy amount > 0`)
      
      // Check 2: Price per unit > 0
      const pricePerUnitBN = BigInt(pricePerUnit)
      if (pricePerUnitBN <= 0n) {
        console.error(`❌ FAIL: Price per unit must be > 0`)
        return
      }
      console.log(`✅ CHECK 2: Price per unit > 0`)
      
      // Check 3: User is active
      const isActive = await this.contracts.UserRegistry.isUserActive(userAddress)
      console.log(`✅ CHECK 3: User is active = ${isActive}`)
      if (!isActive) {
        console.error(`❌ FAIL: User not active`)
        return
      }
      
      // Check 4: User is consumer
      const isConsumer = await this.contracts.UserRegistry.isConsumer(userAddress)
      console.log(`✅ CHECK 4: User is consumer = ${isConsumer}`)
      if (!isConsumer) {
        console.error(`❌ FAIL: User is not a consumer`)
        return
      }
      
      // Check 5: Try to estimate gas (this will catch contract logic errors)
      console.log(`\n📊 Attempting to estimate gas for createOffer...`)
      try {
        const gasEstimate = await this.contracts.EnergyMarketplace.createOffer.estimateGas(
          1, // offerType = BUY
          energyAmountBN,
          pricePerUnitBN,
          { value: BigInt(totalPrice), from: userAddress }
        )
        console.log(`✅ CHECK 5: Gas estimation succeeded = ${gasEstimate.toString()}`)
      } catch (gasError: any) {
        console.error(`❌ FAIL: Gas estimation failed:`, gasError.message)
        console.error(`Full error:`, gasError)
        return
      }
      
      console.log(`\n✅ ALL CHECKS PASSED - Ready to create BUY offer`)
      console.log(`=== END PRE-CHECK ===\n`)
    } catch (error: any) {
      console.error('Pre-check failed:', error.message)
    }
  }





  async getNextOfferId(): Promise<number> {
    if (!this.contracts.EnergyMarketplace) throw new Error('Marketplace contract not initialized')
    try {
      const id = await this.contracts.EnergyMarketplace.nextOfferId()
      const nextId = Number(id)
      console.log(`📊 Next offer ID will be: ${nextId}`)
      return nextId
    } catch (error: any) {
      console.error('❌ Failed to get next offer ID:', error.message)
      return 0
    }
  }

  /**
   * ===== ENERGY TOKEN FUNCTIONS =====
   */

  async getTokenBalance(address: string): Promise<string> {
    if (!this.contracts.EnergyToken) throw new Error('Energy Token contract not initialized')
    try {
      const balance = await this.contracts.EnergyToken.balanceOf(address)
      const balanceWei = BigInt(balance.toString())
      // Convert from wei (10^18) to readable format (1 token = 10^18 wei)
      const readable = Number(balanceWei / BigInt(10 ** 18))
      return readable.toString()
    } catch (error: any) {
      console.error('Failed to get token balance:', error.message)
      return '0'
    }
  }

  async getReservedTokens(address: string): Promise<string> {
    if (!this.contracts.EnergyMarketplace) throw new Error('Marketplace contract not initialized')
    try {
      const reserved = await this.contracts.EnergyMarketplace.reservedTokens(address)
      const reservedWei = BigInt(reserved.toString())
      // Convert from wei (10^18) to readable format
      const readable = Number(reservedWei / BigInt(10 ** 18))
      return readable.toString()
    } catch (error: any) {
      console.error('Failed to get reserved tokens:', error.message)
      return '0'
    }
  }



  /**
   * ===== RENEWABLE ENERGY CERTIFICATE FUNCTIONS =====
   */



  async getCertificate(certificateId: string | number): Promise<any> {
    if (!this.contracts.RenewableEnergyCertificate) throw new Error('Certificate contract not initialized')
    try {
      console.log(`🔍 Getting certificate ${certificateId}...`)
      const result = await this.contracts.RenewableEnergyCertificate.certificates(certificateId)
      
      // Result is now an array: [certId, producer, source, amount, issuedAt, expiresAt, metadata, isValid, linkedTradeId]
      if (!result || !result[0]) {
        console.warn(`⚠️ Certificate ${certificateId} not found`)
        return null
      }
      
      return {
        id: Number(result[0]),
        producer: result[1],
        energySource: Number(result[2] || 0),
        amount: Number(result[3]),
        issuedAt: Number(result[4]),
        expiresAt: Number(result[5]),
        metadata: result[6],
        isValid: result[7],
        linkedTradeId: Number(result[8] || 0),
      }
    } catch (error: any) {
      console.error(`❌ Failed to get certificate ${certificateId}:`, error.message)
      return null
    }
  }



  /**
   * ===== UTILITY FUNCTIONS =====
   */

  toWei(amount: string | number): string {
    return ethers.parseEther(amount.toString()).toString()
  }

  fromWei(amount: string): string {
    return ethers.formatEther(amount)
  }

  /**
   * Convert price (USD) to small wei units
   * Instead of 10^18 wei per unit, we use 100 (so 0.01 USD = 1 wei)
   * User enters: 0.01 → we store: 1 wei
   */
  toPriceWei(amount: string | number): string {
    const num = parseFloat(amount.toString())
    // Multiply by 100 to get a small wei value
    // 0.01 * 100 = 1 wei
    // 1.00 * 100 = 100 wei
    return Math.floor(num * 100).toString()
  }

  /**
   * Convert small wei units back to price (USD)
   * Reverse of toPriceWei
   * 1 wei → 0.01 USD
   * 100 wei → 1.00 USD
   */
  fromPriceWei(amount: string | number): string {
    const num = parseFloat(amount.toString())
    return (num / 100).toFixed(2)
  }

  /**
   * ===== ORACLE FUNCTIONS =====
   */

  /**
   * Oracle confirms delivery and transfers energy tokens from producer to consumer
   * @param tradeId Trade ID to confirm
   * @param oraclePrivateKey Oracle's private key for signing
   */
  async oracleConfirmDelivery(tradeId: number | string, oraclePrivateKey: string): Promise<string> {
    if (!this.provider || !this.contracts.EnergyMarketplace) {
      throw new Error('Service not initialized')
    }

    try {
      // First, check the trade state
      const trade = await this.contracts.EnergyMarketplace.trades(tradeId)
      console.log(`📊 Trade ${tradeId} state:`, {
        tradeId: trade.tradeId.toString(),
        producer: trade.producer,
        consumer: trade.consumer,
        energyAmount: trade.energyAmount.toString(),
        deliveryConfirmed: trade.deliveryConfirmed,
        settled: trade.settled,
      })

      // Check producer balance
      const producerBalance = await this.contracts.EnergyToken.balanceOf(trade.producer)
      console.log(`⚡ Producer ${trade.producer} balance: ${producerBalance.toString()} tokens`)

      if (producerBalance < trade.energyAmount) {
        throw new Error(`Insufficient producer balance: ${producerBalance} < ${trade.energyAmount}`)
      }
      
      const oracleWallet = new ethers.Wallet(oraclePrivateKey, this.provider)
      console.log(`🔑 Oracle address from private key: ${oracleWallet.address}`)
      
      const marketplaceAddress = await this.contracts.EnergyMarketplace.getAddress()

      // Create contract instance with oracle signer - use correct ABI
      const oracleContract = new Contract(
        marketplaceAddress,
        ['function confirmDelivery(uint256 _tradeId)'],
        oracleWallet
      )

      console.log(`🔗 Oracle confirming delivery for trade ${tradeId}...`)
      const tx = await oracleContract.confirmDelivery(tradeId)
      console.log(`📝 Tx sent: ${tx.hash}`)

      await tx.wait()
      console.log(`✅ Delivery confirmed: ${tx.hash}`)
      return tx.hash
    } catch (error: any) {
      console.error('❌ Oracle confirm delivery failed:', error.message)
      throw new Error(`Failed to confirm delivery: ${error.message}`)
    }
  }

  /**
   * Oracle settles a trade and releases escrowed funds to producer
   * @param tradeId Trade ID to settle
   * @param oraclePrivateKey Oracle's private key for signing
   */
  async oracleSettleTrade(tradeId: number | string, oraclePrivateKey: string): Promise<string> {
    if (!this.provider || !this.contracts.EnergyMarketplace) {
      throw new Error('Service not initialized')
    }

    try {
      const oracleWallet = new ethers.Wallet(oraclePrivateKey, this.provider)
      const marketplaceAddress = await this.contracts.EnergyMarketplace.getAddress()

      // Create contract instance with oracle signer - use correct ABI
      const oracleContract = new Contract(
        marketplaceAddress,
        ['function settleTrade(uint256 _tradeId)'],
        oracleWallet
      )

      console.log(`🔗 Oracle settling trade ${tradeId}...`)
      const tx = await oracleContract.settleTrade(tradeId)
      console.log(`📝 Tx sent: ${tx.hash}`)

      await tx.wait()
      console.log(`✅ Trade settled: ${tx.hash}`)
      return tx.hash
    } catch (error: any) {
      console.error('❌ Oracle settle trade failed:', error.message)
      throw new Error(`Failed to settle trade: ${error.message}`)
    }
  }

  /**
   * Oracle cancels a trade and refunds consumer
   * @param tradeId Trade ID to cancel
   * @param oraclePrivateKey Oracle's private key for signing
   */
  async oracleCancelTrade(tradeId: number | string, oraclePrivateKey: string): Promise<string> {
    if (!this.provider || !this.contracts.EnergyMarketplace) {
      throw new Error('Service not initialized')
    }

    try {
      const oracleWallet = new ethers.Wallet(oraclePrivateKey, this.provider)
      const marketplaceAddress = await this.contracts.EnergyMarketplace.getAddress()

      // Create contract instance with oracle signer - use correct ABI
      const oracleContract = new Contract(
        marketplaceAddress,
        ['function cancelTrade(uint256 _tradeId)'],
        oracleWallet
      )

      console.log(`🔗 Oracle cancelling trade ${tradeId}...`)
      const tx = await oracleContract.cancelTrade(tradeId)
      console.log(`📝 Tx sent: ${tx.hash}`)

      await tx.wait()
      console.log(`✅ Trade cancelled: ${tx.hash}`)
      return tx.hash
    } catch (error: any) {
      console.error('❌ Oracle cancel trade failed:', error.message)
      throw new Error(`Failed to cancel trade: ${error.message}`)
    }
  }
}

export default new BlockchainService()
