import React, { useEffect, useState } from 'react'
import { useWeb3Context } from '../context/Web3Context'
import BlockchainService from '../services/ContractService'
import { ethers } from 'ethers'

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

/**
 * Oracle Dashboard - For admin/oracle account only
 * Allows confirming deliveries and settling trades
 */
export const OracleDashboard: React.FC = () => {
  const { account, provider } = useWeb3Context()
  const [trades, setTrades] = useState<Trade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  // Get oracle address from private key
  const oraclePrivateKey = import.meta.env.VITE_ORACLE_PRIVATE_KEY
  const oracleWallet = new ethers.Wallet(oraclePrivateKey)
  const oracleAddress = oracleWallet.address

  // Check if current account is oracle
  const isOracle = account?.toLowerCase() === oracleAddress.toLowerCase()

  // Load all trades from contract
  const loadAllTrades = async () => {
    if (!provider) return

    setIsLoading(true)
    try {
      await BlockchainService.setProvider(provider)

      const nextTradeId = await BlockchainService.getNextTradeId()
      console.log(`📊 Oracle: Loading ${nextTradeId} trades...`)

      const loadedTrades: Trade[] = []

      for (let i = 1; i < nextTradeId; i++) {
        try {
          const trade = await BlockchainService.getTrade(i)
          if (trade && trade.tradeId !== 0n) {
            loadedTrades.push({
              tradeId: i,
              offerId: Number(trade.offerId),
              producer: trade.producer,
              consumer: trade.consumer,
              energyAmount: Number(trade.energyAmount),
              totalPrice: trade.totalPrice.toString(),
              createdAt: Number(trade.createdAt),
              certificateId: Number(trade.certificateId),
              deliveryConfirmed: trade.deliveryConfirmed,
              settled: trade.settled,
            })
          }
        } catch (e) {
          // Skip trades that error
          continue
        }
      }

      setTrades(loadedTrades)
      console.log(`✅ Oracle: Loaded ${loadedTrades.length} trades`)
    } catch (err: any) {
      setError(`Failed to load trades: ${err.message}`)
      console.error('Failed to load trades:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (provider && isOracle) {
      loadAllTrades()
    }
  }, [provider, account])

  const handleConfirmDelivery = async (tradeId: number) => {
    if (!provider || !isOracle) {
      alert('Only oracle can confirm deliveries')
      return
    }

    const confirmed = window.confirm(
      `Confirm delivery for trade ${tradeId}?\n\nThis will:\n1. Transfer energy tokens to consumer\n2. Mark delivery as confirmed`
    )
    if (!confirmed) return

    setIsProcessing(true)
    try {
      console.log(`🔗 Oracle confirming delivery for trade ${tradeId}...`)
      await BlockchainService.setProvider(provider)

      // Call oracle function with oracle signer
      const tx = await BlockchainService.oracleConfirmDelivery(tradeId, oraclePrivateKey)
      console.log(`✅ Delivery confirmed: ${tx}`)
      alert(`✅ Delivery confirmed!\n\nTx: ${tx}`)

      // Reload trades
      await loadAllTrades()
    } catch (err: any) {
      const errorMsg = err.message || String(err)
      console.error('❌ Failed to confirm delivery:', errorMsg)
      alert(`Error: ${errorMsg}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSettleTrade = async (tradeId: number) => {
    if (!provider || !isOracle) {
      alert('Only oracle can settle trades')
      return
    }

    const confirmed = window.confirm(
      `Settle trade ${tradeId}?\n\nThis will:\n1. Release escrowed funds\n2. Send payment to producer`
    )
    if (!confirmed) return

    setIsProcessing(true)
    try {
      console.log(`🔗 Oracle settling trade ${tradeId}...`)
      await BlockchainService.setProvider(provider)

      // Call oracle function with oracle signer
      const tx = await BlockchainService.oracleSettleTrade(tradeId, oraclePrivateKey)
      console.log(`✅ Trade settled: ${tx}`)
      alert(`✅ Trade settled!\n\nPayment released to producer.\n\nTx: ${tx}`)

      // Reload trades
      await loadAllTrades()
    } catch (err: any) {
      const errorMsg = err.message || String(err)
      console.error('❌ Failed to settle trade:', errorMsg)
      alert(`Error: ${errorMsg}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancelTrade = async (tradeId: number) => {
    if (!provider || !isOracle) {
      alert('Only oracle can cancel trades')
      return
    }

    const confirmed = window.confirm(
      `Cancel trade ${tradeId}?\n\nThis will:\n1. Refund escrowed funds to consumer\n2. Mark trade as cancelled`
    )
    if (!confirmed) return

    setIsProcessing(true)
    try {
      console.log(`🔗 Oracle cancelling trade ${tradeId}...`)
      await BlockchainService.setProvider(provider)

      // Call oracle function with oracle signer
      const tx = await BlockchainService.oracleCancelTrade(tradeId, oraclePrivateKey)
      console.log(`✅ Trade cancelled: ${tx}`)
      alert(`✅ Trade cancelled!\n\nConsumer refunded.\n\nTx: ${tx}`)

      // Reload trades
      await loadAllTrades()
    } catch (err: any) {
      const errorMsg = err.message || String(err)
      console.error('❌ Failed to cancel trade:', errorMsg)
      alert(`Error: ${errorMsg}`)
    } finally {
      setIsProcessing(false)
    }
  }

  // Only render for oracle account
  if (!isOracle) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 rounded-lg p-6 text-center">
          <h2 className="text-2xl font-bold text-red-800 mb-2">🔐 Access Denied</h2>
          <p className="text-red-700">
            This page is only accessible to the Oracle/Admin account.
          </p>
          <p className="text-sm text-red-600 mt-4">
            Oracle Address: <code className="bg-white px-2 py-1 rounded">{oracleAddress}</code>
          </p>
          <p className="text-sm text-red-600">
            Your Address: <code className="bg-white px-2 py-1 rounded">{account}</code>
          </p>
        </div>
      </div>
    )
  }

  const pendingTrades = trades.filter((t) => !t.settled)
  const confirmedTrades = trades.filter((t) => t.deliveryConfirmed && !t.settled)
  const completedTrades = trades.filter((t) => t.settled)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">🛡️ Oracle Dashboard</h1>
        <div className="bg-green-100 border border-green-400 rounded-lg p-4">
          <p className="text-green-800">
            <strong>✅ Oracle Account Verified</strong>
          </p>
          <p className="text-sm text-green-700 mt-1">
            Address: <code className="bg-white px-2 py-1 rounded">{oracleAddress}</code>
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 rounded-lg p-4 text-red-800">
          ❌ {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">⏳ Loading trades...</p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm font-semibold">Total Trades</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">{trades.length}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm font-semibold">Pending Delivery</p>
              <p className="text-3xl font-bold text-yellow-900 mt-2">
                {trades.filter((t) => !t.deliveryConfirmed && !t.settled).length}
              </p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-purple-800 text-sm font-semibold">Confirmed (Pending Settlement)</p>
              <p className="text-3xl font-bold text-purple-900 mt-2">{confirmedTrades.length}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 text-sm font-semibold">Completed</p>
              <p className="text-3xl font-bold text-green-900 mt-2">{completedTrades.length}</p>
            </div>
          </div>

          {/* All Trades Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <h2 className="text-xl font-bold text-white">📋 All Trades</h2>
            </div>

            {trades.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No trades yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Trade ID
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Producer
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Consumer
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Energy (NRG)
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => (
                      <tr key={trade.tradeId} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-6 py-4 font-bold text-blue-600">#{trade.tradeId}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {trade.producer.substring(0, 10)}...
                          </code>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {trade.consumer.substring(0, 10)}...
                          </code>
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-800">
                          {trade.energyAmount} NRG
                        </td>
                        <td className="px-6 py-4 text-gray-800">
                          {(Number(trade.totalPrice) / 1e18).toFixed(4)} ETH
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {trade.settled ? (
                              <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                ✅ Settled
                              </span>
                            ) : trade.deliveryConfirmed ? (
                              <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                                🔄 Confirmed
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                                ⏳ Pending
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {!trade.settled && !trade.deliveryConfirmed && (
                              <button
                                onClick={() => handleConfirmDelivery(trade.tradeId)}
                                disabled={isProcessing}
                                className="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                              >
                                {isProcessing ? '⏳' : '✅'} Confirm
                              </button>
                            )}
                            {trade.deliveryConfirmed && !trade.settled && (
                              <button
                                onClick={() => handleSettleTrade(trade.tradeId)}
                                disabled={isProcessing}
                                className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                              >
                                {isProcessing ? '⏳' : '💰'} Settle
                              </button>
                            )}
                            {!trade.settled && !trade.deliveryConfirmed && (
                              <button
                                onClick={() => handleCancelTrade(trade.tradeId)}
                                disabled={isProcessing}
                                className="px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                              >
                                {isProcessing ? '⏳' : '❌'} Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
