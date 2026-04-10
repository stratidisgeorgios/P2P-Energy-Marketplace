import React, { createContext, useContext, useState, useCallback } from 'react'

interface RefreshContextType {
  refreshToken: number
  triggerRefresh: () => void
}

const RefreshContext = createContext<RefreshContextType | undefined>(undefined)

export const RefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshToken, setRefreshToken] = useState(0)

  const triggerRefresh = useCallback(() => {
    setRefreshToken((prev) => prev + 1)
    console.log('🔄 Balance refresh triggered')
  }, [])

  return (
    <RefreshContext.Provider value={{ refreshToken, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  )
}

export const useRefresh = () => {
  const context = useContext(RefreshContext)
  if (!context) {
    throw new Error('useRefresh must be used within RefreshProvider')
  }
  return context
}
