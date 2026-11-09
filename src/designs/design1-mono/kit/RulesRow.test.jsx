import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RulesRow from './RulesRow';

describe('RulesRow', () => {
  it('is a button named by its action and described by the summary', () => {
    let clicks = 0;
    render(<RulesRow label="Rules" summary="6 games a set" actionLabel="Edit rules" onClick={() => { clicks += 1; }} />);
    const row = screen.getByRole('button', { name: 'Edit rules' });
    expect(row).toHaveAccessibleDescription('6 games a set');
    fireEvent.click(row);
    expect(clicks).toBe(1);
  });

  it('reports expanded state for an inline panel', () => {
    render(<RulesRow label="Players" summary="2 added" actionLabel="Hide players" expanded onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Hide players' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('is plain text when nothing can be edited', () => {
    render(<RulesRow label="Rules" summary="First to 21" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('First to 21')).toBeInTheDocument();
  });
});
