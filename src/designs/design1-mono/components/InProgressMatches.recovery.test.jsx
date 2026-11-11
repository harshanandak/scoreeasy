import { matchStorageKey } from '../../../utils/accountStorage';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import InProgressMatches from './InProgressMatches';
import { getAppEntryTarget, loadAppEntryState, loadInProgressMatches } from '../../../utils/appEntry';

const healthy = { sport: 'volleyball', quickMatchId: 'ok', phase: 'scoring', team1Name: 'Royals', team2Name: 'Strikers', vScore1: 3, vScore2: 2, updatedAt: '2026-11-09' };
// The draft sits under one key but names another id, so its resume link points at a draft that is not there.
const orphan = { sport: 'volleyball', quickMatchId: 'gone', phase: 'scoring', team1Name: 'Lions', team2Name: 'Tigers', vScore1: 7, vScore2: 5, updatedAt: '2026-11-08' };
const ORPHAN_KEY = 'se_quickmatch_draft_volleyball_orphan';

function renderList() {
  return render(<MemoryRouter><InProgressMatches /></MemoryRouter>);
}

describe('Home kept-match list: entries that cannot open', () => {
  beforeEach(() => { cleanup(); localStorage.clear(); });

  it('a healthy row still has only Resume', () => {
    localStorage.setItem(matchStorageKey('se_quickmatch_draft_volleyball_ok'), JSON.stringify(healthy));
    renderList();
    expect(screen.getByRole('button', { name: /^Resume/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Can't open this match/)).not.toBeInTheDocument();
  });

  it("a draft whose resume link points at a missing draft shows \"Can't open this match\" and Remove, not Resume", () => {
    localStorage.setItem(matchStorageKey('se_quickmatch_draft_volleyball_ok'), JSON.stringify(healthy));
    localStorage.setItem(matchStorageKey(ORPHAN_KEY), JSON.stringify(orphan));
    renderList();
    const row = screen.getByRole('button', { name: /^Remove.*Lions v Tigers/ }).closest('article');
    expect(row).toHaveTextContent("Can't open this match");
    expect(within(row).queryByRole('button', { name: /^Resume/ })).not.toBeInTheDocument();
    const healthyRow = screen.getByRole('button', { name: /^Resume.*Royals v Strikers/ }).closest('article');
    expect(within(healthyRow).queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
  });

  it('Remove asks first; Keep match leaves it, Discard deletes the draft and the row goes', () => {
    localStorage.setItem(matchStorageKey(ORPHAN_KEY), JSON.stringify(orphan));
    renderList();
    fireEvent.click(screen.getByRole('button', { name: /^Remove.*Lions v Tigers/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Discard match?')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Lions v Tigers');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep match' }));
    expect(localStorage.getItem(matchStorageKey(ORPHAN_KEY))).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Remove.*Lions v Tigers/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard' }));
    expect(localStorage.getItem(matchStorageKey(ORPHAN_KEY))).toBeNull();
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });

  it('a tournament fixture whose teams are gone shows Remove, and Remove resets only that fixture', () => {
    localStorage.setItem(matchStorageKey('se_volleyball'), JSON.stringify([{
      id: 't1', name: 'Club Cup', teams: [{ id: 'a', name: 'Aces' }],
      matches: [
        { id: 'm1', team1Id: 'a', team2Id: 'zzz', status: 'in-progress', draftState: { vScore1: 4, vScore2: 1 } },
        { id: 'm2', team1Id: 'a', team2Id: 'a', status: 'pending' },
      ],
    }]));
    renderList();
    expect(screen.getByText(/Can't open this match/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Remove/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard' }));
    const saved = JSON.parse(localStorage.getItem(matchStorageKey('se_volleyball')));
    expect(saved[0].matches[0]).toEqual(expect.objectContaining({ id: 'm1', status: 'pending' }));
    expect(saved[0].matches[0].draftState).toBeUndefined();
    expect(saved[0].matches[1]).toEqual(expect.objectContaining({ id: 'm2', status: 'pending' }));
  });

  it('one entry with damaged score data does not crash Home: it becomes a Cannot-open row with Remove', () => {
    localStorage.setItem(matchStorageKey('se_quickmatch_draft_volleyball_ok'), JSON.stringify(healthy));
    localStorage.setItem(matchStorageKey('se_tennis_quick_draft_t1'), JSON.stringify({
      id: 't1', status: 'in-progress', team1Name: 'Ace', team2Name: 'Bee', sets: [null], updatedAt: '2026-11-08',
    }));
    renderList();
    expect(screen.getByRole('button', { name: /^Resume.*Royals v Strikers/ })).toBeInTheDocument();
    const row = screen.getByRole('button', { name: /^Remove.*Ace v Bee/ }).closest('article');
    expect(row).toHaveTextContent("Can't open this match");
    fireEvent.click(within(row).getByRole('button', { name: /^Remove/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard' }));
    expect(localStorage.getItem(matchStorageKey('se_tennis_quick_draft_t1'))).toBeNull();
  });

  it('never auto-resumes into a lone entry that cannot open', () => {
    localStorage.setItem(matchStorageKey(ORPHAN_KEY), JSON.stringify(orphan));
    expect(loadInProgressMatches()).toHaveLength(1);
    expect(getAppEntryTarget({ ...loadAppEntryState(), native: true })).toBe('/app');
  });
});
