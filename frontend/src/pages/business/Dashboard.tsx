import { Link, useLocation } from 'react-router-dom';
import { SalesHistory, type Sale } from '../../components/business/SalesHistory';
import { useState, useEffect } from 'react';

export function Dashboard() {
    const location = useLocation();
    const [balance, setBalance] = useState({ usd: 12450.00, btc: 0.45 });
    const [sales, setSales] = useState<Sale[]>([
        { id: '1', amountUsd: 25.50, amountBtc: 0.00045, timestamp: Date.now() - 3600000, status: 'settled' },
        { id: '2', amountUsd: 12.00, amountBtc: 0.00021, timestamp: Date.now() - 7200000, status: 'settled' },
        { id: '3', amountUsd: 5.00, amountBtc: 0.00009, timestamp: Date.now() - 86400000, status: 'settled' },
    ]);

    useEffect(() => {
        // Check for new sale from POS
        const state = location.state as { newSale?: { amount: number } };
        if (state?.newSale) {
            const newAmount = state.newSale.amount;
            const newBtc = newAmount / 55000; // Mock rate

            // Add to history
            const newSaleObj: Sale = {
                id: Date.now().toString(),
                amountUsd: newAmount,
                amountBtc: newBtc,
                timestamp: Date.now(),
                status: 'settled'
            };

            setSales(prev => [newSaleObj, ...prev]);

            // Update balance
            setBalance(prev => ({
                usd: prev.usd + newAmount,
                btc: prev.btc + newBtc
            }));

            // Clear state to prevent duplicate addition on refresh
            window.history.replaceState({}, '');
        }
    }, [location.state]);

    return (
        <div className="min-h-screen bg-black text-white p-6">
            <header className="max-w-4xl mx-auto flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <span className="font-bold text-xl">Strike Business</span>
                </div>
                <button className="text-sm text-gray-400 hover:text-white">Sign Out</button>
            </header>

            <main className="max-w-4xl mx-auto space-y-8">
                {/* Balance Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-3xl border border-gray-700 relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Total Balance (USD)</p>
                            <h2 className="text-4xl font-mono font-bold">${balance.usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
                        </div>
                        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
                            <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.78-1.72-2.38-1.72-2.15 0-2.44 1.15-2.44 1.41 0 .59.43 1.09 2.67 1.63 2.18.54 4.18 1.51 4.18 3.52 0 1.94-1.67 3.24-3.32 3.55z" /></svg>
                        </div>
                    </div>

                    <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 flex flex-col justify-between">
                        <div>
                            <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Bitcoin Held</p>
                            <h2 className="text-4xl font-mono font-bold text-orange-500">{balance.btc.toFixed(8)} <span className="text-lg text-gray-500">BTC</span></h2>
                        </div>
                        <div className="mt-4 flex gap-2">
                            <button className="flex-1 bg-gray-800 hover:bg-gray-700 py-2 rounded-lg text-sm font-medium transition-colors">Withdraw</button>
                            <button className="flex-1 bg-gray-800 hover:bg-gray-700 py-2 rounded-lg text-sm font-medium transition-colors">Deposit</button>
                        </div>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="flex justify-end">
                    <Link
                        to="/business/pos"
                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 shadow-lg shadow-blue-900/20 transform hover:-translate-y-1 transition-all"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                        Open POS Terminal
                    </Link>
                </div>

                {/* Recent Sales */}
                <div>
                    <h3 className="text-xl font-bold mb-4">Recent Transactions</h3>
                    <SalesHistory sales={sales} />
                </div>
            </main>
        </div>
    );
}
