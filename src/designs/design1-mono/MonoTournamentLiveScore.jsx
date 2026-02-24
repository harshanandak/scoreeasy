import React from 'react';
import { useParams } from 'react-router-dom';
import { getSportById } from '../../models/sportRegistry';
import { loadSportTournaments } from '../../utils/storage';
import { migrateCricketFormat } from '../../utils/formatMigration';
import MonoSetsLiveScore from './scoring/MonoSetsLiveScore';
import MonoGoalsLiveScore from './scoring/MonoGoalsLiveScore';
import MonoCricketLiveScore from './scoring/MonoCricketLiveScore';
import MonoCricketTestLiveScore from './scoring/MonoCricketTestLiveScore';
import MonoTennisLiveScore from './scoring/MonoTennisLiveScore';

export default function MonoTournamentLiveScore() {
  const { sport, id, matchId } = useParams();

  // Cricket: check match-level format to pick scorer (bug fix 9f)
  if (sport === 'cricket' || getSportById(sport)?.engine === 'custom-cricket') {
    const sportConfig = getSportById(sport);
    const storageKey = sportConfig?.storageKey || 'se_cricket';
    const tournaments = loadSportTournaments(storageKey);
    const tournament = tournaments.find(t => t.id === Number(id) || t.id === id);
    const match = tournament?.matches?.find(m => m.id === matchId || m.id === Number(matchId))
      || (tournament?.knockoutMatches || []).find(m => m.id === matchId || m.id === Number(matchId));
    const format = migrateCricketFormat(match?.format || tournament?.knockoutConfig?.format || tournament?.format);

    if (format?.totalInnings === 4) {
      return <MonoCricketTestLiveScore />;
    }
    return <MonoCricketLiveScore />;
  }

  // Tennis uses real tennis scoring
  if (sport === 'tennis') {
    return <MonoTennisLiveScore />;
  }

  const sportConfig = getSportById(sport);

  if (!sportConfig) {
    return (
      <div className="min-h-screen px-6 py-10 flex items-center justify-center">
        <p style={{ color: '#888' }}>Sport not found</p>
      </div>
    );
  }

  if (sportConfig.engine === 'sets') {
    return <MonoSetsLiveScore />;
  }

  if (sportConfig.engine === 'goals') {
    return <MonoGoalsLiveScore />;
  }

  return (
    <div className="min-h-screen px-6 py-10 flex items-center justify-center">
      <p style={{ color: '#888' }}>Live scoring for {sportConfig?.name || sport} coming soon...</p>
    </div>
  );
}
