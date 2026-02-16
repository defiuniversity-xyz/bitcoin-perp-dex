import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNostr } from '../hooks/useNostr';
import { useBalance } from '../hooks/useBalance';
import { getCardStatus, applyCard, topUpCard, simulateSpend, getChallenge } from '../lib/api';
import { ConnectWallet } from '../components/ConnectWallet';

export function Card() {
    const { pubkey, signEvent } = useNostr();
    const { balanceMsats, refresh } = useBalance(pubkey); // Refresh to update BTC balance after topup

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [cardStatus, setCardStatus] = useState<{
        has_card: boolean;
        console_address?: string;
        balance_usdc?: number;
        chain_id?: number;
    } | null>(null);

    const [topUpAmount, setTopUpAmount] = useState('');
    const [spendAmount, setSpendAmount] = useState('');
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    useEffect(() => {
        if (pubkey) {
            loadStatus();
        }
    }, [pubkey]);

    const loadStatus = async () => {
        if (!pubkey) return;
        try {
            const status = await getCardStatus(pubkey);
            setCardStatus(status);
        } catch (e) {
            console.error(e);
            setError('Failed to load card status');
        }
    };

    const handleApply = async () => {
        if (!pubkey || !signEvent) return;
        setLoading(true);
        setError(null);
        try {
            const { challenge } = await getChallenge(pubkey);
            const signed = await signEvent(1, challenge, []);
            await applyCard(pubkey, signed);
            await loadStatus();
            setSuccessMsg("Card issued successfully!");
        } catch (e: any) {
            setError(e.message || "Failed to apply");
        } finally {
            setLoading(false);
        }
    };

    const handleTopUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pubkey || !signEvent || !topUpAmount) return;

        setLoading(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const msats = parseInt(topUpAmount);
            if (isNaN(msats) || msats <= 0) throw new Error("Invalid amount");

            const { challenge } = await getChallenge(pubkey);
            const signed = await signEvent(1, challenge, []);

            const res = await topUpCard(pubkey, msats, signed);
            await loadStatus();
            await refresh(); // Update BTC balance
            setSuccessMsg(`Top-up successful! Credited ${res.credited_usdc} USDC.`);
            setTopUpAmount('');
        } catch (e: any) {
            setError(e.message || "Top-up failed");
        } finally {
            setLoading(false);
        }
    };

    const handleSpend = async () => {
        if (!pubkey || !signEvent || !spendAmount) return;
        setLoading(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const usdc = parseFloat(spendAmount);
            if (isNaN(usdc) || usdc <= 0) throw new Error("Invalid amount");

            const { challenge } = await getChallenge(pubkey);
            const signed = await signEvent(1, challenge, []);

            await simulateSpend(pubkey, usdc, signed);
            await loadStatus();
            setSuccessMsg(`Spend successful: $${usdc}`);
            setSpendAmount('');
        } catch (e: any) {
            setError(e.message || "Spend failed");
        } finally {
            setLoading(false);
        }
    };

    if (!pubkey) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8">
                <ConnectWallet />
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6 max-w-2xl mx-auto">
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <Link to="/" className="text-gray-400 hover:text-white">&larr; Back</Link>
                    <h1 className="text-xl font-bold">Bitcoin Bank Card</h1>
                </div>
                <ConnectWallet />
            </header>

            {error && <div className="p-4 bg-red-900/50 text-red-200 rounded mb-4">{error}</div>}
            {successMsg && <div className="p-4 bg-green-900/50 text-green-200 rounded mb-4">{successMsg}</div>}

            {!cardStatus?.has_card ? (
                <div className="bg-gray-800 p-8 rounded-lg text-center space-y-4">
                    <h2 className="text-2xl font-bold text-white">Get the Bitcoin Bank Card</h2>
                    <p className="text-gray-400">
                        Spend your Bitcoin anywhere. Powered by Brahma Console on Base.
                        <br />
                        Requires depositing Bitcoin to mint Spendable USDC.
                    </p>
                    <button
                        onClick={handleApply}
                        disabled={loading}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium disabled:opacity-50"
                    >
                        {loading ? 'Issuing...' : 'Apply for Card'}
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Card Visual */}
                    <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-6 rounded-xl shadow-lg text-white h-48 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" /></svg>
                        </div>
                        <div className="flex justify-between items-start">
                            <span className="font-bold text-lg tracking-wider">BITCOIN BANK</span>
                            <span className="bg-white/20 px-2 py-1 rounded text-xs">DEBIT</span>
                        </div>
                        <div>
                            <p className="text-sm opacity-75">Balance</p>
                            <p className="text-3xl font-mono">${cardStatus.balance_usdc?.toFixed(2)}</p>
                        </div>
                        <div className="flex justify-between items-end">
                            <p className="font-mono text-xs opacity-75 truncate max-w-[200px]">{cardStatus.console_address}</p>
                            <span className="text-xs">Base Network</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Top Up */}
                        <div className="bg-gray-800 p-6 rounded-lg space-y-4">
                            <h3 className="text-lg font-medium">Top Up Card</h3>
                            <p className="text-sm text-gray-400">Convert Spendable BTC to Card USDC.</p>
                            <p className="text-xs text-gray-500">Available: {balanceMsats} msats</p>
                            <form onSubmit={handleTopUp} className="space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Amount (msats)</label>
                                    <input
                                        type="number"
                                        value={topUpAmount}
                                        onChange={e => setTopUpAmount(e.target.value)}
                                        className="w-full bg-gray-700 rounded p-2 text-white border border-gray-600 focus:border-blue-500 outline-none"
                                        placeholder="e.g. 10000"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || !topUpAmount}
                                    className="w-full py-2 bg-green-600 hover:bg-green-500 rounded text-white disabled:opacity-50"
                                >
                                    {loading ? 'Processing...' : 'Top Up'}
                                </button>
                            </form>
                        </div>

                        {/* Simulated Spend */}
                        <div className="bg-gray-800 p-6 rounded-lg space-y-4">
                            <h3 className="text-lg font-medium">Simulate Spend</h3>
                            <p className="text-sm text-gray-400">Test the card at a merchant.</p>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Amount (USDC)</label>
                                    <input
                                        type="number"
                                        value={spendAmount}
                                        onChange={e => setSpendAmount(e.target.value)}
                                        className="w-full bg-gray-700 rounded p-2 text-white border border-gray-600 focus:border-blue-500 outline-none"
                                        placeholder="e.g. 5.00"
                                    />
                                </div>
                                <button
                                    onClick={handleSpend}
                                    disabled={loading || !spendAmount}
                                    className="w-full py-2 bg-amber-600 hover:bg-amber-500 rounded text-white disabled:opacity-50"
                                >
                                    {loading ? 'Spending...' : 'Buy Coffee ($5)'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="text-center text-xs text-gray-500">
                        Powered by Brahma ConsoleKit • Base Testnet Simulation
                    </div>
                </div>
            )}
        </div>
    );
}
