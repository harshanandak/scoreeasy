import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { StandingsTable } from './TournamentParts';

describe('StandingsTable accessible columns', () => {
  it('gives every row exactly one cell per column header, in header order', () => {
    const columns = [
      { header: 'Played', label: 'P' },
      { header: 'Won', label: 'W' },
      { header: 'Margin', label: '+/-' },
      { header: 'Points', label: 'Pts' },
    ];
    render(
      <StandingsTable
        label="Standings"
        columns={columns}
        rows={[
          { key: 'a', name: 'Alpha', values: [2, 2, 14, 4] },
          { key: 'b', name: 'Bravo', values: [2, 0, -8, 0] },
        ]}
      />,
    );

    const table = screen.getByRole('table', { name: 'Standings' });
    const headers = within(table).getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual(['Team', 'Played', 'Won', 'Margin', 'Points']);

    const [, alpha, bravo] = within(table).getAllByRole('row');
    for (const row of [alpha, bravo]) {
      const cells = [...row.querySelectorAll('[role="rowheader"], [role="cell"]')];
      expect(cells).toHaveLength(headers.length);
    }
    const alphaCells = [...alpha.querySelectorAll('[role="rowheader"], [role="cell"]')].map((cell) => cell.textContent);
    expect(alphaCells).toEqual(['1Alpha', '2', '2', '14', '4']);
  });
});
