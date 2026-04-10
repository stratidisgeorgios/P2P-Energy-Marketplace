import React, { useState, useEffect } from 'react'
import { useWeb3Context } from '../context/Web3Context'
import { useAuthContext } from '../context/AuthContext'
import { RegistrationModal } from './RegistrationModal'
import BlockchainService from '../services/ContractService'
import { formatEther } from 'ethers'

/**
 * Wallet Connect Component
 * Connects user's MetaMask wallet (blockchain-only, no backend)
 */
export const WalletConnect: React.FC = () => {
  const { account, balance, isLoading, isConnected, connectWallet, disconnectWallet } = useWeb3Context()
  const { user, login, logout } = useAuthContext()
  const [showRegistration, setShowRegistration] = useState(false)

  // Handle account changes - re-authenticate when switching accounts
  useEffect(() => {
    if (!account) {
      setShowRegistration(false)
      return
    }

    // If we're already logged in with this exact account, nothing to do
    if (user && user.wallet.toLowerCase() === account.toLowerCase()) {
      console.log(`✅ Already authenticated with account ${account}`)
      return
    }

    // Account changed or we're not logged in - need to authenticate
    console.log(`🔄 Account state changed to ${account}`)
    
    if (user && user.wallet.toLowerCase() !== account.toLowerCase()) {
      console.log(`🔌 Logging out old account ${user.wallet}`)
      logout()
    }

    // Check if new account is registered
    const checkAndAuthenticate = async () => {
      try {
        console.log(`🔍 Checking if ${account} is registered...`)
        const isRegistered = await BlockchainService.isUserActive(account)
        console.log(`📝 Account registered: ${isRegistered}`)
        
        if (isRegistered) {
          console.log('✅ Account registered - authenticating')
          login(account)
          setShowRegistration(false)
        } else {
          console.log('📋 Account not registered - showing registration modal')
          setShowRegistration(true)
        }
      } catch (error: any) {
        console.error('⚠️ Error checking registration:', error.message)
        // Assume registered on error and authenticate anyway
        login(account)
        setShowRegistration(false)
      }
    }

    checkAndAuthenticate()
  }, [account])

  const handleConnect = async () => {
    try {
      console.log('🔄 Starting MetaMask wallet connection...')
      const walletAddress = await connectWallet()
      console.log('✅ Wallet connected:', walletAddress)
      console.log('💰 Balance:', formatEther(balance || '0'), 'ETH')
    } catch (error: any) {
      const errorMsg = error.message || String(error)
      console.error('❌ Connection failed:', errorMsg)
      alert(`Failed to connect: ${errorMsg}`)
    }
  }

  // Show connected state
  if (isConnected && account) {
    return (
      <>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-green-100 rounded-lg border border-green-300">
            <span className="text-green-600 font-semibold">✓ Connected</span>
            <div className="text-sm text-gray-700">
              <p className="font-mono">{account.substring(0, 6)}...{account.substring(account.length - 4)}</p>
              {balance && <p className="text-gray-500 text-xs">{formatEther(balance)} ETH</p>}
            </div>
          </div>
          <button
            onClick={() => {
              disconnectWallet()
              logout()
            }}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
          >
            Disconnect
          </button>
        </div>

        <RegistrationModal
          isOpen={showRegistration}
          account={account}
          onClose={() => setShowRegistration(false)}
          onSuccess={() => {
            login(account)
            setShowRegistration(false)
            console.log('🎉 User registered and authenticated!')
          }}
        />
      </>
    )
  }

  // Show connect button
  return (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
    >
      {isLoading ? '⏳ Connecting...' : '🦊 Connect MetaMask'}
    </button>
  )
}
