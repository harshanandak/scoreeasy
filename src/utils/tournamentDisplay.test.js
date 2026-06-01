import { describe, expect, it } from 'vitest';
import {
  getTournamentProgressCounts,
  getTournamentMatchCountPreview,
  getTournamentTypeLabel,
  isPureKnockoutTournament,
  shouldShowKnockoutStage,
} from './tournamentDisplay';

describe('tournament display helpers', () => {
  it('identifies pure knockout tournaments', () => {
    expect(isPureKnockoutTournament({ type: 'knockout' })).toBe(true);
    expect(isPureKnockoutTournament({ knockoutConfig: { mode: 'single-elimination' } })).toBe(true);
    expect(isPureKnockoutTournament({ type: 'round-robin' })).toBe(false);
  });

  it('keeps knockout tab visibility in sync with tournament mode', () => {
    expect(shouldShowKnockoutStage({ isPureKnockout: true, hasKnockouts: false })).toBe(true);
    expect(shouldShowKnockoutStage({ isPureKnockout: false, hasKnockouts: true })).toBe(true);
    expect(shouldShowKnockoutStage({ isPureKnockout: false, hasKnockouts: false })).toBe(false);
  });

  it('formats tournament type labels without nested view logic', () => {
    expect(getTournamentTypeLabel({ isPureKnockout: true })).toBe('Single Elimination');
    expect(getTournamentTypeLabel({ type: 'series', totalMatches: 3 })).toBe('3-match series');
    expect(getTournamentTypeLabel({ hasKnockouts: true })).toBe('Round Robin + Knockouts');
    expect(getTournamentTypeLabel({ hasKnockouts: false })).toBe('Round Robin');
  });

  it('includes playoff matches in setup match count previews', () => {
    expect(getTournamentMatchCountPreview({
      tournamentType: 'round-robin',
      teamCount: 4,
      winnerMode: 'knockouts',
      teamsAdvancing: 4,
      thirdPlaceMatch: true,
    })).toBe(10);

    expect(getTournamentMatchCountPreview({
      tournamentType: 'knockout',
      teamCount: 4,
      thirdPlaceMatch: false,
    })).toBe(3);
  });

  it('counts larger single-elimination brackets from the team count', () => {
    expect(getTournamentMatchCountPreview({
      tournamentType: 'knockout',
      teamCount: 6,
      thirdPlaceMatch: false,
    })).toBe(5);

    expect(getTournamentMatchCountPreview({
      tournamentType: 'knockout',
      teamCount: 8,
      thirdPlaceMatch: true,
    })).toBe(8);
  });

  it('includes knockout matches in elimination dashboard progress', () => {
    expect(getTournamentProgressCounts({
      type: 'knockout',
      matches: [],
      knockoutMatches: [
        { status: 'completed' },
        { status: 'pending' },
        { status: 'pending' },
      ],
    })).toEqual({ completedMatches: 1, totalMatches: 3 });
  });
});
