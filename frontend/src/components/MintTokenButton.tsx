import React, { useState, useEffect } from 'react'
import BlockchainService from '../services/ContractService'
import { useAuthContext } from '../context/AuthContext'
import { useWeb3Context } from '../context/Web3Context'
import { useRefresh } from '../context/RefreshContext'

export const MintTokenButton: React.FC = () => {
  const { isAuthenticated, user } = useAuthContext()
  const { provider, account } = useWeb3Context()
  const { triggerRefresh } = useRefresh()
  const [isLoading, setIsLoading] = useState(false)
  const [amount, setAmount] = useState('100')
  const [showForm, setShowForm] = useState(false)
  const [isProducer, setIsProducer] = useState<boolean | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)

  // Check producer status on account change
  useEffect(() => {
    if (!account || !provider || !isAuthenticated) {
      setIsProducer(null)
      return
    }

    const checkProducerStatus = async () => {
      setIsCheckingStatus(true)
      try {
        await BlockchainService.setProvider(provider)
        const producerStatus = await BlockchainService.isProducer(account)
        console.log(`🔍 Account ${account} isProducer: ${producerStatus}`)
        setIsProducer(producerStatus)
      } catch (error) {
        console.error('Failed to check producer status:', error)
        setIsProducer(false)
      } finally {
        setIsCheckingStatus(false)
      }
    }

    checkProducerStatus()
  }, [account, provider, isAuthenticated])

  if (!isAuthenticated || !user || !provider) {
    return null
  }

  const handleMint = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount')
      return
    }

    if (isProducer === false) {
      alert('❌ ERROR: You are not registered as a Producer according to the blockchain.\n\n📋 Your current blockchain status: Producer = ❌\n\n🔧 To fix this:\n1. Click "❌ Deregister" button in header\n2. Wait 1-2 seconds\n3. Click "📝 Register" again\n4. MAKE SURE TO CHECK: ☑️ Producer (Sell Energy)\n5. Also check: ☑️ Consumer (Buy Energy) if you want\n6. Complete registration\n7. Wait for transaction to confirm\n8. Try minting again\n\n⚠️ If the "❌ Deregister" button doesn\'t appear, you may already be fully deregistered. In that case, go straight to step 3.')
      return
    }

    setIsLoading(true)
    try {
      console.log(`💰 Minting ${amount} test NRG...`)
      await BlockchainService.setProvider(provider)
      const amountWei = BlockchainService.toWei(amount)
      const txHash = await BlockchainService.mintTestEnergy(amountWei)
      
      console.log(`✅ Test tokens minted! Tx: ${txHash}`)
      alert(`✅ Successfully minted ${amount} test NRG!\n\nTx: ${txHash}`)
      
      // Auto-add token to MetaMask
      await BlockchainService.addTokenToMetaMask()
      
      // Trigger balance refresh
      triggerRefresh()
      
      setAmount('100')
      setShowForm(false)
    } catch (error: any) {
      const errorMsg = error.message || String(error)
      console.error('❌ Mint failed:', errorMsg)
      
      // Check if user is not registered as a producer
      if (errorMsg.includes('Only producers can mint test tokens')) {
        alert('❌ Error: Blockchain says you\'re not a Producer.\n\n🔧 Quick Fix:\n1. Deregister (click "❌ Deregister" in header)\n2. Re-register with Producer checkbox CHECKED\n3. Try minting again\n\nMake sure the transaction completes!')
      } else if (errorMsg.includes('User not registered')) {
        alert('❌ Error: You must register before minting tokens.\n\n🔧 To fix this:\n1. Click "📝 Register" button in the header\n2. Check "🌱 Producer (Sell Energy)" checkbox\n3. Complete registration\n4. Try minting again')
      } else {
        alert(`Error: ${errorMsg}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Status indicator */}
      {isCheckingStatus ? (
        <div className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
          ⏳ Checking producer status...
        </div>
      ) : isProducer === false ? (
        <div className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
          ❌ Not registered as Producer. Deregister and re-register with Producer role.
        </div>
      ) : isProducer === true ? (
        <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
          ✓ Registered as Producer
        </div>
      ) : null}

      <div className="flex gap-2">
        {!showForm ? (
          <>
            <button
              onClick={() => setShowForm(true)}
              disabled={isProducer === false}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition text-sm font-medium"
            >
              💰 Get Test NRG
            </button>
            <button
              onClick={() => BlockchainService.addTokenToMetaMask()}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition text-sm font-medium"
            >
              🦊 Add to MetaMask
            </button>
          </>
        ) : (
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (NRG)"
              min="1"
              className="px-3 py-2 border rounded text-sm"
              disabled={isLoading || isProducer === false}
            />
            <button
              onClick={handleMint}
              disabled={isLoading || isProducer === false}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition text-sm font-medium"
            >
              {isLoading ? '⏳ Minting...' : 'Mint'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              disabled={isLoading}
              className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
