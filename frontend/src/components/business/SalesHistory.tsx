export interface Sale {
    id: string;
    amountUsd: number;
    amountBtc: number;
    timestamp: number;
    status: 'settled' | 'pending';
}

export function SalesHistory({ sales }: { sales: Sale[] }) {
    return (
        <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
            <table className="w-full text-left">
                <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                    <tr>
                        <th className="px-6 py-4">Time</th>
                        <th className="px-6 py-4">Amount (USD)</th>
                        <th className="px-6 py-4">BTC</th>
                        <th className="px-6 py-4 text-right">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                    {sales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-gray-800/50">
                            <td className="px-6 py-4 text-sm text-gray-300">
                                {new Date(sale.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="px-6 py-4 font-bold text-white">
                                ${sale.amountUsd.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-400 font-mono">
                                {sale.amountBtc.toFixed(8)}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="bg-green-900/30 text-green-400 text-xs px-2 py-1 rounded-full border border-green-900">
                                    {sale.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                    {sales.length === 0 && (
                        <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                No transactions today.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
