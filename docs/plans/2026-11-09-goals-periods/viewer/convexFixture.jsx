import { getFunctionName } from 'convex/server';
const sport = new URLSearchParams(location.search).get('sport') || 'football';
const football = sport === 'football';
const now = Date.now();
const snapshot = { sport, status: 'live', scorecardKind: 'goals', pointsA: 2, pointsB: 1, setsA: 0, setsB: 0,
  setScores: football ? [{ a: 1, b: 0 }, { a: 1, b: 1 }] : [{ a: 1, b: 0 }, { a: 1, b: 1 }, { a: 0, b: 0 }, { a: 0, b: 0 }],
  currentUnit: football ? 2 : 3, periodLabel: football ? '2nd half' : 'Q3',
  periodClock: { sport, phase: 'playing', elapsed: 26, startedAt: null, duration: 60, periodIndex: football ? 1 : 2, regulationCount: football ? 2 : 4 },
  lastSeq: 4, startedAt: now - 120000, lastEventAt: now, isYouthMatch: false };
const meta = { sport, teamA: { name: 'Reds' }, teamB: { name: 'Blues' }, players: [], isYouthMatch: false };
export const useQuery = ref => getFunctionName(ref) === 'live:getByToken' ? snapshot : meta;
export const usePaginatedQuery = () => ({ results: [], status: 'Exhausted', loadMore() {}, isLoading: false });
export const useConvexConnectionState = () => ({ isWebSocketConnected: true, hasEverConnected: true, connectionRetries: 0 });
export const useMutation = () => async () => null;
