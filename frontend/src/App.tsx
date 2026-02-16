import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { NostrProvider } from './contexts/NostrContext';
import { Dashboard } from './pages/Dashboard';
import { Deposit } from './pages/Deposit';
import { Withdraw } from './pages/Withdraw';
import { Transfer } from './pages/Transfer';
import { Card } from './pages/Card';

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
        </Routes>
      </BrowserRouter>
    </NostrProvider>
  );
}

export default App;
