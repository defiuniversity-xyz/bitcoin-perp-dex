import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isLightningAddress,
  resolveLightningAddressToInvoice,
} from './lnurl';

describe('isLightningAddress', () => {
  it('returns true for valid Lightning Address format', () => {
    expect(isLightningAddress('satoshi@bitcoin.org')).toBe(true);
    expect(isLightningAddress('user@domain.com')).toBe(true);
    expect(isLightningAddress('alice+bob@example.co.uk')).toBe(true);
    expect(isLightningAddress('  user@domain.com  ')).toBe(true);
  });

  it('returns false for invalid formats', () => {
    expect(isLightningAddress('lnbc1...')).toBe(false);
    expect(isLightningAddress('user@')).toBe(false);
    expect(isLightningAddress('@domain.com')).toBe(false);
    expect(isLightningAddress('plaintext')).toBe(false);
    expect(isLightningAddress('')).toBe(false);
  });
});

describe('resolveLightningAddressToInvoice', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws for invalid format', async () => {
    await expect(resolveLightningAddressToInvoice('invalid', 1000)).rejects.toThrow(
      'Invalid Lightning Address format'
    );
  });

  it('fetches config and callback, returns invoice', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).includes('.well-known/lnurlp/')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              callback: 'https://example.com/callback',
              minSendable: 1000,
              maxSendable: 100000000,
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ pr: 'lnbc1invoice123' }),
      } as Response);
    });

    const result = await resolveLightningAddressToInvoice('user@example.com', 5000);
    expect(result).toBe('lnbc1invoice123');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    mockFetch.mockRestore();
  });

  it('throws when config missing callback', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ minSendable: 1000 }),
    } as Response);

    await expect(
      resolveLightningAddressToInvoice('user@example.com', 5000)
    ).rejects.toThrow('Invalid Lightning Address response');
  });
});
