import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { freezeSetsFormat } from '../../models/setsRules';
import { getSportById } from '../../models/sportRegistry';
import GenericSetsTournament from './GenericSetsTournament';

const h = vi.hoisted(() => ({ tournament: null, sport: 'badminton', save: vi.fn(() => true) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useParams: () => ({ sport: h.sport, id: '1' }) }));
vi.mock('../../utils/storage', () => ({ loadSportTournaments: () => [h.tournament], saveSportTournament: h.save }));

beforeEach(() => { vi.clearAllMocks(); h.sport = 'badminton'; });

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
    expect(h.save.mock.calls.at(-1)[1].matches[0]).toMatchObject({ status: 'completed', resultType: 'decided', winner: 1 });
  });
});

describe('group card set outcomes', () => {
  it.each(['abandoned', 'decided'])('renders a %s volleyball result without inventing a won set', async (resultType) => {
    h.sport = 'volleyball';
    const abandoned = resultType === 'abandoned';
    h.tournament = {
      id: 1, name: 'Club Cup', format: { type: 'best-of', sets: 3, points: 25 },
      teams: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }],
      matches: [{
        id: 'm1', team1Id: 1, team2Id: 2, status: 'completed', resultType,
        winner: abandoned ? null : 1,
        sets: abandoned ? [{ score1: 2, score2: 1, completed: false }]
          : [{ score1: 25, score2: 23, completed: true }, { score1: 25, score2: 20, completed: true }],
      }],
      knockoutMatches: [],
    };
    const { container } = render(<GenericSetsTournament />);
    await screen.findByText('Alpha');
    const totals = [...container.querySelectorAll('.kit-fx-score')].map(node => node.textContent);
    expect.soft(totals, 'only completed sets count toward group-card totals').toEqual(abandoned ? ['0', '0'] : ['2', '0']);
    expect.soft(screen.queryByText(abandoned ? 'Abandoned · no result' : 'Completed'), 'group-card outcome label').toBeInTheDocument();
    const chips = container.querySelectorAll('.kit-fx-set');
    for (const chip of chips) {
      if (abandoned) {
        expect.soft(chip, 'abandoned group-card chip has no winner colour').not.toHaveClass('is-won');
        expect.soft(chip, 'abandoned group-card chip has no loser colour').not.toHaveClass('is-lost');
        expect.soft(chip.querySelector('b'), 'abandoned group-card score has no winner emphasis').toBeNull();
      } else {
        expect(chip, 'decided group-card winning sets stay won').toHaveClass('is-won');
        expect(chip.querySelector('b')).toHaveTextContent('25');
      }
    }
    expect(chips).toHaveLength(abandoned ? 1 : 2);
    if (!abandoned) {
      expect(screen.getByText('Alpha').closest('.kit-last-team')).toHaveClass('is-winner');
      expect(screen.getByText('Beta').closest('.kit-last-team')).toHaveClass('is-loser');
    }
  });
});
