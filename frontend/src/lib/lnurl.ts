const LNURLP_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '';

/** Regex for Lightning Address: user@domain (LUD-16) */
const LIGHTNING_ADDRESS_REGEX = /^([a-z0-9_.+-]+)@([a-z0-9.-]+\.[a-z]{2,})$/i;

export function isLightningAddress(input: string): boolean {
  return LIGHTNING_ADDRESS_REGEX.test(input.trim());
}

export interface LnurlPayConfig {
  callback: string;
  minSendable: number;
  maxSendable: number;
  allowsNostr: boolean;
  nostrPubkey: string;
}

export async function fetchLnurlPayConfig(username: string): Promise<LnurlPayConfig> {
  const r = await fetch(`${LNURLP_BASE}/.well-known/lnurlp/${username}`);
  if (!r.ok) throw new Error('Failed to fetch LNURL config');
  return r.json();
}

export async function requestDepositInvoice(
  callback: string,
  amountMsats: number,
  zapRequestJson: string
): Promise<{ pr: string }> {
  const params = new URLSearchParams({
    amount: String(amountMsats),
    nostr: zapRequestJson,
  });
  const url = `${callback}?${params}`;
  const r = await fetch(url);
  if (!r.ok) {
    const err = await r.json();
    throw new Error(err.reason || 'Failed to get invoice');
  }
  return r.json();
}

/**
 * Resolve Lightning Address (user@domain) to BOLT11 invoice via LUD-16.
 * 1. GET https://domain/.well-known/lnurlp/user
 * 2. Call callback?amount=X to get invoice
 */
export async function resolveLightningAddressToInvoice(
  lightningAddress: string,
  amountMsats: number
): Promise<string> {
  const m = lightningAddress.trim().match(LIGHTNING_ADDRESS_REGEX);
  if (!m) throw new Error('Invalid Lightning Address format');
  const [, user, domain] = m;
  const configUrl = `https://${domain}/.well-known/lnurlp/${user}`;
  const configRes = await fetch(configUrl);
  if (!configRes.ok) throw new Error('Lightning Address not found');
  const config = (await configRes.json()) as {
    callback?: string;
    minSendable?: number;
    maxSendable?: number;
  };
  if (!config.callback) throw new Error('Invalid Lightning Address response');
  const { callback, minSendable, maxSendable } = config;
  const min = minSendable ?? 1000;
  const max = maxSendable ?? 100000000000;
  if (amountMsats < min || amountMsats > max)
    throw new Error(`Amount must be between ${min} and ${max} msats`);
  const params = new URLSearchParams({ amount: String(amountMsats) });
  const callbackUrl = `${callback}${callback.includes('?') ? '&' : '?'}${params}`;
  const invRes = await fetch(callbackUrl);
  if (!invRes.ok) {
    const err = (await invRes.json().catch(() => ({}))) as { reason?: string };
    throw new Error(err.reason || 'Failed to get invoice');
  }
  const data = (await invRes.json()) as { pr?: string };
  if (!data.pr) throw new Error('No invoice in response');
  return data.pr;
}
