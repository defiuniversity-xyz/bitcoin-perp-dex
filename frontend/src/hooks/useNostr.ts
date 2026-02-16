import { useNostrContext } from '../contexts/NostrContext';

export function useNostr() {
  return useNostrContext();
}
