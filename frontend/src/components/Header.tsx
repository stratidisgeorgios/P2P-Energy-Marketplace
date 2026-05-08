import React from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext'
import { useWeb3Context } from '../context/Web3Context'
import { WalletConnect } from './WalletConnect'
import { UserRegistration } from './UserRegistration'
import { TokenBalance } from './TokenBalance'
import { ethers } from 'ethers'

/**
 * Navigation Header - Blockchain Version
 */
export const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuthContext()
  const { account, disconnectWallet } = useWeb3Context()

  // Check if account is oracle
  const oraclePrivateKey = import.meta.env.VITE_ORACLE_PRIVATE_KEY
  const oracleWallet = oraclePrivateKey ? new ethers.Wallet(oraclePrivateKey) : null
  const isOracleAccount = account && oracleWallet && account.toLowerCase() === oracleWallet.address.toLowerCase()

  // Handle logout - disconnect both auth and wallet
  const handleLogout = () => {
    logout()
    disconnectWallet()
    console.log('✅ User logged out and wallet disconnected')
  }

  return (
    <header className="bg-white shadow">
      <nav className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-green-600">
          ⚡ Energy Marketplace
        </Link>

        <div className="flex items-center gap-6">
          {isAuthenticated ? (
            <>
              <Link to="/marketplace" className="text-gray-700 hover:text-green-600 font-medium">
                Marketplace
              </Link>
              <Link to="/my-trades" className="text-gray-700 hover:text-green-600 font-medium">
                My Trades
              </Link>
              {isOracleAccount && (
                <Link to="/oracle" className="text-red-600 hover:text-red-700 font-bold bg-red-50 px-3 py-1 rounded">
                  🛡️ Oracle
                </Link>
              )}
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 rounded">
                <span className="text-sm text-gray-700">
                  {user?.wallet ? `${user.wallet.substring(0, 6)}...${user.wallet.substring(user.wallet.length - 4)}` : 'Connected'}
                </span>
              </div>
              <TokenBalance />
              <UserRegistration />
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <WalletConnect />
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
