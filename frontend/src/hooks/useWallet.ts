import { useState, useCallback } from 'react';

declare global {
  interface Window {
    webln?: {
      enable: () => Promise<void>;
      sendPayment: (invoice: string) => Promise<{ preimage: string }>;
    };
  }
}

export function useWallet() {
  const [enabled, setEnabled] = useState(false);

  const enable = useCallback(async () => {
    if (!window.webln) {
      throw new Error('Lightning wallet (e.g. Alby) not found. Please install one.');
    }
    await window.webln.enable();
    setEnabled(true);
  }, []);

  const payInvoice = useCallback(async (invoice: string) => {
    if (!window.webln) throw new Error('Lightning wallet not found');
    return window.webln.sendPayment(invoice);
  }, []);

  return { enabled, enable, payInvoice };
}
