import React from 'react'

/**
 * Home/Landing Page
 */
export const Home: React.FC = () => {

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-500">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center text-white py-20">
          <h1 className="text-5xl font-bold mb-4">⚡ Decentralized Energy Marketplace</h1>
          <p className="text-2xl mb-8 opacity-90">Trade renewable energy peer-to-peer on the blockchain</p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-12">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-2xl font-bold mb-4 text-green-600">💚 Sustainable</h3>
            <p className="text-gray-700">Trade renewable energy and support a sustainable future</p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-2xl font-bold mb-4 text-blue-600">🔗 Secure</h3>
            <p className="text-gray-700">Blockchain-based escrow ensures safe and transparent trades</p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-2xl font-bold mb-4 text-yellow-600">⚖️ Fair</h3>
            <p className="text-gray-700">Peer-to-peer trading eliminates middlemen and reduces costs</p>
          </div>
        </div>

        {/* How it Works */}
        <div className="bg-white rounded-lg shadow-lg p-8 my-12">
          <h2 className="text-3xl font-bold mb-8 text-center">How It Works</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-green-500 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="font-bold mb-2">Connect Wallet</h3>
              <p className="text-gray-600">Connect your Web3 wallet</p>
            </div>

            <div className="text-center">
              <div className="bg-green-500 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="font-bold mb-2">Create Offer</h3>
              <p className="text-gray-600">List energy for buying or selling</p>
            </div>

            <div className="text-center">
              <div className="bg-green-500 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="font-bold mb-2">Trade Energy</h3>
              <p className="text-gray-600">Accept or negotiate offers</p>
            </div>

            <div className="text-center">
              <div className="bg-green-500 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                4
              </div>
              <h3 className="font-bold mb-2">Get Certificate</h3>
              <p className="text-gray-600">Receive renewable energy credits</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
