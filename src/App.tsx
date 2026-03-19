import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { PageLayout } from './components/layout/PageLayout'
import { ToastContainer } from './components/ui/Toast'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Suppliers } from './pages/Suppliers'
import { Products } from './pages/Products'
import { Dealers } from './pages/Dealers'
import { Deliveries } from './pages/Deliveries'
import { DeliveryDetail } from './pages/DeliveryDetail'
import { Sales } from './pages/Sales'
import { Inkasso } from './pages/Inkasso'
import { OpEx } from './pages/OpEx'
import { PnL } from './pages/PnL'
import { Pricing } from './pages/Pricing'

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    const unsubscribe = initialize()
    return unsubscribe
  }, [initialize])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <PageLayout />
            </ProtectedRoute>
          }
        >

          <Route index element={<Dashboard />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="products" element={<Products />} />
          <Route path="dealers" element={<Dealers />} />
          <Route path="deliveries" element={<Deliveries />} />
          <Route path="deliveries/:id" element={<DeliveryDetail />} />
          <Route path="sales" element={<Sales />} />
          <Route path="inkasso" element={<Inkasso />} />
          <Route path="opex" element={<OpEx />} />
          <Route path="pnl" element={<PnL />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  )
}
