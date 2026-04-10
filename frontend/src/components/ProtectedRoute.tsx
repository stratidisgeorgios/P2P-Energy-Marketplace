import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * ProtectedRoute Component
 * Redirects unauthenticated users to home page
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuthContext()

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
