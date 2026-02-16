interface BalanceDisplayProps {
  balanceMsats: number | null;
  savingsMsats?: number | null;
  savingsApy?: number;
  loading?: boolean;
}

export function BalanceDisplay({
  balanceMsats,
  savingsMsats = 0,
  savingsApy = 0,
  loading,
}: BalanceDisplayProps) {
  if (loading) {
    return (
      <div className="space-y-2 animate-pulse" role="status" aria-label="Loading balance">
        <div className="h-8 w-48 rounded bg-gray-700" aria-hidden />
        <div className="h-6 w-32 rounded bg-gray-700/70" aria-hidden />
      </div>
    );
  }
  if (balanceMsats === null) return null;

  const spendableSats = (balanceMsats / 1000).toFixed(0);
  const savingsSats = ((savingsMsats ?? 0) / 1000).toFixed(0);
  return (
    <div className="space-y-2">
      <div className="text-2xl font-mono">
        <span className="text-gray-400">Spendable: </span>
        <span className="text-white">{spendableSats}</span>
        <span className="text-gray-400 ml-1">sats</span>
      </div>
      {(savingsMsats ?? 0) > 0 && (
        <div className="text-lg font-mono text-amber-400/90">
          <span className="text-gray-500">Savings: </span>
          <span>{savingsSats}</span>
          <span className="text-gray-500 ml-1">sats</span>
          {savingsApy > 0 && (
            <span className="ml-2 text-gray-500 text-sm">({savingsApy}% APY)</span>
          )}
        </div>
      )}
    </div>
  );
}
