import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { NostrProvider } from './contexts/NostrContext';
import { Dashboard } from './pages/Dashboard';
import { Deposit } from './pages/Deposit';
import { Withdraw } from './pages/Withdraw';
import { Transfer } from './pages/Transfer';
import { Card } from './pages/Card';

import { Login as BusinessLogin } from './pages/business/Login';
import { Dashboard as BusinessDashboard } from './pages/business/Dashboard';
import { PointOfSale } from './pages/business/PointOfSale';

function App() {
  return (
    <NostrProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/deposit" element={<Deposit />} />
          <Route path="/withdraw" element={<Withdraw />} />
          <Route path="/transfer" element={<Transfer />} />
          <Route path="/card" element={<Card />} />

          {/* Business Pivot Routes */}
          <Route path="/business/login" element={<BusinessLogin />} />
          <Route path="/business/dashboard" element={<BusinessDashboard />} />
          <Route path="/business/pos" element={<PointOfSale />} />
        </Routes>
      </BrowserRouter>
    </NostrProvider>
  );
}

export default App;
