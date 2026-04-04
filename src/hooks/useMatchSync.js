import { useEffect, useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { normalizeMatchForConvex } from '../utils/normalizeMatch';

export function buildQuickMatchClientId(sport, matchId) {
  return `quick:${sport}:${matchId}`;
}

function extractTaggedUserIds(players) {
  return players
    .filter((player) => player?.type === 'user' && player?.userId)
    .map((player) => player.userId);
}

function buildSyncPayload({ match, sport, team1Players, team2Players, isRefereeing }) {
  const normalized = normalizeMatchForConvex(match, sport);

  return {
    ...normalized,
    clientMatchId: match.clientMatchId || buildQuickMatchClientId(sport, match.id),
    team1Players: extractTaggedUserIds(team1Players),
    team2Players: extractTaggedUserIds(team2Players),
    matchRole: isRefereeing ? 'refereeing' : 'playing',
  };
}

export function useMatchSync({
  sport,
  isAuthenticated,
  user,
  team1Players,
  team2Players,
  isRefereeing,
}) {
  const saveMatchMutation = useMutation(api.matches.save);
  const payloadRef = useRef(null);
  const pendingBootstrapSyncRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const [syncState, setSyncState] = useState('idle');
  const [syncError, setSyncError] = useState('');

  const executeSync = async (payload) => {
    payloadRef.current = payload;
    pendingBootstrapSyncRef.current = false;
    syncInFlightRef.current = true;
    setSyncState('syncing');
    setSyncError('');

    try {
      await saveMatchMutation(payload);
      setSyncState('synced');
      return {
        status: 'synced',
        clientMatchId: payload.clientMatchId,
      };
    } catch (error) {
      const message = error?.message || 'Could not sync this match to your profile.';
      setSyncState('failed');
      setSyncError(message);
      return {
        status: 'failed',
        error: message,
        clientMatchId: payload.clientMatchId,
      };
    } finally {
      syncInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      payloadRef.current = null;
      pendingBootstrapSyncRef.current = false;
      syncInFlightRef.current = false;
      setSyncState('idle');
      setSyncError('');
      return;
    }

    if (
      user &&
      payloadRef.current &&
      pendingBootstrapSyncRef.current &&
      !syncInFlightRef.current
    ) {
      void executeSync(payloadRef.current);
    }
  }, [isAuthenticated, user]);

  const syncMatch = async (match) => {
    if (!isAuthenticated) {
      payloadRef.current = null;
      pendingBootstrapSyncRef.current = false;
      syncInFlightRef.current = false;
      setSyncState('idle');
      setSyncError('');
      return {
        status: 'idle',
        clientMatchId: match?.clientMatchId || buildQuickMatchClientId(sport, match?.id),
      };
    }

    const payload = buildSyncPayload({
      match,
      sport,
      team1Players,
      team2Players,
      isRefereeing,
    });

    if (!user) {
      payloadRef.current = payload;
      pendingBootstrapSyncRef.current = true;
      setSyncState('syncing');
      setSyncError('');
      return {
        status: 'pending',
        clientMatchId: payload.clientMatchId,
      };
    }

    return executeSync(payload);
  };

  const retrySync = async () => {
    if (!payloadRef.current) {
      return {
        status: syncState,
      };
    }

    if (!isAuthenticated) {
      payloadRef.current = null;
      pendingBootstrapSyncRef.current = false;
      setSyncState('idle');
      setSyncError('');
      return {
        status: 'idle',
      };
    }

    if (!user) {
      pendingBootstrapSyncRef.current = true;
      setSyncState('syncing');
      setSyncError('');
      return {
        status: 'pending',
        clientMatchId: payloadRef.current.clientMatchId,
      };
    }

    return executeSync(payloadRef.current);
  };

  const resetSync = () => {
    payloadRef.current = null;
    pendingBootstrapSyncRef.current = false;
    syncInFlightRef.current = false;
    setSyncState('idle');
    setSyncError('');
  };

  return {
    syncState,
    syncError,
    syncMatch,
    retrySync,
    resetSync,
  };
}
