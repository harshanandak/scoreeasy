import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MonoPlayHub from './MonoPlayHub';
import { getSportsByCategory, getSportsList } from '../../models/sportRegistry';
import { SPORT_ORDER } from '../../models/sportFocus';
import { sportIdentity } from '../../lib/sportIdentity';
import { contrastReport } from '../../lib/teamColour';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}</output>;
}

function renderPlayHub(path = '/play') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        <Route path="/play" element={<MonoPlayHub />} />
        <Route path="/:sport/quick" element={<p>Quick setup</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const tilesIn = (name) => within(screen.getByRole('region', { name })).getAllByRole('button', { name: /^Quick match: / });

describe('MonoPlayHub (Kit S1)', () => {
  it('shows all nine sports in sportFocus order: Popular 6 in two columns, More sports 3 in three', () => {
    const { container } = renderPlayHub();

    expect(screen.getByRole('heading', { level: 1, name: 'What are we scoring?' })).toBeInTheDocument();
    const popular = tilesIn('Popular');
    const more = tilesIn('More sports');
    expect(popular).toHaveLength(6);
    expect(more).toHaveLength(3);

    const shown = [...popular, ...more].map((tile) => tile.dataset.sport);
    const registered = getSportsList().map((sport) => sport.id);
    expect(shown).toEqual(registered);
    expect(shown).toEqual(SPORT_ORDER.filter((id) => registered.includes(id)));
    expect(shown).toHaveLength(9);

    expect(popular[0].parentElement).toHaveClass('kit-grid2');
    expect(more[0].parentElement).toHaveClass('kit-grid3');
    expect(container.querySelector('.kit-grid2').children).toHaveLength(6);
    expect(container.querySelector('.kit-grid3').children).toHaveLength(3);
  });

  it('gives Popular tiles their hint line and keeps More sports to the name', () => {
    renderPlayHub();
    const { Popular, 'More sports': more } = getSportsByCategory();

    for (const [tile, sport] of tilesIn('Popular').map((t, i) => [t, Popular[i]])) {
      expect(tile).toHaveTextContent(sport.name);
      expect(tile).toHaveTextContent(sport.desc);
    }
    for (const [tile, sport] of tilesIn('More sports').map((t, i) => [t, more[i]])) {
      expect(tile.textContent).toBe(sport.name);
    }
  });

  // The label colour and every surface under it come only from the engine, and those exact
  // surfaces are measured: >= 4.5:1 on each stop, the sheen and the mark (contrastReport).
  it('paints each tile from its measured identity, and every tile label clears 4.5:1', () => {
    renderPlayHub();
    for (const tile of screen.getAllByRole('button', { name: /^Quick match: / })) {
      const id = tile.dataset.sport;
      const identity = sportIdentity(id);
      expect(tile.style.getPropertyValue('--sport-on')).toBe(identity.on);
      expect(tile.style.getPropertyValue('--sport-hi')).toBe(identity.hi);
      expect(tile.style.getPropertyValue('--sport-core')).toBe(identity.core);
      expect(tile.style.getPropertyValue('--sport-lo')).toBe(identity.lo);
      expect(tile.style.getPropertyValue('--sport-mark')).toMatch(/^url\(/);

      const labelRows = contrastReport({ [id]: identity }).filter(([label]) => label.includes('label on'));
      expect(labelRows.length).toBeGreaterThan(0);
      for (const [label, ratio] of labelRows) expect(ratio, `${label}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('starts a quick match for the tapped sport', async () => {
    renderPlayHub();

    fireEvent.click(screen.getByRole('button', { name: 'Quick match: Cricket' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/cricket/quick');
    });
    expect(screen.getByText('Quick setup')).toBeInTheDocument();
  });

  // /play?sport=<id> comes from marketing sport links and the quick scorer's Back.
  describe('a requested sport (?sport=)', () => {
    let scrolled;
    beforeEach(() => {
      scrolled = [];
      Element.prototype.scrollIntoView = vi.fn(function scrollIntoView(options) { scrolled.push([this, options]); });
    });
    afterEach(() => {
      delete Element.prototype.scrollIntoView;
    });

    it.each(['/play?sport=hockey', '/play?sport=HOCKEY'])('%s rings the Hockey tile and scrolls it into view', (path) => {
      const { container } = renderPlayHub(path);
      const hockey = screen.getByRole('button', { name: 'Quick match: Hockey' });

      expect(hockey).toHaveClass('is-selected');
      expect(hockey).toHaveAttribute('aria-current', 'true');
      expect(container.querySelectorAll('.kit-tile.is-selected')).toHaveLength(1);
      expect(container.querySelectorAll('[aria-current]')).toHaveLength(1);
      expect(scrolled).toEqual([[hockey, { block: 'center' }]]);
      // Selected is an ink ring, not a new colour: the tile keeps its own identity vars.
      expect(hockey.style.getPropertyValue('--sport-core')).toBe(sportIdentity('hockey').core);
    });

    it.each(['/play?sport=chess', '/play?sport=toString', '/play?sport=', '/play'])('%s highlights nothing and does not scroll', (path) => {
      const { container } = renderPlayHub(path);
      expect(screen.getAllByRole('button', { name: /^Quick match: / })).toHaveLength(9);
      expect(container.querySelector('.kit-tile.is-selected')).toBeNull();
      expect(container.querySelector('[aria-current]')).toBeNull();
      expect(scrolled).toEqual([]);
    });

    it('still starts that sport from its ringed tile', async () => {
      renderPlayHub('/play?sport=volleyball');
      fireEvent.click(screen.getByRole('button', { name: 'Quick match: Volleyball' }));
      await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/volleyball/quick'));
    });
  });

  it('has exactly one h1 and no Go on the hub (a tile is the choice)', () => {
    const { container } = renderPlayHub();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(container.querySelector('.se-go')).toBeNull();
  });
});
