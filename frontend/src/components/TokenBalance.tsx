import React, { useState, useEffect } from 'react'
import { useWeb3Context } from '../context/Web3Context'
import { useRefresh } from '../context/RefreshContext'
import BlockchainService from '../services/ContractService'

/**
 * Token Balance Display Component
 * Shows the producer's current energy token balance with reserved amounts
 */
export const TokenBalance: React.FC = () => {
  const { account, provider } = useWeb3Context()
  const { refreshToken } = useRefresh()
  const [totalBalance, setTotalBalance] = useState('0')
  const [reservedBalance, setReservedBalance] = useState('0')
  const [isLoading, setIsLoading] = useState(false)

  // Fetch token balance and reserved tokens when account changes or when refresh is triggered
  useEffect(() => {
    if (!account || !provider) {
      setTotalBalance('0')
      setReservedBalance('0')
      return
    }

    const fetchBalance = async () => {
      setIsLoading(true)
      try {
        await BlockchainService.setProvider(provider)
        const total = await BlockchainService.getTokenBalance(account)
        const reserved = await BlockchainService.getReservedTokens(account)
        setTotalBalance(total)
        setReservedBalance(reserved)
        const available = String(Number(total) - Number(reserved))
        console.log(`💰 Token balance: ${total} NRG | Locked: ${reserved} NRG | Available: ${available} NRG`)
      } catch (error) {
        console.error('Failed to fetch token balance:', error)
        setTotalBalance('0')
        setReservedBalance('0')
      } finally {
        setIsLoading(false)
      }
    }

    fetchBalance()
  }, [account, provider, refreshToken])

  if (!account) {
    return null
  }

  const availableBalance = String(Number(totalBalance) - Number(reservedBalance))

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">💰 Total:</span>
          {isLoading ? (
            <span className="text-xs font-bold text-purple-600">⏳ Loading...</span>
          ) : totalBalance === '0' ? (
            <span className="text-xs font-bold text-red-600">0 NRG</span>
          ) : (
            <span className="text-xs font-bold text-purple-600">{totalBalance} NRG</span>
          )}
        </div>
        {Number(reservedBalance) > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">🔒 Locked:</span>
            <span className="text-xs font-bold text-orange-600">{reservedBalance} NRG</span>
          </div>
        )}
        {Number(reservedBalance) > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">✅ Available:</span>
            <span className="text-xs font-bold text-green-600">{availableBalance} NRG</span>
          </div>
        )}
      </div>
    </div>
  )
}
