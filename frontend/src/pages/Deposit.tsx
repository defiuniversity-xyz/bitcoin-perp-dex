import { Link } from 'react-router-dom';
import { ConnectWallet } from '../components/ConnectWallet';
import { DepositForm } from '../components/DepositForm';
import { useNostr } from '../hooks/useNostr';
import { useBalance } from '../hooks/useBalance';

export function Deposit() {
  const { pubkey } = useNostr();
  const { refresh } = useBalance(pubkey);

  return (
    <div className="min-h-screen p-6 max-w-md mx-auto">
      <header className="flex justify-between items-center mb-8">
        <Link to="/" className="text-gray-400 hover:text-white">
          Back
        </Link>
        <ConnectWallet />
      </header>

      {pubkey ? (
        <DepositForm onSuccess={refresh} />
      ) : (
        <p className="text-gray-400">Connect with Nostr to deposit</p>
      )}
    </div>
  );
}
