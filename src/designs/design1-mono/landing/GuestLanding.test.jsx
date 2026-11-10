import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalAuthProvider } from '../../../auth/AuthContext';
import { getSportsList } from '../../../models/sportRegistry';
import GuestLanding from './GuestLanding';
import { buildDemo } from './landingDemo';
import { LANDING_FAQ } from './landingFaq';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{`${location.pathname}${location.search}`}</output>;
}

function renderLanding({ cloudAuthAvailable = false } = {}) {
  return render(
    <LocalAuthProvider reason="missing-config" cloudAuthAvailable={cloudAuthAvailable}>
      <MemoryRouter>
        <LocationProbe />
        <Routes>
          <Route path="*" element={<GuestLanding />} />
        </Routes>
      </MemoryRouter>
    </LocalAuthProvider>,
  );
}

function pickFor(name) { return screen.getByRole('button', { name, exact: true }); }
function startLinks(name) { return screen.getAllByRole('link', { name }); }
describe('Home', () => {
  beforeEach(() => { localStorage.clear(); });

  afterEach(() => {
    cleanup();
  });

  it('keeps master actions and the selected sport together', () => {
    renderLanding();
    expect(startLinks('Start Cricket')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Create a free account' })).toBeInTheDocument();
    fireEvent.click(pickFor('Volleyball'));
    expect(startLinks('Start Volleyball')).toHaveLength(1);
    for (const link of startLinks('Start Volleyball')) expect(link).toHaveAttribute('href', '/play?sport=volleyball');
  });
  it('shows engine scores for every sport and reverses a demo tap', () => {
    renderLanding();
    for (const sport of getSportsList()) {
      fireEvent.click(pickFor(sport.name));
      const card = screen.getByTestId('landing-example');
      const initial = card.textContent;
      const demo = buildDemo(sport.id);
      fireEvent.click(within(card).getByRole('button', { name: `Score for ${demo.teams[1].name}` }));
      expect(card.textContent).not.toBe(initial);
      fireEvent.click(within(card).getByRole('button', { name: 'Undo' }));
      expect(card.textContent).toBe(initial);
    }
  });
  it('keeps FAQs collapsed and the structured data consistent', () => {
    const { container } = renderLanding();
    const rows = [...container.querySelectorAll('details')];
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row).not.toHaveAttribute('open');
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    expect(blocks.find(block => block['@type'] === 'FAQPage').mainEntity.map(item => [item.name, item.acceptedAnswer.text])).toEqual(LANDING_FAQ.map(item => [item.question, item.answer]));
  });
  it('remembers Start and Sign in clicks', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('link', { name: 'Sign in' }));
    expect(JSON.parse(localStorage.getItem('se_entered_app'))).toBe(true);
  });
});
