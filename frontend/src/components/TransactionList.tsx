interface Tx {
  type: string;
  amount_msats: number;
  counterparty_pubkey?: string;
  created_at: number;
}

interface TransactionListProps {
  transactions: Tx[];
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleString();
}

function formatAmount(amount: number) {
  const sats = Math.abs(amount / 1000);
  return amount >= 0 ? `+${sats}` : `-${sats}`;
}

const TYPE_LABELS: Record<string, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  savings_add: 'Saved',
  savings_remove: 'Withdrawn from savings',
  yield_credit: 'Yield earned',
  transfer_in: 'Received',
  transfer_out: 'Sent',
};

function formatType(type: string): string {
  return TYPE_LABELS[type] ?? type.replace(/_/g, ' ');
}

export function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) {
    return <p className="text-gray-500 text-sm">No transactions yet</p>;
  }

  return (
    <ul className="space-y-2">
      {transactions.map((tx, i) => (
        <li
          key={i}
          className="flex justify-between items-center py-2 border-b border-gray-700 text-sm"
        >
          <span className="text-gray-400">{formatDate(tx.created_at)}</span>
          <span className={tx.amount_msats >= 0 ? 'text-green-400' : 'text-red-400'}>
            {formatAmount(tx.amount_msats)} sats
          </span>
          <span className="text-gray-500">{formatType(tx.type)}</span>
        </li>
      ))}
    </ul>
  );
}
