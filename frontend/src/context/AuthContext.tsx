import React, { createContext, useCallback, useContext, useState } from 'react'

interface User {
  wallet: string
  username?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (wallet: string, username?: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)

  const [isLoading] = useState(false)

  const login = useCallback((wallet: string, username?: string) => {
    const newUser: User = { wallet, username }
    setUser(newUser)
    console.log(`✅ User authenticated: ${wallet}`)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    console.log('✅ User logged out')
  }, [])

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuthContext = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  return context
}
