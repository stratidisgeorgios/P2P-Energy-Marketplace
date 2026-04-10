import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { Web3Provider } from './context/Web3Context'
import { RefreshProvider } from './context/RefreshContext'
import { NotificationProvider } from './context/NotificationContext'
import { Header } from './components/Header'
import { GlobalStyles } from './components/GlobalStyles'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Home } from './pages/Home'
import { Marketplace } from './pages/Marketplace'
import { MyTrades } from './pages/MyTrades'
import { OracleDashboard } from './pages/OracleDashboard'
import './styles.css'

/**
 * Main App Component - Blockchain-Only
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Web3Provider>
          <RefreshProvider>
            <NotificationProvider>
              <GlobalStyles />
              <Header />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route
                  path="/marketplace"
                  element={
                    <ProtectedRoute>
                      <Marketplace />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-trades"
                  element={
                    <ProtectedRoute>
                      <MyTrades />
                    </ProtectedRoute>
                  }
                />
                <Route path="/oracle" element={<OracleDashboard />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </NotificationProvider>
          </RefreshProvider>
        </Web3Provider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
