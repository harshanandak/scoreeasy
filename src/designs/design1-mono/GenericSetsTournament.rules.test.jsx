import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { freezeSetsFormat } from '../../models/setsRules';
import { getSportById } from '../../models/sportRegistry';
import GenericSetsTournament from './GenericSetsTournament';

const h = vi.hoisted(() => ({ tournament: null, save: vi.fn(() => true) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useParams: () => ({ sport: 'badminton', id: '1' }) }));
vi.mock('../../utils/storage', () => ({ loadSportTournaments: () => [h.tournament], saveSportTournament: h.save }));

beforeEach(() => { vi.clearAllMocks(); });

describe('tournament completion repair uses frozen match length', () => {
  it.each([
    [{ type: 'single', sets: 1, points: 21 }, 3, 1],
    [{ type: 'best-of', sets: 3, points: 21 }, 5, 2],
  ])('keeps an unfinished longer match open inside tournament format %j', async (tournamentFormat, matchLength, won) => {
    const format = freezeSetsFormat(getSportById('badminton'), { type: 'best-of', sets: matchLength, points: 21 });
    h.tournament = {
      id: 1, name: 'Club Cup', format: tournamentFormat,
      teams: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }],
      matches: [{ id: 'm1', team1Id: 1, team2Id: 2, format, status: 'in-progress', sets: Array.from({ length: won }, () => ({ score1: 21, score2: 10, completed: true })) }],
      knockoutMatches: [],
    };
    render(<GenericSetsTournament />);
    expect(await screen.findByText('In Progress')).toBeTruthy();
    expect(h.save.mock.calls.at(-1)[1].matches[0]).toMatchObject({ status: 'in-progress', format });
    expect(h.save.mock.calls.at(-1)[1].matches[0].winner).toBeUndefined();
  });

  it('repairs a truly finished frozen match even when its tournament is longer', async () => {
    h.tournament = {
      id: 1, name: 'Club Cup', format: { type: 'best-of', sets: 5, points: 21 },
      teams: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }],
      matches: [{ id: 'm1', team1Id: 1, team2Id: 2, format: freezeSetsFormat(getSportById('badminton'), { type: 'single', sets: 1, target: 21 }), status: 'in-progress', sets: [{ score1: 21, score2: 10, completed: true }] }],
      knockoutMatches: [],
    };
    render(<GenericSetsTournament />);
    expect(await screen.findByText('Completed')).toBeTruthy();
    expect(h.save.mock.calls.at(-1)[1].matches[0]).toMatchObject({ status: 'completed', winner: 1 });
  });
});
