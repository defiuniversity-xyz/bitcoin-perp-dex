import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';

interface LightningInvoiceProps {
    amountUsd: number;
    onPaid: () => void;
    onCancel: () => void;
}

export function LightningInvoice({ amountUsd, onPaid, onCancel }: LightningInvoiceProps) {
    const [timeLeft, setTimeLeft] = useState(60);
    const [status, setStatus] = useState<'pending' | 'paid'>('pending');

    // Mock Invoice String
    const mockInvoice = `lnbc${amountUsd * 10000}0n1...mock...invoice...string`;

    useEffect(() => {
        // Simulate payment after random time (3-8 seconds)
        const timeout = setTimeout(() => {
            setStatus('paid');
            setTimeout(onPaid, 1500); // Wait a bit to show success state
        }, Math.random() * 5000 + 3000);

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            clearTimeout(timeout);
            clearInterval(timer);
        };
    }, [onPaid]);

    if (status === 'paid') {
        return (
            <div className="flex flex-col items-center justify-center h-96 animate-pulse">
                <div className="bg-green-500 rounded-full p-6 mb-4">
                    <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h2 className="text-3xl font-bold text-white">Paid!</h2>
                <p className="text-gray-400 mt-2">${amountUsd.toFixed(2)} received</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center p-6 bg-white rounded-3xl max-w-sm mx-auto shadow-2xl">
            <h3 className="text-black font-bold text-xl mb-4">Scan to Pay</h3>
            <div className="bg-white p-2 rounded">
                <QRCode value={mockInvoice} size={256} />
            </div>
            <div className="mt-6 w-full flex justify-between items-center">
                <div>
                    <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Amount</p>
                    <p className="text-black text-2xl font-mono font-bold">${amountUsd.toFixed(2)}</p>
                </div>
                <div className="text-right">
                    <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Expires</p>
                    <p className="text-red-500 font-mono font-bold">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</p>
                </div>
            </div>
            <button
                onClick={onCancel}
                className="mt-6 text-gray-400 hover:text-red-500 text-sm font-medium"
            >
                Cancel Payment
            </button>
        </div>
    );
}
