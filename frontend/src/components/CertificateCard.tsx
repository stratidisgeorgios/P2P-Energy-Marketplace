import React from 'react'

interface Certificate {
  id: number
  producer: string
  energySource: number
  amount: number
  issuedAt: number
  expiresAt: number
  metadata: string
  isValid: boolean
  linkedTradeId: number
}

interface CertificateCardProps {
  certificate: Certificate
  showProducerAddress?: boolean
}

/**
 * Certificate Display Component
 * Displays renewable energy certificate details in a formatted card
 * Used in MyTrades and other pages to show certificate information
 */
export const CertificateCard: React.FC<CertificateCardProps> = ({ 
  certificate: cert,
  showProducerAddress = true
}) => {
  const getEnergySourceName = (source: number): string => {
    const sources = ['SOLAR', 'WIND', 'HYDRO', 'GEOTHERMAL', 'BIOMASS', 'OTHER']
    return sources[source] || 'UNKNOWN'
  }

  const getEnergySourceColor = (source: number): { bg: string; border: string; text: string } => {
    const colors: Record<number, { bg: string; border: string; text: string }> = {
      0: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-900' }, // SOLAR
      1: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-900' }, // WIND
      2: { bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-900' }, // HYDRO
      3: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-900' }, // GEOTHERMAL
      4: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-900' }, // BIOMASS
      5: { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-900' }, // OTHER
    }
    return colors[source] || colors[5]
  }

  const sourceEmoji: Record<number, string> = {
    0: '☀️',  // SOLAR
    1: '💨',  // WIND
    2: '💧',  // HYDRO
    3: '🌋',  // GEOTHERMAL
    4: '🌾',  // BIOMASS
    5: '⚡',  // OTHER
  }

  const colors = getEnergySourceColor(cert.energySource)
  const isExpiring = cert.expiresAt * 1000 - Date.now() < 30 * 24 * 60 * 60 * 1000 // Less than 30 days
  const isExpired = Date.now() > cert.expiresAt * 1000

  return (
    <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-300 rounded-lg overflow-hidden">
      {/* Certificate Header */}
      <div className="bg-gradient-to-r from-amber-200 to-orange-200 px-6 py-3 border-b border-amber-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📜</span>
            <div>
              <p className="font-bold text-amber-900 text-lg">
                Renewable Energy Certificate
              </p>
              <p className="text-sm text-amber-800">
                Certificate ID: <span className="font-mono font-semibold">#{cert.id}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            {cert.isValid ? (
              isExpired ? (
                <span className="bg-red-200 text-red-900 px-3 py-1 rounded-full text-sm font-semibold">
                  ❌ Expired
                </span>
              ) : isExpiring ? (
                <span className="bg-orange-200 text-orange-900 px-3 py-1 rounded-full text-sm font-semibold">
                  ⚠️ Expiring Soon
                </span>
              ) : (
                <span className="bg-green-200 text-green-900 px-3 py-1 rounded-full text-sm font-semibold">
                  ✅ Valid
                </span>
              )
            ) : (
              <span className="bg-red-200 text-red-900 px-3 py-1 rounded-full text-sm font-semibold">
                ❌ Invalid
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Certificate Details */}
      <div className="px-6 py-4 space-y-3">
        {/* Energy Source & Amount */}
        <div className="grid grid-cols-2 gap-4">
          <div className={`${colors.bg} rounded p-3 border-2 ${colors.border}`}>
            <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold">
              {sourceEmoji[cert.energySource]} Energy Source
            </p>
            <p className={`text-lg font-bold ${colors.text} mt-1`}>
              {getEnergySourceName(cert.energySource)}
            </p>
          </div>
          <div className="bg-white rounded p-3 border border-amber-200">
            <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold">⚡ Energy Amount</p>
            <p className="text-lg font-bold text-amber-900 mt-1">
              {cert.amount} NRG
            </p>
          </div>
        </div>

        {/* Issue & Expiry Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded p-3 border border-amber-200">
            <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold">📅 Issued On</p>
            <p className="text-sm font-semibold text-amber-900 mt-1">
              {new Date(cert.issuedAt * 1000).toLocaleDateString()}
            </p>
            <p className="text-xs text-gray-500">
              {new Date(cert.issuedAt * 1000).toLocaleTimeString()}
            </p>
          </div>
          <div className={`rounded p-3 border-2 ${
            isExpired ? 'bg-red-50 border-red-300' : isExpiring ? 'bg-orange-50 border-orange-300' : 'bg-white border-amber-200'
          }`}>
            <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold">⏳ Expires On</p>
            <p className={`text-sm font-semibold mt-1 ${
              isExpired ? 'text-red-900' : isExpiring ? 'text-orange-900' : 'text-amber-900'
            }`}>
              {new Date(cert.expiresAt * 1000).toLocaleDateString()}
            </p>
            <p className={`text-xs ${
              isExpired ? 'text-red-700' : isExpiring ? 'text-orange-700' : 'text-gray-500'
            }`}>
              {new Date(cert.expiresAt * 1000).toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Producer Address */}
        {showProducerAddress && (
          <div className="bg-white rounded p-3 border border-amber-200">
            <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold">🔐 Issued to Producer</p>
            <p className="text-sm font-mono text-amber-900 mt-1 break-all">
              {cert.producer}
            </p>
          </div>
        )}

        {/* Metadata / Additional Info */}
        {cert.metadata && cert.metadata.trim() && (
          <div className="bg-white rounded p-3 border border-amber-200">
            <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold">📋 Additional Information</p>
            <div className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words max-h-40 overflow-y-auto bg-amber-50 rounded p-2 border border-amber-100">
              {cert.metadata}
            </div>
          </div>
        )}

        {/* Trade Linked Info */}
        {cert.linkedTradeId > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">🔗 Linked Trade</p>
            <p className="text-sm font-mono font-bold text-blue-900 mt-1">
              Trade ID: #{cert.linkedTradeId}
            </p>
          </div>
        )}

        {/* Certificate Status Summary */}
        <div className={`rounded p-3 ${cert.isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-sm ${cert.isValid ? 'text-green-900' : 'text-red-900'}`}>
            {cert.isValid ? (
              <>
                <span className="font-semibold">✅ Authenticated Certificate:</span> This renewable energy certificate confirms the origin and amount of renewable energy produced. It can be used for sustainability claims and carbon offset verification.
              </>
            ) : (
              <>
                <span className="font-semibold">⚠️ Invalid Certificate:</span> This certificate is no longer valid and cannot be used for sustainability or carbon offset claims.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
