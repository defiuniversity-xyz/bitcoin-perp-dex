import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>;
      signEvent: (event: { kind: number; content: string; tags: string[][]; created_at: number }) => Promise<{ sig: string; id: string }>;
    };
  }
}

type NostrContextValue = {
  pubkey: string | null;
  error: string | null;
  connect: () => Promise<string | null>;
  disconnect: () => void;
  signEvent: (kind: number, content: string, tags: string[][]) => Promise<{ kind: number; content: string; tags: string[][]; created_at: number; sig: string; id: string; pubkey: string }>;
};

const NostrContext = createContext<NostrContextValue | null>(null);

export function NostrProvider({ children }: { children: ReactNode }) {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setError(null);
    if (!window.nostr) {
      setError('Nostr extension (e.g. nos2x, Alby) not found. Please install one.');
      return null;
    }
    try {
      const pk = await window.nostr.getPublicKey();
      setPubkey(pk);
      return pk;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to connect';
      setError(msg);
      return null;
    }
  }, []);

  const signEvent = useCallback(
    async (kind: number, content: string, tags: string[][]) => {
      if (!window.nostr) throw new Error('Nostr extension not found');
      if (!pubkey) throw new Error('Not connected');
      const event = {
        kind,
        content,
        tags,
        created_at: Math.floor(Date.now() / 1000),
      };
      const { sig, id } = await window.nostr.signEvent(event);
      return { ...event, sig, id, pubkey };
    },
    [pubkey]
  );

  const disconnect = useCallback(() => {
    setPubkey(null);
    setError(null);
  }, []);

  const value: NostrContextValue = {
    pubkey,
    error,
    connect,
    disconnect,
    signEvent,
  };

  return <NostrContext.Provider value={value}>{children}</NostrContext.Provider>;
}

export function useNostrContext(): NostrContextValue {
  const ctx = useContext(NostrContext);
  if (!ctx) throw new Error('useNostrContext must be used within NostrProvider');
  return ctx;
}
