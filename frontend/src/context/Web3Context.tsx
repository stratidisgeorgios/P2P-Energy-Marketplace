import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { BrowserProvider } from 'ethers'
import BlockchainService from '../services/ContractService'

// Type for MetaMask window.ethereum object
declare global {
  interface Window {
    ethereum?: any
  }
}

interface Web3ContextType {
  account: string | null
  balance: string | null
  provider: BrowserProvider | null
  isConnected: boolean
  isLoading: boolean
  connectWallet: () => Promise<string>
  disconnectWallet: () => void
  getAvailableAccounts: () => Promise<string[]>
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined)

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Update balance when account changes
  const updateBalance = useCallback(async (address: string, providerInstance: BrowserProvider) => {
    try {
      const newBalance = await providerInstance.getBalance(address)
      setBalance(newBalance.toString())
    } catch (error) {
      console.error('Failed to update balance:', error)
    }
  }, [])

  // Handle account changes from MetaMask
  const handleAccountsChanged = useCallback(
    (accounts: string[]) => {
      console.log('🔄 MetaMask accounts changed event fired:', accounts)
      if (accounts.length === 0) {
        // User disconnected from MetaMask
        console.log('🔌 User disconnected from MetaMask')
        setAccount(null)
        setBalance(null)
      } else {
        const newAccount = accounts[0]
        console.log(`✅ Account switched in MetaMask to: ${newAccount}`)
        setAccount(newAccount)
        // Update balance will happen via useEffect watching account changes
      }
    },
    []
  )

  // Set up listeners when MetaMask is available
  useEffect(() => {
    if (!window.ethereum) {
      console.warn('⚠️  MetaMask not detected')
      return
    }

    console.log('📡 Setting up MetaMask event listeners...')
    // Add listener for account changes
    window.ethereum.on('accountsChanged', handleAccountsChanged)

    return () => {
      // Cleanup listener
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged)
    }
  }, [handleAccountsChanged])

  // Update balance when account or provider changes
  useEffect(() => {
    if (account && provider) {
      updateBalance(account, provider)
    }
  }, [account, provider, updateBalance])

  const connectWallet = useCallback(async (): Promise<string> => {
    setIsLoading(true)
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not installed')
      }

      console.log('🔗 Connecting wallet...')
      
      // Request accounts - this connects with whatever account is currently selected in MetaMask
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })

      if (accounts.length === 0) {
        throw new Error('No accounts returned from MetaMask')
      }

      const selectedAccount = accounts[0]
      console.log(`✅ Connected with account: ${selectedAccount}`)
      
      const newProvider = new BrowserProvider(window.ethereum)
      const newBalance = await newProvider.getBalance(selectedAccount)

      setProvider(newProvider)
      setAccount(selectedAccount)
      setBalance(newBalance.toString())

      // Initialize blockchain service with provider
      await BlockchainService.setProvider(newProvider)
      console.log('✅ Blockchain service initialized with account:', selectedAccount)

      return selectedAccount
    } catch (error) {
      console.error('❌ Failed to connect wallet:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  const disconnectWallet = useCallback(() => {
    console.log('🔌 Disconnecting wallet...')
    setAccount(null)
    setBalance(null)
    setProvider(null)
    // Note: To fully disconnect from MetaMask, you might also need to:
    // 1. Disconnect in MetaMask extension settings
    // 2. Or the user can manually select a different account next time
    console.log('⚠️  App disconnected. To connect with a different account, make sure MetaMask is set to that account before clicking "Connect MetaMask"')
  }, [])

  const getAvailableAccounts = useCallback(async (): Promise<string[]> => {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not installed')
      }
      console.log('🔍 Fetching available accounts from MetaMask...')
      const accounts = await window.ethereum.request({
        method: 'eth_accounts',
      })
      console.log('📋 Available accounts:', accounts)
      return accounts || []
    } catch (error) {
      console.error('Failed to get available accounts:', error)
      return []
    }
  }, [])

  const value: Web3ContextType = {
    account,
    balance,
    provider,
    isConnected: !!account,
    isLoading,
    connectWallet,
    disconnectWallet,
    getAvailableAccounts,
  }

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>
}

export const useWeb3Context = () => {
  const context = useContext(Web3Context)
  if (!context) {
    throw new Error('useWeb3Context must be used within Web3Provider')
  }
  return context
}
