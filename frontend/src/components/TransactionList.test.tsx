import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransactionList } from './TransactionList';

describe('TransactionList', () => {
  it('shows empty state when no transactions', () => {
    render(<TransactionList transactions={[]} />);
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });

  it('renders transactions with human-readable labels', () => {
    const transactions = [
      { type: 'deposit', amount_msats: 10000, created_at: Math.floor(Date.now() / 1000) },
      { type: 'withdrawal', amount_msats: -5000, created_at: Math.floor(Date.now() / 1000) },
      { type: 'savings_add', amount_msats: -2000, created_at: Math.floor(Date.now() / 1000) },
      { type: 'transfer_in', amount_msats: 3000, created_at: Math.floor(Date.now() / 1000) },
      { type: 'transfer_out', amount_msats: -1000, created_at: Math.floor(Date.now() / 1000) },
    ];
    render(<TransactionList transactions={transactions} />);
    expect(screen.getByText('Deposit')).toBeInTheDocument();
    expect(screen.getByText('Withdrawal')).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText('Sent')).toBeInTheDocument();
  });

  it('formats amounts correctly', () => {
    const transactions = [
      { type: 'deposit', amount_msats: 15000, created_at: 1700000000 },
    ];
    render(<TransactionList transactions={transactions} />);
    expect(screen.getByText((_, el) => el?.textContent === '+15 sats')).toBeInTheDocument();
  });
});
