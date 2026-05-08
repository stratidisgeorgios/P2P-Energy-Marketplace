import React, { useState, useEffect } from 'react'
import BlockchainService from '../services/ContractService'
import { useWeb3Context } from '../context/Web3Context'
import { useAuthContext } from '../context/AuthContext'
import { useRefresh } from '../context/RefreshContext'

interface CreateOfferModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

/**
 * Create Offer Modal - Blockchain Version
 * Creates energy offers directly on the smart contract
 */
export const CreateOfferModal: React.FC<CreateOfferModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { account, provider } = useWeb3Context()
  const { isAuthenticated } = useAuthContext()
  const { triggerRefresh } = useRefresh()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [tokenBalance, setTokenBalance] = useState('0')
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [userRole, setUserRole] = useState<'PRODUCER' | 'CONSUMER' | null>(null)
  const [isLoadingRole, setIsLoadingRole] = useState(false)
  const [formData, setFormData] = useState({
    quantity: '',
    pricePerUnit: '',
    energySource: 'SOLAR',
  })

  // Fetch token balance and user role when modal opens
  useEffect(() => {
    if (!isOpen || !account || !provider) {
      return
    }

    const fetchBalanceAndRole = async () => {
      setIsLoadingBalance(true)
      setIsLoadingRole(true)
      try {
        await BlockchainService.setProvider(provider)
        
        // First check if user is registered
        const isUserActive = await BlockchainService.isUserActive(account)
        console.log(`👤 User active: ${isUserActive}`)
        
        if (!isUserActive) {
          setError('❌ You must register first! Go to Home page and register as Producer or Consumer.')
          setUserRole(null)
          setIsLoadingRole(false)
          setIsLoadingBalance(false)
          return
        }
        
        // Fetch user role
        const isProducer = await BlockchainService.isProducer(account)
        const isConsumer = await BlockchainService.isConsumer(account)
        
        if (isProducer) {
          setUserRole('PRODUCER')
          console.log(`👤 User role: PRODUCER`)
        } else if (isConsumer) {
          setUserRole('CONSUMER')
          console.log(`👤 User role: CONSUMER`)
        } else {
          setError('❌ Registration incomplete. Please register first.')
          setUserRole(null)
          setIsLoadingRole(false)
          setIsLoadingBalance(false)
          return
        }
        
        // Fetch token balance (only relevant for producers)
        if (isProducer) {
          const balance = await BlockchainService.getTokenBalance(account)
          setTokenBalance(balance)
          console.log(`📊 Producer token balance: ${balance}`)
        } else {
          setTokenBalance('0')
        }
      } catch (error) {
        console.error('Failed to fetch balance/role:', error)
        setTokenBalance('0')
      } finally {
        setIsLoadingBalance(false)
        setIsLoadingRole(false)
      }
    }

    fetchBalanceAndRole()
  }, [isOpen, account, provider])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!formData.quantity || !formData.pricePerUnit) {
      setError('Please fill in all required fields')
      return
    }

    if (!isAuthenticated || !account || !provider) {
      setError('Please connect and authenticate your wallet first')
      return
    }

    if (!userRole) {
      setError('❌ You must be registered first! Please go back and register as Producer or Consumer on the Home page.')
      return
    }

    const quantity = parseFloat(formData.quantity)
    
    // Producer-specific validation: must have available tokens
    if (userRole === 'PRODUCER') {
      const availableBalance = parseFloat(tokenBalance)
      if (quantity > availableBalance) {
        setError(`You only have ${availableBalance} NRG tokens. You can't offer more than you have.`)
        return
      }
    }
    
    // Consumer validation: no token requirement
    if (quantity <= 0) {
      setError('Quantity must be greater than 0')
      return
    }

    try {
      setIsLoading(true)
      const pricePerUnit = parseFloat(formData.pricePerUnit)

      console.log('🔗 Creating offer on blockchain...')
      console.log(`   Quantity: ${quantity} NRG`)
      console.log(`   Price: $${pricePerUnit} per unit`)

      // Calculate total in USD first
      const totalUsd = quantity * pricePerUnit
      console.log(`   Total (USD): $${totalUsd}`)

      // For blockchain:
      // - energyAmount: regular number (contract multiplies by pricePerUnit)
      // - pricePerUnit: convert to small wei (100x multiplier, so 0.01 USD = 1 wei)
      const quantityStr = quantity.toString()
      const priceWei = BlockchainService.toPriceWei(pricePerUnit.toString())

      console.log(`   Quantity (regular): ${quantityStr}`)
      console.log(`   Price (wei): ${priceWei}`)
      console.log(`   Expected Total (wei): ${BlockchainService.toWei(totalUsd.toString())}`)

      // Initialize blockchain service with current provider
      await BlockchainService.setProvider(provider)
      
      // Determine offer type based on user role
      // 0 = SELL (producers), 1 = BUY (consumers)
      const offerType = userRole === 'PRODUCER' ? 0 : 1

      // Calculate total price in wei for escrow (for BUY offers)
      const totalPriceWei = (BigInt(quantityStr) * BigInt(priceWei)).toString()

      // Call blockchain to create offer with offerType parameter
      const txHash = await BlockchainService.createOffer(offerType, quantityStr, priceWei, totalPriceWei)

      console.log(`✅ Offer created! Tx: ${txHash}`)
      const offerTypeStr = offerType === 0 ? 'SELL' : 'BUY'
      alert(`✅ ${offerTypeStr} offer created successfully!\n\nTransaction: ${txHash}\n\nYour offer will appear in the marketplace in a moment.`)

      resetForm()
      setError('')
      
      // Trigger balance refresh
      triggerRefresh()
      
      // Wait a moment then reload
      await new Promise(resolve => setTimeout(resolve, 1500))
      onSuccess()
      onClose()
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to create offer'
      console.error('❌ Error creating offer:', errorMsg)
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      quantity: '',
      pricePerUnit: '',
      energySource: 'SOLAR',
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="bg-green-600 text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
          <h2 className="text-2xl font-bold">
            {isLoadingRole ? '⏳ Loading...' : userRole === 'PRODUCER' ? '🌱 Sell Energy Offer' : '⚡ Buy Energy Offer'}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-green-700 rounded p-1 transition"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Wallet Status */}
          <div className="p-3 bg-blue-50 rounded border border-blue-200">
            <p className="text-sm font-medium text-blue-800">
              {isAuthenticated && account ? (
                <>✓ Authenticated: <span className="font-mono text-xs">{account.substring(0, 10)}...</span></>
              ) : (
                '⚠️ Please authenticate with your wallet to create an offer'
              )}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 rounded border border-red-200">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          {/* Token Balance Info - Producer Only */}
          {userRole === 'PRODUCER' && (
            <div className="p-4 bg-purple-50 rounded border border-purple-200">
              <p className="text-sm font-medium text-purple-900">
                💰 Available Tokens: <span className="text-lg font-bold">{isLoadingBalance ? '⏳ Loading...' : tokenBalance} NRG</span>
              </p>
              <p className="text-xs text-purple-700 mt-1">You can only offer tokens you own. Mint more using "💰 Get Test NRG" in the header.</p>
            </div>
          )}

          {/* BUY Offer Info - Consumer Only */}
          {userRole === 'CONSUMER' && formData.quantity && formData.pricePerUnit && (
            <div className="p-4 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm font-medium text-blue-900">
                💳 Escrow Amount: <span className="text-lg font-bold">{(parseFloat(formData.quantity) * parseFloat(formData.pricePerUnit)).toFixed(2)} USD</span>
              </p>
              <p className="text-xs text-blue-700 mt-1">
                ⚠️ This amount will be deposited to escrow when you create the offer. It will be released to the producer once delivery is confirmed.
              </p>
            </div>
          )}

          {/* Quantity */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold text-gray-700">
                {userRole === 'PRODUCER' ? '📊 Tokens to Sell (NRG) *' : '📊 Energy Amount Needed (NRG) *'}
              </label>
              {userRole === 'PRODUCER' && tokenBalance !== '0' && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, quantity: tokenBalance }))}
                  className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition"
                  disabled={isLoading || isLoadingBalance}
                >
                  Max
                </button>
              )}
            </div>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleInputChange}
              placeholder="e.g., 100"
              step="0.001"
              min="0.001"
              max={userRole === 'PRODUCER' ? tokenBalance : undefined}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-lg font-semibold"
              required
              disabled={isLoading || isLoadingBalance}
            />
            <p className="text-xs text-gray-500 mt-1">
              {userRole === 'PRODUCER' 
                ? parseFloat(tokenBalance) === 0 
                  ? '⚠️ You have no tokens. Mint some first using "💰 Get Test NRG"' 
                  : `Maximum: ${tokenBalance} NRG (your available balance)`
                : 'Tell buyers how much energy you\'d like to purchase'}
            </p>
          </div>

          {/* Price per Unit */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">💰 Price (USD per unit) *</label>
            <input
              type="number"
              name="pricePerUnit"
              value={formData.pricePerUnit}
              onChange={handleInputChange}
              placeholder="e.g., 0.25"
              step="0.01"
              min="0.01"
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-lg font-semibold"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">Price in USD (e.g., 0.25 = 25 cents per NRG)</p>
          </div>

          {/* Energy Source - Producer Only */}
          {userRole === 'PRODUCER' && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">🌱 Energy Source</label>
              <select
                name="energySource"
                value={formData.energySource}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={isLoading}
              >
                <option value="SOLAR">☀️ Solar</option>
                <option value="WIND">💨 Wind</option>
                <option value="HYDRO">💧 Hydro</option>
                <option value="GEOTHERMAL">🌍 Geothermal</option>
                <option value="BIOMASS">🌱 Biomass</option>
              </select>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !isAuthenticated}
            className="w-full px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="animate-spin">⏳</span>
                Creating...
              </>
            ) : (
              <>
                <span>⚡</span>
                Create Offer on Blockchain
              </>
            )}
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  )
}
