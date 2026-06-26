import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ reportSpy: vi.fn().mockResolvedValue({ ok: true }) }));

vi.mock('../../../../convex/_generated/api', () => ({ api: { live: { report: 'live:report' } } }));
vi.mock('convex/react', () => ({ useMutation: () => h.reportSpy }));
vi.mock('../../../lib/live/reporterId', () => ({ getReporterId: () => 'reporter-xyz' }));

import ReportMatch from './ReportMatch';

beforeEach(() => h.reportSpy.mockClear());

describe('ReportMatch (q7k report affordance)', () => {
  it('reports the match with the chosen reason + reporter id, then confirms', async () => {
    render(<ReportMatch token="TOK123" />);

    fireEvent.click(screen.getByRole('button', { name: 'Report' }));
    // Reason picker opens.
    expect(screen.getByRole('dialog', { name: 'Report match' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hate speech' }));

    await waitFor(() =>
      expect(h.reportSpy).toHaveBeenCalledWith({
        token: 'TOK123',
        reason: 'hate',
        reporterId: 'reporter-xyz',
      }),
    );
    expect(screen.getByText(/reported for review/i)).toBeInTheDocument();
  });

  it('cancel closes the picker without reporting', () => {
    render(<ReportMatch token="TOK123" />);
    fireEvent.click(screen.getByRole('button', { name: 'Report' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.reportSpy).not.toHaveBeenCalled();
  });
});
