import React, { useState, useEffect } from 'react'
import { useAuthContext } from '../context/AuthContext'
import { useWeb3Context } from '../context/Web3Context'
import { useRefresh } from '../context/RefreshContext'
import { RegistrationModal } from './RegistrationModal'
import BlockchainService from '../services/ContractService'

/**
 * User Registration Component
 * Shows Register/Deregister buttons based on registration status
 */
export const UserRegistration: React.FC = () => {
  const { user } = useAuthContext()
  const { account, provider } = useWeb3Context()
  const { refreshTrigger } = useRefresh()
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [deregisterError, setDeregisterError] = useState('')

  // Check registration status
  useEffect(() => {
    if (!account) {
      setIsRegistered(null)
      return
    }

    const checkRegistration = async () => {
      try {
        if (provider) {
          await BlockchainService.setProvider(provider)
        }
        const registered = await BlockchainService.isUserActive(account)
        console.log(`✅ Registration check: ${account} isActive = ${registered}`)
        setIsRegistered(registered)
      } catch (error) {
        console.error('Failed to check registration status:', error)
        setIsRegistered(false)
      }
    }

    checkRegistration()
  }, [account, provider, refreshTrigger])

  const handleDeregister = async () => {
    if (!window.confirm('Are you sure you want to deregister? This action cannot be undone.')) {
      return
    }

    setIsLoading(true)
    setDeregisterError('')
    try {
      console.log('🔗 Deregistering user...')
      const txHash = await BlockchainService.deregisterUser()
      console.log('✅ User deregistered:', txHash)
      alert('✅ Successfully deregistered!\n\nTx: ' + txHash)
      setIsRegistered(false)
    } catch (error: any) {
      const errorMsg = error.message || String(error)
      console.error('❌ Failed to deregister:', errorMsg)
      
      // Check if user rejected the transaction
      if (errorMsg.includes('rejected') || errorMsg.includes('ACTION_REJECTED') || error.code === 4001) {
        setDeregisterError('Deregistration failed. Try again.')
      } else {
        setDeregisterError(errorMsg.length > 100 ? 'Deregistration failed. Try again.' : errorMsg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegistrationSuccess = () => {
    setShowModal(false)
    // Re-check registration status from blockchain after a short delay
    setTimeout(() => {
      if (account && provider) {
        BlockchainService.setProvider(provider).then(() => {
          BlockchainService.isUserActive(account).then(registered => {
            console.log(`✅ Post-registration check: ${registered}`)
            setIsRegistered(registered)
          })
        })
      }
    }, 1000)
  }

  // Don't show anything if not connected
  if (!account) {
    return null
  }

  // Show Register button if not registered
  if (isRegistered === false) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
        >
          {isLoading ? '⏳ Registering...' : '📝 Register'}
        </button>

        <RegistrationModal
          isOpen={showModal}
          account={account}
          onClose={() => setShowModal(false)}
          onSuccess={handleRegistrationSuccess}
        />
      </>
    )
  }

  // Show Deregister button if registered
  if (isRegistered === true) {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={handleDeregister}
          disabled={isLoading}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
        >
          {isLoading ? '⏳ Deregistering...' : '❌ Deregister'}
        </button>
        {deregisterError && (
          <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
            {deregisterError}
          </div>
        )}
      </div>
    )
  }

  // Loading state
  return (
    <div className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg">
      ⏳ Checking registration...
    </div>
  )
}
