import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext'
import { useRefresh } from '../context/RefreshContext'
import BlockchainService from '../services/ContractService'
import { CertificateCard } from '../components/CertificateCard'
import { formatEther } from 'ethers'

interface Trade {
  tradeId: number
  offerId: number
  producer: string
  consumer: string
  energyAmount: number
  totalPrice: string
  createdAt: number
  certificateId: number
  deliveryConfirmed: boolean
  settled: boolean
}

interface Certificate {
  id: number
  owner: string
  energySource: number
  amount: number
  issuedAt: number
  expiresAt: number
  metadata: string
  isValid: boolean
  linkedTradeId: number
}

/**
 * My Trades Page - Shows accepted offers and their status through escrow/oracle
 */
export const MyTrades: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuthContext()
  const { triggerRefresh } = useRefresh()
  const [trades, setTrades] = useState<Trade[]>([])
  const [certificates, setCertificates] = useState<Map<number, Certificate>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/')
      return
    }

    const loadTrades = async () => {
      setLoading(true)
      setError(null)
      try {
        // Get all trades for this user (as consumer OR producer)
        const tradeIds = await BlockchainService.getAllUserTrades(user.wallet)
        console.log(`📊 Found ${tradeIds.length} trades for user ${user.wallet}`)

        const loadedTrades: Trade[] = []
        const certs = new Map<number, Certificate>()

        for (const tradeId of tradeIds) {
          const trade = await BlockchainService.getTrade(tradeId)
          if (trade) {
            const tradeData: Trade = {
              tradeId: Number(trade.tradeId),
              offerId: Number(trade.offerId),
              producer: trade.producer,
              consumer: trade.consumer,
              energyAmount: Number(trade.energyAmount),
              totalPrice: trade.totalPrice.toString(),
              createdAt: Number(trade.createdAt),
              certificateId: Number(trade.certificateId),
              deliveryConfirmed: trade.deliveryConfirmed,
              settled: trade.settled,
            }
            loadedTrades.push(tradeData)

            // Load certificate
            if (tradeData.certificateId > 0) {
              const cert = await BlockchainService.getCertificate(tradeData.certificateId)
              if (cert) {
                certs.set(tradeData.certificateId, cert)
              }
            }
          }
        }

        setTrades(loadedTrades)
        setCertificates(certs)
      } catch (err: any) {
        console.error('Failed to load trades:', err)
        setError(err.message || 'Failed to load trades')
      } finally {
        setLoading(false)
      }
    }

    loadTrades()
  }, [isAuthenticated, user, navigate])



  const getStatusDisplay = (trade: Trade) => {
    if (trade.settled) {
      return {
        status: 'COMPLETED',
        color: 'bg-green-100 border-green-300 text-green-900',
        icon: '✅',
      }
    } else if (trade.deliveryConfirmed) {
      return {
        status: 'AWAITING SETTLEMENT',
        color: 'bg-blue-100 border-blue-300 text-blue-900',
        icon: '⏳',
      }
    } else {
      return {
        status: 'AWAITING ORACLE CONFIRMATION',
        color: 'bg-yellow-100 border-yellow-300 text-yellow-900',
        icon: '⏳',
      }
    }
  }

  if (!isAuthenticated) {
    navigate('/')
    return null
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My Trades</h1>
        <div className="text-center py-12">
          <p className="text-gray-600">Loading your trades...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My Trades</h1>

      {error && (
        <div className="bg-red-100 border border-red-300 text-red-900 px-4 py-3 rounded mb-6">
          ❌ {error}
        </div>
      )}

      {trades.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-blue-900 mb-4">
            📋 No trades yet. Head to the marketplace to accept offers!
          </p>
          <button
            onClick={() => navigate('/marketplace')}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            → Go to Marketplace
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {trades.map((trade) => {
            const status = getStatusDisplay(trade)
            const cert = certificates.get(trade.certificateId)
            const createdDate = new Date(trade.createdAt * 1000)
            
            // Determine user's role in this trade
            const userRole = user.wallet.toLowerCase() === trade.producer.toLowerCase() 
              ? 'Producer' 
              : 'Consumer'
            const roleIcon = user.wallet.toLowerCase() === trade.producer.toLowerCase() 
              ? '🌱' 
              : '⚡'

            return (
              <div
                key={trade.tradeId}
                className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden"
              >
                {/* Trade Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold">Trade #{trade.tradeId}</h3>
                        <span className="text-sm font-semibold bg-blue-100 text-blue-900 px-2 py-1 rounded">
                          {roleIcon} {userRole}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Offer #{trade.offerId} • {createdDate.toLocaleDateString()} {createdDate.toLocaleTimeString()}
                      </p>
                    </div>
                    <div
                      className={`px-4 py-2 rounded-lg border font-semibold ${status.color}`}
                    >
                      {status.icon} {status.status}
                    </div>
                  </div>
                </div>

                {/* Trade Details */}
                <div className="px-6 py-4 space-y-4">
                  {/* Energy & Price Info */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-3 rounded">
                      <p className="text-sm text-gray-600">Energy Amount</p>
                      <p className="text-lg font-bold text-blue-900">{trade.energyAmount} kWh</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded">
                      <p className="text-sm text-gray-600">Total Price</p>
                      <p className="text-lg font-bold text-green-900">{formatEther(trade.totalPrice)} ETH</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded">
                      <p className="text-sm text-gray-600">
                        {userRole === 'Producer' ? 'Buyer' : 'Seller'}
                      </p>
                      <p className="text-xs font-mono text-purple-900">
                        {userRole === 'Producer' 
                          ? `${trade.consumer.substring(0, 6)}...${trade.consumer.substring(trade.consumer.length - 4)}`
                          : `${trade.producer.substring(0, 6)}...${trade.producer.substring(trade.producer.length - 4)}`
                        }
                      </p>
                    </div>
                  </div>

                  {/* Certificate Info */}
                  {cert && (
                    <CertificateCard certificate={cert} showProducerAddress={true} />
                  )}

                  {/* Process Timeline */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Process Timeline</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-green-600 font-bold">✅</span>
                        <span className="text-gray-700">
                          <strong>Offer Accepted</strong> - Trade created, payment locked in escrow
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={trade.deliveryConfirmed ? 'text-green-600 font-bold' : 'text-gray-400'}>
                          {trade.deliveryConfirmed ? '✅' : '⏳'}
                        </span>
                        <span className={trade.deliveryConfirmed ? 'text-gray-700' : 'text-gray-500'}>
                          <strong>Oracle Confirms Delivery</strong> - Energy transferred to you
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={trade.settled ? 'text-green-600 font-bold' : 'text-gray-400'}>
                          {trade.settled ? '✅' : '⏳'}
                        </span>
                        <span className={trade.settled ? 'text-gray-700' : 'text-gray-500'}>
                          <strong>Trade Settled</strong> - Payment released to producer
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

