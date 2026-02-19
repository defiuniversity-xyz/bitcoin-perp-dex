import { useState } from 'react'
import { toast } from 'sonner'
import { useWalletStore } from '../stores/useWalletStore'
import { depositCollateral, withdrawCollateral, getChallenge } from '../lib/futures-api'

type Tab = 'deposit' | 'withdraw'

async function signChallenge(pubkey: string): Promise<object> {
  const nip07 = (window as Window & {
    nostr?: { signEvent: (e: object) => Promise<object> }
  }).nostr
  if (!nip07) throw new Error('NIP-07 extension required')
  const { challenge } = await getChallenge(pubkey)
  const event = {
    kind: 1,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: challenge,
  }
  return nip07.signEvent(event)
}

export function Account() {
  const { pubkey, collateral_msats, refreshCollateral } = useWalletStore()
  const [tab, setTab] = useState<Tab>('deposit')
  const [amountSats, setAmountSats] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const collateralSats = Math.floor(collateral_msats / 1000)

  const handleDeposit = async () => {
    if (!pubkey) { toast.error('Connect wallet first'); return }
    const amount = parseInt(amountSats)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }
    setIsLoading(true)
    try {
      const signed = await signChallenge(pubkey)
      await depositCollateral({ pubkey, amount_msats: amount * 1000, signed_challenge: signed })
      await refreshCollateral()
      toast.success(`Deposited ${amount.toLocaleString()} sats into futures collateral`)
      setAmountSats('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Deposit failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleWithdraw = async () => {
    if (!pubkey) { toast.error('Connect wallet first'); return }
    const amount = parseInt(amountSats)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }
    if (amount > collateralSats) { toast.error('Insufficient collateral'); return }
    setIsLoading(true)
    try {
      const signed = await signChallenge(pubkey)
      await withdrawCollateral({ pubkey, amount_msats: amount * 1000, signed_challenge: signed })
      await refreshCollateral()
      toast.success(`Withdrew ${amount.toLocaleString()} sats to bank balance`)
      setAmountSats('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Withdrawal failed')
    } finally {
      setIsLoading(false)
    }
  }

  if (!pubkey) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="text-4xl">◎</div>
        <div className="text-xl font-semibold text-white">Connect Your Wallet</div>
        <div className="text-gray-400 text-center max-w-sm">
          Use a NIP-07 browser extension (Alby or nos2x) to connect your Nostr identity
          and manage your futures collateral.
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Account</h1>

      {/* Identity */}
      <div className="panel p-5 space-y-3">
        <div className="text-sm font-semibold text-gray-300 mb-3">Identity</div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-long animate-pulse" />
          <span className="text-xs text-gray-400">Nostr pubkey</span>
        </div>
        <div className="bg-navy-900 rounded-lg px-3 py-2 font-mono text-xs text-gray-300 break-all">
          {pubkey}
        </div>
      </div>

      {/* Balances */}
      <div className="panel p-5">
        <div className="text-sm font-semibold text-gray-300 mb-4">Balances</div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-white font-medium">Futures Collateral</div>
              <div className="text-xs text-gray-500">Available for trading</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-mono font-bold text-white">
                {collateralSats.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">sats</div>
            </div>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Transfer sats between bank balance and futures collateral below.</span>
          </div>
        </div>
      </div>

      {/* Transfer */}
      <div className="panel">
        <div className="flex border-b border-border">
          {(['deposit', 'withdraw'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? 'text-white border-b-2 border-btc-orange'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'deposit' ? '→ To Futures' : '← To Bank'}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Amount (sats)</label>
            <input
              type="number"
              placeholder="0"
              value={amountSats}
              onChange={(e) => setAmountSats(e.target.value)}
              className="input-field"
            />
            {tab === 'withdraw' && (
              <button
                className="text-xs text-btc-orange hover:underline mt-1"
                onClick={() => setAmountSats(String(collateralSats))}
              >
                Max: {collateralSats.toLocaleString()} sats
              </button>
            )}
          </div>

          <div className="bg-navy-900 rounded-lg p-3 text-xs text-gray-400 space-y-1">
            {tab === 'deposit' ? (
              <>
                <div>Transfers from your Bitcoin Bank balance to futures collateral.</div>
                <div>Collateral is used as margin for open positions.</div>
              </>
            ) : (
              <>
                <div>Returns collateral to your Bitcoin Bank spendable balance.</div>
                <div>Cannot withdraw collateral locked in open positions.</div>
              </>
            )}
          </div>

          <button
            onClick={tab === 'deposit' ? handleDeposit : handleWithdraw}
            disabled={isLoading || !amountSats}
            className="btn-primary w-full"
          >
            {isLoading
              ? 'Processing…'
              : tab === 'deposit'
              ? `→ Deposit to Futures`
              : `← Withdraw to Bank`}
          </button>
        </div>
      </div>

      {/* Protocol info */}
      <div className="panel p-5 space-y-3">
        <div className="text-sm font-semibold text-gray-300">How it works</div>
        {[
          ['1', 'Your Nostr pubkey is your identity — no account needed'],
          ['2', 'Deposit sats from your bank balance into futures collateral'],
          ['3', 'Use collateral as margin to open leveraged positions'],
          ['4', 'All orders are signed with your NIP-07 extension'],
          ['5', 'Orderbook is published live to Nostr relays (Kind 30051)'],
        ].map(([n, text]) => (
          <div key={n} className="flex gap-3 text-sm text-gray-400">
            <span className="text-btc-orange font-bold flex-shrink-0">{n}.</span>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
