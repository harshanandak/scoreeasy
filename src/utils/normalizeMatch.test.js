import { normalizeMatchForConvex } from './normalizeMatch';

describe('normalizeMatchForConvex', () => {
  describe('cricket engine (team1Score/team2Score)', () => {
    it('extracts runs from team score objects', () => {
      const result = normalizeMatchForConvex({
        team1: 'India', team2: 'Australia',
        team1Score: { runs: 250, balls: 300, wickets: 8 },
        team2Score: { runs: 200, balls: 280, wickets: 10 },
        winner: 'India',
      }, 'cricket');
      expect(result.score1).toBe(250);
      expect(result.score2).toBe(200);
      expect(result.detail.team1Score.runs).toBe(250);
      expect(result.detail.team2Score.wickets).toBe(10);
      expect(result.sport).toBe('cricket');
      expect(result.winner).toBe('India');
    });

    it('defaults runs to 0 when missing', () => {
      const result = normalizeMatchForConvex({
        team1: 'A', team2: 'B',
        team1Score: {}, team2Score: {},
      }, 'cricket');
      expect(result.score1).toBe(0);
      expect(result.score2).toBe(0);
    });
  });

  describe('test cricket engine (innings array)', () => {
    it('sums runs across innings per team', () => {
      const result = normalizeMatchForConvex({
        team1: 'India', team2: 'England',
        innings: [
          { teamId: 'team1', runs: 300 },
          { teamId: 'team2', runs: 250 },
          { teamId: 'team1', runs: 200 },
          { teamId: 'team2', runs: 260 },
        ],
        winDesc: 'India won by 10 runs',
        winner: 'India',
      }, 'cricket');
      expect(result.score1).toBe(500);
      expect(result.score2).toBe(510);
      expect(result.detail.winDesc).toBe('India won by 10 runs');
      expect(result.detail.innings).toHaveLength(4);
    });

    it('handles named team IDs', () => {
      const result = normalizeMatchForConvex({
        team1: 'India', team2: 'England',
        innings: [
          { teamId: 'India', runs: 150 },
          { teamId: 'England', runs: 140 },
        ],
      }, 'cricket');
      expect(result.score1).toBe(150);
      expect(result.score2).toBe(140);
    });
  });

  describe('sets engine', () => {
    it('uses setsWon as top-level scores', () => {
      const result = normalizeMatchForConvex({
        team1: 'Team A', team2: 'Team B',
        sets: [{ s1: 25, s2: 20 }, { s1: 22, s2: 25 }, { s1: 25, s2: 18 }],
        setsWon1: 2, setsWon2: 1,
        winner: 'Team A',
      }, 'volleyball');
      expect(result.score1).toBe(2);
      expect(result.score2).toBe(1);
      expect(result.detail.sets).toHaveLength(3);
    });

    it('defaults setsWon to 0 when missing', () => {
      const result = normalizeMatchForConvex({
        team1: 'A', team2: 'B',
        sets: [],
      }, 'badminton');
      expect(result.score1).toBe(0);
      expect(result.score2).toBe(0);
    });
  });

  describe('goals engine', () => {
    it('uses score1/score2 directly', () => {
      const result = normalizeMatchForConvex({
        team1: 'Barcelona', team2: 'Madrid',
        score1: 3, score2: 1,
        winner: 'Barcelona',
      }, 'football');
      expect(result.score1).toBe(3);
      expect(result.score2).toBe(1);
      expect(result.detail).toBeUndefined();
    });
  });

  describe('common output fields', () => {
    it('includes sport, team names, and date', () => {
      const before = Date.now();
      const result = normalizeMatchForConvex({
        team1: 'X', team2: 'Y', score1: 1, score2: 0,
      }, 'football');
      expect(result.sport).toBe('football');
      expect(result.team1).toBe('X');
      expect(result.team2).toBe('Y');
      expect(result.date).toBeGreaterThanOrEqual(before);
      expect(result.date).toBeLessThanOrEqual(Date.now());
    });

    it('includes optional format and duration', () => {
      const result = normalizeMatchForConvex({
        team1: 'A', team2: 'B', score1: 1, score2: 0,
        format: { type: 'best-of-3' }, elapsedSeconds: 3600,
      }, 'volleyball');
      expect(result.format).toEqual({ type: 'best-of-3' });
      expect(result.duration).toBe(3600);
    });

    it('omits winner and format when not provided', () => {
      const result = normalizeMatchForConvex({
        team1: 'A', team2: 'B', score1: 0, score2: 0,
      }, 'football');
      expect(result.winner).toBeUndefined();
      expect(result.format).toBeUndefined();
      expect(result.duration).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('returns zeros when result has no recognized score shape', () => {
      const result = normalizeMatchForConvex({
        team1: 'A', team2: 'B',
      }, 'unknown');
      expect(result.score1).toBe(0);
      expect(result.score2).toBe(0);
      expect(result.detail).toBeUndefined();
    });
  });
});
