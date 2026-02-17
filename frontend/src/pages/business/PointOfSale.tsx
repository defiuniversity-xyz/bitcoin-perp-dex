import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Keypad } from '../../components/business/Keypad';
import { LightningInvoice } from '../../components/business/LightningInvoice';

export function PointOfSale() {
    const navigate = useNavigate();
    const [amount, setAmount] = useState('');
    const [view, setView] = useState<'input' | 'invoice'>('input');

    const handleKeyPress = (key: string) => {
        if (amount.includes('.') && key === '.') return;
        if (amount.length >= 7) return;
        setAmount(prev => prev + key);
    };

    const handleClear = () => {
        setAmount('');
    };

    const handleEnter = () => {
        if (!amount || parseFloat(amount) <= 0) return;
        setView('invoice');
    };

    const handlePaymentSuccess = () => {
        // Navigate back to dashboard after simulated "Paid" animation in the component
        setTimeout(() => {
            navigate('/business/dashboard', { state: { newSale: { amount: parseFloat(amount) } } });
        }, 1000);
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            {/* Header */}
            <header className="p-4 flex justify-between items-center bg-gray-900 border-b border-gray-800">
                <Link to="/business/dashboard" className="text-gray-400 hover:text-white flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Dashboard
                </Link>
                <div className="font-bold">POS Terminal #01</div>
                <div className="w-20"></div> {/* Spacer for center alignment */}
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-6">
                {view === 'input' ? (
                    <div className="w-full max-w-sm space-y-8">
                        {/* Amount Display */}
                        <div className="text-center space-y-2">
                            <p className="text-gray-500 uppercase tracking-widest text-xs font-bold">Enter Amount</p>
                            <div className="text-6xl font-mono font-bold flex items-center justify-center">
                                <span className="text-gray-600 mr-2">$</span>
                                {amount || '0.00'}
                            </div>
                        </div>

                        {/* Keypad */}
                        <Keypad
                            onKeyPress={handleKeyPress}
                            onClear={handleClear}
                            onEnter={handleEnter}
                            amount={amount}
                        />
                    </div>
                ) : (
                    <LightningInvoice
                        amountUsd={parseFloat(amount)}
                        onPaid={handlePaymentSuccess}
                        onCancel={() => setView('input')}
                    />
                )}
            </main>
        </div>
    );
}
