// Offline stand-in for convex/react: answers the watch page's queries from window.__live.
import { getFunctionName } from 'convex/server';
export function useQuery(ref) { return window.__live?.[getFunctionName(ref)]; }
export function usePaginatedQuery() { return { results: window.__live?.events ?? [], status: 'Exhausted', loadMore() {} }; }
export function useConvexConnectionState() { return { isWebSocketConnected: true, hasEverConnected: true, connectionRetries: 0 }; }
export function useMutation() { return async () => null; }
