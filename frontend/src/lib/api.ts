import { getApiUrl } from './config';

const API_BASE = getApiUrl('/api');

export async function getBalance(
  pubkey: string
): Promise<{ balance_msats: number; savings_msats?: number; savings_apy?: number }> {
  const r = await fetch(`${API_BASE}/balance/${pubkey}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function savingsAdd(
  pubkey: string,
  amountMsats: number,
  signedChallenge: Record<string, unknown>
) {
  const r = await fetch(`${API_BASE}/savings/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubkey,
      amount_msats: amountMsats,
      signed_challenge: signedChallenge,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || data.error || 'Add to savings failed');
  return data;
}

export async function savingsRemove(
  pubkey: string,
  amountMsats: number,
  signedChallenge: Record<string, unknown>
) {
  const r = await fetch(`${API_BASE}/savings/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubkey,
      amount_msats: amountMsats,
      signed_challenge: signedChallenge,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || data.error || 'Remove from savings failed');
  return data;
}

export async function getTransactions(
  pubkey: string,
  limit = 20
): Promise<{ transactions: Array<{ type: string; amount_msats: number; counterparty_pubkey?: string; created_at: number }> }> {
  const r = await fetch(`${API_BASE}/transactions/${pubkey}?limit=${limit}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getChallenge(pubkey: string): Promise<{ challenge: string; expires_at: number }> {
  const r = await fetch(`${API_BASE}/challenge?pubkey=${encodeURIComponent(pubkey)}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Failed to get challenge');
  return data;
}

export async function withdraw(
  pubkey: string,
  invoice: string,
  signedChallenge: Record<string, unknown>,
  amountMsats?: number
) {
  const r = await fetch(`${API_BASE}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubkey,
      invoice,
      amount_msats: amountMsats,
      signed_challenge: signedChallenge,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || data.error || 'Withdraw failed');
  return data;
}

export async function nwcConnect(
  pubkey: string,
  signedChallenge: Record<string, unknown>
): Promise<{ connection_uri: string }> {
  const r = await fetch(`${API_BASE}/nwc/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pubkey, signed_challenge: signedChallenge }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'NWC connect failed');
  return data;
}

export async function transfer(signedEvent: Record<string, unknown>) {
  const r = await fetch(`${API_BASE}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signed_event: signedEvent }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || data.error || 'Transfer failed');
  return data;
}

export async function getCardStatus(pubkey: string): Promise<{
  has_card: boolean;
  console_address?: string;
  chain_id?: number;
  balance_usdc?: number;
}> {
  const r = await fetch(`${API_BASE}/card/status/${pubkey}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function applyCard(pubkey: string, signedChallenge: Record<string, unknown>) {
  const r = await fetch(`${API_BASE}/card/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pubkey, signed_challenge: signedChallenge }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Failed to apply for card');
  return data;
}

export async function topUpCard(
  pubkey: string,
  amountMsats: number,
  signedChallenge: Record<string, unknown>
) {
  const r = await fetch(`${API_BASE}/card/topup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubkey,
      amount_msats: amountMsats,
      signed_challenge: signedChallenge,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Top-up failed');
  return data;
}

export async function simulateSpend(
  pubkey: string,
  amountUsdc: number,
  signedChallenge: Record<string, unknown>
) {
  const r = await fetch(`${API_BASE}/card/simulate-spend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubkey,
      amount_usdc: amountUsdc,
      signed_challenge: signedChallenge,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Spend simulation failed');
  return data;
}
