import { matchStorageKey } from '../../utils/accountStorage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DEFAULT_TEAM_COLOURS, deriveTeamColours } from '../../lib/teamColour';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MonoQuickMatch from './MonoQuickMatch';
import * as sportRegistry from '../../models/sportRegistry';
import { closeOpenSheet, findTeamColourGroup, findTeamNameInput, goToSetupStep, teamColourGroup, teamNameInput } from '../../test/teamColour';

vi.mock('convex/react', () => ({
  useConvex: () => ({ query: async () => null }),
  useMutation: () => vi.fn(),
  useQuery: () => [],
}));

function renderQuickMatch(initialEntry = '/volleyball/quick') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/:sport/quick" element={<MonoQuickMatch />} />
        <Route path="/:sport/quick/test-match/:matchId" element={<p>Cricket Test Match scorer</p>} />
        <Route path="/:sport/quick/live/:matchId" element={<p>Real tennis scorer</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="current-route">{`${location.pathname}${location.search}`}</output>;
}

function renderQuickMatchWithLocation(initialEntry = '/football/quick') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route path="/play" element={<p>Play chooser</p>} />
        <Route path="/:sport/quick" element={<MonoQuickMatch />} />
        <Route path="/:sport/tournament" element={<p>Tournament setup</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderQuickMatchWithSwitcher(initialEntry = '/volleyball/quick') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Link to="/cricket/quick">Switch to cricket</Link>
      <Link to="/cricket/quick?format=gully">Switch to gully cricket</Link>
      <Link to="/volleyball/quick">Switch to volleyball</Link>
      <Routes>
        <Route path="/:sport/quick" element={<MonoQuickMatch />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MonoQuickMatch setup clarity', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.history.replaceState(null, '', '/');
  });

  it('opens volleyball quick match on labeled teams with an immediate start path', async () => {
    renderQuickMatch();

    expect(await screen.findByRole('radio', { name: 'Best of 3' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('heading', { level: 1, name: 'Volleyball' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start volleyball' })).toBeEnabled();
    expect(screen.queryByText('Format Mode')).not.toBeInTheDocument();
    expect(await findTeamNameInput('A')).toHaveValue('Team A');
    expect(teamNameInput('B')).toHaveValue('Team B');
  });

  it('keeps the start control focusable + aria-disabled with linked guidance when names are missing', async () => {
    renderQuickMatch();

    fireEvent.change(await findTeamNameInput('B'), {
      target: { value: '' },
    });
    closeOpenSheet();

    const start = screen.getByRole('button', { name: 'Start volleyball' });
    // Not hard-disabled — it stays focusable/tappable so a tap can surface guidance
    // and screen readers announce it, but it is flagged aria-disabled and described
    // by the hint.
    expect(start).toBeEnabled();
    expect(start).toHaveAttribute('aria-disabled', 'true');
    expect(start).toHaveAttribute('aria-describedby', 'start-match-hint');
    expect(screen.getByText('Add both team names to start the match.')).toHaveAttribute('id', 'start-match-hint');

    // Tapping it with a missing name must NOT start the match (startMatch self-guards).
    fireEvent.click(start);
    expect(teamNameInput('A')).toBeInTheDocument();
  });

  it('uses the selected sport name in the setup start action', async () => {
    renderQuickMatch('/football/quick');

    expect(await screen.findByRole('button', { name: 'Start football' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Start Match' })).not.toBeInTheDocument();
  });

  it('falls back to the sport chooser when direct-entry setup back has no prior route', async () => {
    globalThis.history.replaceState({ idx: 0 }, '', '/football/quick');
    renderQuickMatchWithLocation({ pathname: '/football/quick', key: 'redirected-entry' });

    fireEvent.click(await screen.findByRole('button', { name: 'Go back' }));

    expect(screen.getByTestId('current-route')).toHaveTextContent('/play?sport=football');
  });

  it('starts tennis quick matches in the real tennis scorer without creating completed history', async () => {
    renderQuickMatch('/tennis/quick');

    fireEvent.click(await screen.findByRole('button', { name: 'Start tennis' }));

    expect(await screen.findByText('Real tennis scorer')).toBeInTheDocument();
    expect(JSON.parse(globalThis.localStorage.getItem(matchStorageKey('se_quickmatches')) || '[]')).toHaveLength(0);
    let draftKey = null;
    for (let index = 0; index < globalThis.localStorage.length; index += 1) {
      const key = globalThis.localStorage.key(index);
      if (key?.startsWith(matchStorageKey('se_tennis_quick_draft_'))) draftKey = key;
    }
    expect(draftKey).toBeTruthy();
    expect(JSON.parse(globalThis.localStorage.getItem(matchStorageKey(draftKey)))).toMatchObject({
      sport: 'tennis',
      team1: 'Team A',
      team2: 'Team B',
      status: 'in-progress',
    });
  });

  it('starts cricket Test Match quick matches on the product scorer route', async () => {
    renderQuickMatch({ pathname: '/cricket/quick', search: '?format=test' });

    fireEvent.click(await screen.findByRole('button', { name: 'Start cricket' }));

    expect(await screen.findByText('Cricket Test Match scorer')).toBeInTheDocument();
    expect(JSON.parse(globalThis.localStorage.getItem(matchStorageKey('se_quickmatches')) || '[]')).toEqual([
      expect.objectContaining({
        sport: 'cricket',
        status: 'in-progress',
        format: expect.objectContaining({ id: 'test', totalInnings: 4 }),
      }),
    ]);
  });

  it('resets cricket rules when switching into cricket on the same quick route', async () => {
    renderQuickMatchWithSwitcher('/volleyball/quick');

    expect(await screen.findByRole('button', { name: 'Start volleyball' })).toBeEnabled();

    fireEvent.click(screen.getByRole('link', { name: 'Switch to cricket' }));

    expect(await screen.findByRole('button', { name: 'Start cricket' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: 'T20' })).toHaveAttribute('aria-checked', 'true');
    // The rules line now lives in the Rules step, not under the Game cards.
    goToSetupStep('Rules');
    expect(screen.getByRole('heading', { level: 2, name: /^T20 · 20 overs · 11 players · 1 innings each/ })).toBeInTheDocument();
  });

  it('opens cricket query presets on the matching setup step after route switches', async () => {
    renderQuickMatchWithSwitcher('/volleyball/quick');

    expect(await screen.findByRole('button', { name: 'Start volleyball' })).toBeEnabled();

    fireEvent.click(screen.getByRole('link', { name: 'Switch to gully cricket' }));

    expect(await screen.findByRole('button', { name: 'Start cricket' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: 'Gully' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Rules' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Game', current: 'step' })).toBeInTheDocument();
  });

  it('resets non-cricket rules after leaving a cricket query preset', async () => {
    renderQuickMatchWithSwitcher('/cricket/quick?format=gully');

    expect(await screen.findByRole('button', { name: 'Start cricket' })).toBeEnabled();

    fireEvent.click(screen.getByRole('link', { name: 'Switch to volleyball' }));

    expect(await screen.findByRole('button', { name: 'Start volleyball' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: 'Best of 3' })).toHaveAccessibleDescription(/25 points a set · win by 2 · decider to 15 · cap 27/);
    expect(screen.queryByRole('radio', { name: 'Gully' })).not.toBeInTheDocument();
  });

  it('keeps optional player entry behind one roster section after both teams', async () => {
    renderQuickMatch();

    fireEvent.click(await screen.findByRole('button', { name: 'Teams' }));
    expect(await screen.findByRole('button', { name: 'Add players' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search @username or type name')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add players' }));

    expect(await screen.findByText('Team A players')).toBeInTheDocument();
    expect(await screen.findByText('Team B players')).toBeInTheDocument();
    expect(await screen.findAllByPlaceholderText('Search @username or type name')).toHaveLength(2);
  });

  it('keeps the end-match confirmation inside the app with keyboard and focus recovery', async () => {
    renderQuickMatch();

    fireEvent.click(await screen.findByRole('button', { name: 'Start volleyball' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Volleyball quick match' })).toBeInTheDocument();

    const endMatchButton = await screen.findByRole('button', { name: /^Finish( match)?$/ });
    fireEvent.click(endMatchButton);

    expect(screen.getByRole('dialog', { name: 'End match?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep scoring' })).toHaveFocus();

    fireEvent.keyDown(globalThis, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'End match?' })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(endMatchButton).toHaveFocus();
    });

    fireEvent.click(endMatchButton);
    fireEvent.mouseDown(screen.getByRole('dialog', { name: 'End match?' }).parentElement);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'End match?' })).not.toBeInTheDocument();
    });
  });

  it('clears team names when starting a distinct new match from the result screen', async () => {
    renderQuickMatch();

    fireEvent.change(await findTeamNameInput('A'), { target: { value: 'Eagles' } });
    fireEvent.change(teamNameInput('B'), { target: { value: 'Hawks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start volleyball' }));

    fireEvent.click(await screen.findByRole('button', { name: /^Finish( match)?$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'End match' }));
    fireEvent.click(await screen.findByRole('button', { name: 'New Match' }));

    expect(await findTeamNameInput('A')).toHaveValue('Team A');
    expect(teamNameInput('B')).toHaveValue('Team B');
  });

  // Kit S2 (plan 2026-10-22 §9 S2)
  it('previews the matchup live from the names and the colour picker', async () => {
    renderQuickMatch();
    fireEvent.change(await findTeamNameInput('A'), { target: { value: 'Royals' } });
    const preview = screen.getByTestId('matchup-preview');
    expect(within(preview).getByText('Royals')).toBeInTheDocument();

    fireEvent.click(within(teamColourGroup('A')).getByRole('button', { name: 'Yellow' }));
    const expected = deriveTeamColours('#facc15', DEFAULT_TEAM_COLOURS.b);
    expect(preview.style.getPropertyValue('--team-a-core')).toBe(expected.A.core);
    expect(preview.style.getPropertyValue('--team-a-on')).toBe(expected.A.on);
    expect(within(teamColourGroup('A')).getByRole('button', { name: 'Yellow' }))
      .toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the preview neutral for a sport without team colours', async () => {
    const flag = vi.spyOn(sportRegistry, 'isTeamColourSport').mockReturnValue(false);
    try {
      renderQuickMatch('/tabletennis/quick');
      await findTeamNameInput('A');
      closeOpenSheet();
      const preview = screen.getByTestId('matchup-preview');
      expect(preview).not.toHaveClass('is-team');
      expect(screen.queryByRole('group', { name: 'Team A colour' })).toBeNull();
    } finally {
      flag.mockRestore();
    }
  });

  it('offers cricket team colours and uses them in its matchup preview', async () => {
    renderQuickMatch('/cricket/quick');
    expect(await findTeamColourGroup('A')).toBeInTheDocument();
    expect(screen.getByTestId('matchup-preview')).toHaveClass('is-team');
    expect(teamColourGroup('B')).toBeInTheDocument();
  });

  it('switches format from the segmented control and states the new rules', async () => {
    renderQuickMatch();
    fireEvent.click(await screen.findByRole('radio', { name: 'Single set' }));
    expect(screen.getByRole('radio', { name: 'Single set' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Best of 3' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Single set' })).toHaveAccessibleDescription(/First to 25 · win by 2 · cap 27/);
  });

  it('gives goals sports a clock or a target under the format', async () => {
    renderQuickMatch('/football/quick');
    // Game: one card per timing preset, the official one chosen by default.
    expect(await screen.findByRole('radio', { name: 'IFAB 2026/27' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Custom school/event' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Quick casual' })).toHaveAttribute('aria-checked', 'false');
    // Rules: the periods and minutes of the official preset.
    goToSetupStep('Rules');
    expect(screen.getByRole('spinbutton', { name: 'Number of periods' })).toHaveValue('2');
    expect(screen.getByRole('spinbutton', { name: 'Minutes per period' })).toHaveValue('45');
    goToSetupStep('Game');
    fireEvent.click(screen.getByRole('radio', { name: 'Quick casual' }));
    goToSetupStep('Rules');
    fireEvent.click(screen.getByRole('button', { name: 'First to' }));
    fireEvent.click(screen.getByRole('button', { name: '5 goals' }));
    expect(screen.getByRole('heading', { name: /First to 5 goals wins/ })).toBeInTheDocument();
  });

  it('edits gully rules in the Rules step and starts with them', async () => {
    renderQuickMatch({ pathname: '/cricket/quick', search: '?format=gully' });
    await screen.findByRole('button', { name: 'Rules' });
    goToSetupStep('Rules');
    fireEvent.click(screen.getByRole('button', { name: 'More: Players per side' }));
    fireEvent.click(screen.getByRole('button', { name: 'More rules' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Last man bats' }));
    expect(screen.getByRole('switch', { name: 'Last man bats' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('heading', { level: 2, name: /5 overs · 7 players · 1 innings each · bat only/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start cricket' })).toBeInTheDocument();
  });

  it('edits points per set for a sets sport in the Rules step; the Game cards state the new rules', async () => {
    renderQuickMatch();
    await screen.findByRole('button', { name: 'Rules' });
    goToSetupStep('Rules');
    fireEvent.click(screen.getByRole('button', { name: '21' }));
    goToSetupStep('Game');
    expect(await screen.findByRole('radio', { name: 'Best of 3' })).toHaveAccessibleDescription(/21 points a set · win by 2 · decider to 15 · cap 27/);
  });

  it.each([['volleyball', 'Rules'], ['kabaddi', null], ['tennis', null], ['cricket', 'Rules'], ['football', 'Rules']])(
    '%s: Start is available with the defaults on the first step',
    async (sport, rulesAction) => {
      renderQuickMatch(`/${sport}/quick`);
      const start = await screen.findByRole('button', { name: /^Start / });
      expect(start).not.toHaveAttribute('aria-disabled', 'true');
      expect(screen.queryAllByRole('group', { name: /colour$/ })).toHaveLength(0);
      if (rulesAction) expect(screen.getByRole('button', { name: rulesAction })).toBeInTheDocument();
      else if (sport === 'kabaddi' || sport === 'tennis') expect(screen.getByRole('button', { name: 'Rules' })).toBeInTheDocument();
      else expect(screen.queryByRole('button', { name: /rules$/i })).toBeNull();
      expect(teamNameInput('A')).toHaveValue('Team A');
    },
  );

  it('keeps the switch to tournament setup', async () => {
    renderQuickMatchWithLocation('/football/quick');
    fireEvent.click(await screen.findByRole('button', { name: 'Switch to tournament setup' }));
    expect(screen.getByTestId('current-route')).toHaveTextContent('/football/tournament');
  });

  it('prefills names and colours a Rematch hands over', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/volleyball/quick', state: { teams: ['Royals', 'Strikers'], colours: ['#7a1020', '#38bdf8'] } }]}>
        <Routes>
          <Route path="/:sport/quick" element={<MonoQuickMatch />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await findTeamNameInput('A')).toHaveValue('Royals');
    expect(within(teamColourGroup('A')).getByRole('button', { name: 'Maroon' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(within(teamColourGroup('B')).getByRole('button', { name: 'Sky' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByTestId('matchup-preview')).getByText('Strikers')).toBeInTheDocument();
  });
});


it.each([['football', 2, 45], ['basketball', 4, 10], ['hockey', 4, 15]])('freezes %s timing in the match and hides clock controls for casual play', async (sport, count, minutes) => {
  globalThis.localStorage.clear();
  const first = renderQuickMatch(`/${sport}/quick`);
  await screen.findByRole('button', { name: 'Rules' });
  goToSetupStep('Rules');
  expect(screen.getByRole('spinbutton', { name: 'Number of periods' })).toHaveValue(String(count));
  expect(screen.getByRole('spinbutton', { name: 'Minutes per period' })).toHaveValue(String(minutes));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Minutes per period' }), { target: { value: '3' } });
  // Editing a period makes the rules Custom: the summary says so.
  expect(screen.getByRole('heading', { name: /^Customised/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: `Start ${sport}` }));
  expect(screen.getByRole('button', { name: 'Pause clock' })).toBeInTheDocument();
  const key = Object.keys(localStorage).find(key => key.startsWith(matchStorageKey(`se_quickmatch_draft_${sport}_`)));
  const draft = JSON.parse(localStorage.getItem(matchStorageKey(key)));
  expect(draft.periodState).toMatchObject({ version: 1, sport, durations: Array(count).fill(180) });
  first.unmount(); globalThis.localStorage.clear();
  renderQuickMatch(`/${sport}/quick`);
  fireEvent.click(await screen.findByRole('radio', { name: 'Quick casual' }));
  fireEvent.click(screen.getByRole('button', { name: `Start ${sport}` }));
  expect(screen.queryByRole('button', { name: 'Pause clock' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /End half|End quarter/ })).not.toBeInTheDocument();
});
