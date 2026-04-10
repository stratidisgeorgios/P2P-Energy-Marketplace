import React, { useState } from 'react'
import BlockchainService from '../services/ContractService'

interface RegistrationModalProps {
  isOpen: boolean
  account: string
  onClose: () => void
  onSuccess: () => void
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({
  isOpen,
  account,
  onClose,
  onSuccess,
}) => {
  const [username, setUsername] = useState('')
  const [userRole, setUserRole] = useState<'PRODUCER' | 'CONSUMER'>('PRODUCER')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!username.trim()) {
      setError('Username is required')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      let role: 'PRODUCER' | 'CONSUMER'
      role = userRole

      console.log(`🔗 Registering user: ${username} as ${role}...`)
      const txHash = await BlockchainService.registerUser(username, role)
      console.log(`✅ User registered! Tx: ${txHash}`)
      alert(`✅ Successfully registered as ${role}!\n\nTx: ${txHash}`)
      
      setUsername('')
      setUserRole('PRODUCER')
      onSuccess()
      onClose()
    } catch (err: any) {
      const errorMsg = err.message || String(err)
      console.error('❌ Registration failed:', errorMsg)
      
      // Check if user rejected the transaction
      if (errorMsg.includes('rejected') || errorMsg.includes('ACTION_REJECTED') || err.code === 4001) {
        setError('Registration failed. Try again.')
      } else {
        setError(errorMsg.length > 100 ? 'Registration failed. Try again.' : errorMsg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">📋 Register on Blockchain</h2>

        <p className="text-gray-600 mb-6 text-sm">
          Your wallet <code className="bg-gray-100 px-2 py-1 rounded text-xs">{account.substring(0, 6)}...{account.substring(account.length - 4)}</code> needs to be registered before creating offers.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Your Role (choose one)
            </label>
            <div className="space-y-3">
              <label className={`flex items-center p-3 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition ${
                userRole === 'PRODUCER' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="userRole"
                  value="PRODUCER"
                  checked={userRole === 'PRODUCER'}
                  onChange={(e) => setUserRole(e.target.value as 'PRODUCER' | 'CONSUMER')}
                  disabled={isLoading}
                  className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
                <div className="ml-3">
                  <span className="text-sm font-medium">🌱 Producer (Sell Energy)</span>
                  <p className="text-xs text-gray-500 mt-1">Mint renewable energy tokens and create sell offers</p>
                </div>
              </label>
              <label className={`flex items-center p-3 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition ${
                userRole === 'CONSUMER' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="userRole"
                  value="CONSUMER"
                  checked={userRole === 'CONSUMER'}
                  onChange={(e) => setUserRole(e.target.value as 'PRODUCER' | 'CONSUMER')}
                  disabled={isLoading}
                  className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
                <div className="ml-3">
                  <span className="text-sm font-medium">⚡ Consumer (Buy Energy)</span>
                  <p className="text-xs text-gray-500 mt-1">Create buy offers and accept seller offers</p>
                </div>
              </label>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition font-medium"
            >
              {isLoading ? '⏳ Registering...' : '✅ Register'}
            </button>
          </div>
        </form>

        <p className="text-gray-500 text-xs mt-6 text-center">
          💡 Registration is required once per wallet address. You'll pay a small gas fee for this blockchain transaction.
        </p>
      </div>
    </div>
  )
}
