import React, { useEffect, useState } from 'react'
import BlockchainService from '../services/ContractService'
import { useWeb3Context } from '../context/Web3Context'
import { useAuthContext } from '../context/AuthContext'
import { useRefresh } from '../context/RefreshContext'
import { CreateOfferModal } from '../components/CreateOfferModal'
import { MintTokenButton } from '../components/MintTokenButton'
import { ethers } from 'ethers'

interface LocalOffer {
  offerId: number
  creator: string
  offerType: number // 0 = SELL, 1 = BUY
  energyAmount: string
  pricePerUnit: string
  totalPrice: string
  status: number
  createdAt: number
  expiresAt: number
  counterparty: string | null
  txHash: string
}

/**
 * Marketplace Page - Blockchain-Only Version
 * All data is read from smart contracts, not a backend server
 */
export const Marketplace: React.FC = () => {
  const { isAuthenticated } = useAuthContext()
  const { provider, account } = useWeb3Context()
  const { triggerRefresh } = useRefresh()
  const [offers, setOffers] = useState<LocalOffer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showCreateOfferModal, setShowCreateOfferModal] = useState(false)
  const [showMyOffersOnly, setShowMyOffersOnly] = useState(false)
  const [userRole, setUserRole] = useState<'PRODUCER' | 'CONSUMER' | null>(null)

  // Initialize blockchain service and load user role + offers
  useEffect(() => {
    if (provider && isAuthenticated && account) {
      const initializeService = async () => {
        await BlockchainService.setProvider(provider)
        
        // Fetch user role
        const isProducer = await BlockchainService.isProducer(account)
        const isConsumer = await BlockchainService.isConsumer(account)
        if (isProducer) {
          setUserRole('PRODUCER')
        } else if (isConsumer) {
          setUserRole('CONSUMER')
        }
        
        await loadAllOffers()
      }
      initializeService()
    }
  }, [provider, isAuthenticated, account])

  // Load all offers from blockchain
  const loadAllOffers = async () => {
    setIsLoading(true)
    try {
      console.log('📖 Loading all offers from blockchain...')
      const allOffers: LocalOffer[] = []
      let consecutiveErrors = 0
      const maxConsecutiveErrors = 5 // If we get 5 in a row, stop looking

      // Try to load offers up to ID 1000, but stop early if we get consecutive errors
      for (let i = 1; i <= 1000 && consecutiveErrors < maxConsecutiveErrors; i++) {
        try {
          const offerData = await BlockchainService.getOffer(i)
          
          if (offerData && offerData.offerId !== 0n) {
            consecutiveErrors = 0 // Reset error count on success
            const offer: LocalOffer = {
              offerId: Number(offerData.offerId),
              creator: offerData.creator,
              offerType: Number(offerData.offerType),
              energyAmount: offerData.energyAmount.toString(),
              pricePerUnit: offerData.pricePerUnit.toString(),
              totalPrice: offerData.totalPrice.toString(),
              status: Number(offerData.status),
              createdAt: Number(offerData.createdAt),
              expiresAt: Number(offerData.expiresAt),
              counterparty: offerData.counterparty === ethers.ZeroAddress ? null : offerData.counterparty,
              txHash: '',
            }
            allOffers.push(offer)
          } else {
            consecutiveErrors++
          }
        } catch (error) {
          consecutiveErrors++
          // Silently continue instead of logging every error
          continue
        }
      }

      console.log(`✅ Loaded ${allOffers.length} offers from blockchain`)
      setOffers(allOffers)
    } catch (error) {
      console.error('Failed to load offers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Accept offer by calling blockchain directly
  const handleAcceptOffer = async (offerId: number) => {
    if (!account || !provider) {
      alert('Please connect your wallet first')
      return
    }

    const offer = offers.find((o) => o.offerId === offerId)
    if (!offer) {
      alert('Offer not found')
      return
    }

    const offerTypeStr = offer.offerType === 0 ? 'SELL' : 'BUY'
    const confirmMsg = offer.offerType === 0 
      ? `Are you sure you want to buy ${offer.energyAmount} NRG for ${(Number(offer.totalPrice) / 1e18).toFixed(4)} ETH?`
      : `Are you sure you want to sell ${offer.energyAmount} NRG for ${(Number(offer.totalPrice) / 1e18).toFixed(4)} ETH?`
    
    const confirmed = window.confirm(confirmMsg)
    if (!confirmed) return

    setIsProcessing(true)
    try {
      console.log(`🚀 Accepting ${offerTypeStr} offer ${offerId}...`)

      // Call blockchain directly
      await BlockchainService.setProvider(provider)
      const txHash = await BlockchainService.acceptOffer(offerId, offer.offerType, offer.totalPrice)

      console.log(`✅ Offer accepted! Tx: ${txHash}`)
      alert(
        `✅ Success! ${offerTypeStr} offer accepted!\n\n📜 Renewable Energy Certificate Issued\n\nYour proof of purchase certificate has been issued. Go to "My Trades" to view it.\n\nTx: ${txHash}`
      )

      // Update local cache
      setOffers((prev) =>
        prev.map((o) =>
          o.offerId === offerId ? { ...o, status: 1, counterparty: account } : o
        )
      )
      
      // Trigger balance refresh
      triggerRefresh()
    } catch (error: any) {
      console.error('❌ Failed to accept offer:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  // Cancel offer by calling blockchain directly
  const handleCancelOffer = async (offerId: number) => {
    if (!account || !provider) {
      alert('Please connect your wallet first')
      return
    }

    const offer = offers.find((o) => o.offerId === offerId)
    if (!offer) {
      alert('Offer not found')
      return
    }

    const offerTypeStr = offer.offerType === 0 ? 'SELL' : 'BUY'
    const confirmMsg = offer.offerType === 0 
      ? `Cancel this SELL offer? You won't be able to sell this ${offer.energyAmount} NRG.`
      : `Cancel this BUY offer? You will get your ${(Number(offer.totalPrice) / 1e18).toFixed(4)} ETH refunded from escrow.`
    
    const confirmed = window.confirm(confirmMsg)
    if (!confirmed) return

    setIsProcessing(true)
    try {
      console.log(`🚀 Cancelling ${offerTypeStr} offer ${offerId}...`)

      // Call blockchain directly
      await BlockchainService.setProvider(provider)
      const txHash = await BlockchainService.cancelOffer(offerId)

      console.log(`✅ Offer cancelled! Tx: ${txHash}`)
      const successMsg = offer.offerType === 0 
        ? `✅ Successfully cancelled SELL offer!\n\nTx: ${txHash}`
        : `✅ Successfully cancelled BUY offer!\n\n💰 Your ${(Number(offer.totalPrice) / 1e18).toFixed(4)} ETH from escrow has been refunded.\n\nTx: ${txHash}`
      alert(successMsg)

      // Update local cache
      setOffers((prev) =>
        prev.map((o) =>
          o.offerId === offerId ? { ...o, status: 2 } : o
        )
      )
      
      // Trigger balance refresh
      triggerRefresh()
    } catch (error: any) {
      console.error('❌ Failed to cancel offer:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  // Get status label
  const getStatusLabel = (status: number) => {
    const statuses = [
      'ACTIVE',
      'ACCEPTED',
      'CANCELLED',
      'COMPLETED',
    ]
    return statuses[status] || 'UNKNOWN'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">⚡ Energy Marketplace</h1>
          {isAuthenticated && (
            <div className="flex gap-3">
              <button
                onClick={() => setShowMyOffersOnly(!showMyOffersOnly)}
                className={`px-4 py-2 font-semibold rounded-lg transition ${
                  showMyOffersOnly
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {showMyOffersOnly ? '📌 My Offers' : '📋 All Offers'}
              </button>
              <MintTokenButton />
              <button
                onClick={() => setShowCreateOfferModal(true)}
                className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
              >
                ⚡ Create Offer
              </button>
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-900">
            💡 <strong>Blockchain-First Marketplace:</strong> All offers are stored on the Sepolia testnet.
            Browse below to see all active energy offers.
          </p>
        </div>

        {/* Offers List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading offers from blockchain...</p>
          </div>
        ) : offers.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded">
            <p className="text-gray-600">No offers available yet.</p>
            <p className="text-gray-500 text-sm mt-2">
              Create the first offer to get started!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {offers
              .filter((offer) => (showMyOffersOnly ? offer.creator.toLowerCase() === account?.toLowerCase() : true))
              .map((offer) => {
                const isOwnOffer = offer.creator.toLowerCase() === account?.toLowerCase()
                const offerTypeLabel = offer.offerType === 0 ? '📤 SELL' : '📥 BUY'
                return (
              <div key={offer.offerId} className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden">
                {/* Header */}
                <div className={`bg-gradient-to-r ${offer.offerType === 0 ? 'from-green-500 to-blue-500' : 'from-blue-500 to-purple-500'} px-6 py-4 text-white`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold">{offerTypeLabel} Offer #{offer.offerId}</h3>
                      <p className="text-opacity-80 text-sm font-mono mt-1">
                        By: {offer.creator.slice(0, 6)}...{offer.creator.slice(-4)}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      getStatusLabel(offer.status) === 'ACTIVE'
                        ? 'bg-green-600 text-white shadow-lg'
                        : getStatusLabel(offer.status) === 'ACCEPTED'
                        ? 'bg-yellow-500 text-white shadow-lg'
                        : 'bg-gray-600 text-white'
                    }`}>
                      {getStatusLabel(offer.status)}
                    </span>
                  </div>
                </div>

                {/* Energy Details */}
                <div className="px-6 py-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {/* Energy Amount */}
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">📊 Energy</p>
                      <p className="text-2xl font-bold text-blue-600 mt-1">
                        {offer.energyAmount}
                      </p>
                      <p className="text-gray-600 text-xs mt-1">NRG</p>
                    </div>

                    {/* Price Per Unit */}
                    <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                      <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">💰 Price/Unit</p>
                      <p className="text-2xl font-bold text-yellow-600 mt-1">
                        ${BlockchainService.fromPriceWei(offer.pricePerUnit)}
                      </p>
                      <p className="text-gray-600 text-xs mt-1">per NRG</p>
                    </div>

                    {/* Total Price */}
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200 col-span-2">
                      <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">💵 Total Price</p>
                      <p className="text-2xl font-bold text-green-600 mt-1">
                        ${BlockchainService.fromPriceWei(Number(offer.energyAmount) * Number(offer.pricePerUnit))}
                      </p>
                    </div>
                  </div>

                  {/* Expiry */}
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">📅 Expires</p>
                    <p className="text-gray-800 font-semibold mt-1">
                      {new Date(offer.expiresAt * 1000).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                {/* Action Button */}
                <div className="px-6 py-4 border-t border-gray-200 space-y-3">
                  {isOwnOffer ? (
                    getStatusLabel(offer.status) === 'ACTIVE' ? (
                      <>
                        {offer.offerType === 1 && (
                          <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                            <p className="text-xs text-blue-900">
                              💰 <strong>Escrow Balance:</strong> {(Number(offer.totalPrice) / 1e18).toFixed(4)} ETH will be refunded if you cancel
                            </p>
                          </div>
                        )}
                        <button
                          onClick={() => handleCancelOffer(offer.offerId)}
                          disabled={isProcessing}
                          className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-lg hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                        >
                          {isProcessing ? '⏳ Processing...' : '🗑️ Cancel Offer'}
                        </button>
                      </>
                    ) : (
                      <div className="text-center py-3 bg-gray-100 rounded-lg">
                        <p className="text-gray-600 text-sm font-medium">
                          Your offer - {getStatusLabel(offer.status)}
                        </p>
                      </div>
                    )
                  ) : getStatusLabel(offer.status) === 'ACTIVE' && offer.counterparty === null ? (
                    // Determine if user can accept this offer
                    (() => {
                      const canAcceptSellOffer = offer.offerType === 0 && userRole === 'CONSUMER'
                      const canAcceptBuyOffer = offer.offerType === 1 && userRole === 'PRODUCER'
                      const canAccept = canAcceptSellOffer || canAcceptBuyOffer
                      
                      if (canAccept) {
                        return (
                          <button
                            onClick={() => handleAcceptOffer(offer.offerId)}
                            disabled={isProcessing}
                            className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                          >
                            {isProcessing ? '⏳ Processing...' : '✅ Accept Offer'}
                          </button>
                        )
                      } else {
                        // Show why user can't accept
                        const reason = offer.offerType === 0 
                          ? 'Only Consumers can accept SELL offers'
                          : 'Only Producers can accept BUY offers'
                        return (
                          <div className="text-center py-3 bg-gray-100 rounded-lg">
                            <p className="text-gray-600 text-sm font-medium">
                              {reason}
                            </p>
                          </div>
                        )
                      }
                    })()
                  ) : (
                    <div className="text-center py-3 bg-gray-100 rounded-lg">
                      <p className="text-gray-600 text-sm font-medium">
                        {getStatusLabel(offer.status) === 'ACCEPTED' ? '✓ Already Accepted' : 'Unavailable'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
              })}
          </div>
        )}
      </div>

      {/* Create Offer Modal */}
      <CreateOfferModal
        isOpen={showCreateOfferModal}
        onClose={() => setShowCreateOfferModal(false)}
        onSuccess={async () => {
          console.log('✅ Offer created successfully')
          // Log next offer ID to see what was created
          await BlockchainService.getNextOfferId()
          // Small delay to ensure contract state is updated
          await new Promise(r => setTimeout(r, 2000))
          loadAllOffers()
        }}
      />
    </div>
  )
}
