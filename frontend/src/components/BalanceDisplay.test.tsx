import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BalanceDisplay } from './BalanceDisplay';

describe('BalanceDisplay', () => {
  it('shows skeleton when loading', () => {
    render(<BalanceDisplay balanceMsats={null} loading />);
    expect(screen.getByRole('status', { name: 'Loading balance' })).toBeInTheDocument();
  });

  it('returns null when balance is null and not loading', () => {
    const { container } = render(<BalanceDisplay balanceMsats={null} loading={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays spendable balance', () => {
    render(<BalanceDisplay balanceMsats={100000} loading={false} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Spendable:')).toBeInTheDocument();
  });

  it('displays savings when > 0', () => {
    render(
      <BalanceDisplay
        balanceMsats={50000}
        savingsMsats={25000}
        savingsApy={5}
        loading={false}
      />
    );
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('Savings:')).toBeInTheDocument();
    expect(screen.getByText('(5% APY)')).toBeInTheDocument();
  });

  it('hides savings when 0', () => {
    render(<BalanceDisplay balanceMsats={100000} savingsMsats={0} loading={false} />);
    expect(screen.queryByText('Savings:')).not.toBeInTheDocument();
  });
});
