import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppShell } from './components/AppShell'
import { Markets } from './pages/Markets'
import { Trading } from './pages/Trading'
import { Portfolio } from './pages/Portfolio'
import { Account } from './pages/Account'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0f1629',
            border: '1px solid #1e2d4a',
            color: '#ffffff',
          },
        }}
      />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Markets />} />
          <Route path="trade" element={<Navigate to="/trade/BTC-USD-PERP" replace />} />
          <Route path="trade/:symbol" element={<Trading />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="account" element={<Account />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
