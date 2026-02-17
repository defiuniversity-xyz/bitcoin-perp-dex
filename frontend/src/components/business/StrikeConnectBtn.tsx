import { useNavigate } from 'react-router-dom';

export function StrikeConnectBtn() {
    const navigate = useNavigate();

    const handleConnect = () => {
        // Simulate OAuth delay
        setTimeout(() => {
            // Mock token storage
            localStorage.setItem('strike_token', 'mock_token_123');
            navigate('/business/dashboard');
        }, 1000);
    };

    return (
        <button
            onClick={handleConnect}
            className="bg-black text-white px-6 py-3 rounded-full font-bold text-lg hover:bg-gray-800 transition-colors flex items-center gap-3"
        >
            <img src="https://strike.me/img/strike-Icon.svg" alt="Strike" className="w-6 h-6" />
            Connect with Strike
        </button>
    );
}
