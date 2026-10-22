import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '../../../hooks/useAuth';
import ErrorBoundary from '../../../components/ErrorBoundary';
import { getSportById } from '../../../models/sportRegistry';
import { deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import { sportIdentity, sportIdentityVars } from '../../../lib/sportIdentity';
import { KitTop, KitWash, SportBadge } from '../kit/KitParts';
import { liveStatus, updateAge } from './liveStatus';
import '../kit/live.css';

// Badminton counts games, not sets (the scorer says "Game 2 · Games 1–0"); one is singular.
const SET_UNIT = { badminton: 'game' };
const setCount = (sport, n) => `${n} ${SET_UNIT[sport] || 'set'}${n === 1 ? '' : 's'}`;

function EmptyLive() {
  return (
    <div className="kit-live-empty">
      <div className="kit-live-marks" aria-hidden="true">
        {['cricket', 'volleyball', 'kabaddi'].map(sport => <SportBadge key={sport} sportId={sport} />)}
      </div>
      <h2>Nothing live right now</h2>
      <p>When someone shares a match, it appears here with its live score. Score one yourself and share the link.</p>
      <Link className="se-go" to="/play">Score a match <span aria-hidden="true">{'\u2192'}</span></Link>
    </div>
  );
}

function LiveRow({ item, now }) {
  const colours = useMemo(
    () => deriveTeamColours(item.teamA?.color, item.teamB?.color),
    [item.teamA?.color, item.teamB?.color],
  );
  const status = liveStatus(item.lastEventAt, now);
  const sets = item.scorecardKind === 'volleyball' || item.scorecardKind === 'tennis';
  return (
    <Link className="kit-live-row" to={`/live/${item.token}`} style={teamColourVars(colours)}
      aria-label={`Watch live: ${item.teamA?.name || 'Team A'} versus ${item.teamB?.name || 'Team B'}`}>
      <SportBadge sportId={item.sport} />
      <div className="kit-live-teams">
        {['A', 'B'].map(side => (
          <div className="kit-live-team" key={side}>
            <span className="kit-live-team-dot" aria-hidden="true" style={{ backgroundColor: `var(--team-${side.toLowerCase()}-core)` }} />
            <span className="kit-live-name">{item[`team${side}`]?.name || `Team ${side}`}</span>
            <span className="kit-live-score">
              {sets && <span className="kit-live-sets" aria-label={setCount(item.sport, item[`sets${side}`])}>{item[`sets${side}`]}<small>{setCount(item.sport, item[`sets${side}`]).split(' ')[1]}</small></span>}
              <span>{item[`points${side}`]}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="kit-live-meta">
        <span className={status === 'Live' ? 'kit-live-status' : 'kit-live-paused'}>{status}</span>
        <span className="kit-live-detail"><span>{getSportById(item.sport)?.name}</span>{item.periodLabel && <> {'\u00b7'} <span>{item.periodLabel}</span></>} {'\u00b7'} <span>{updateAge(item.lastEventAt, now)}</span></span>
      </div>
    </Link>
  );
}
LiveRow.propTypes = { item: PropTypes.object.isRequired, now: PropTypes.number.isRequired };

function LiveFeed() {
  const matches = useQuery(api.live.listLiveFeed, {});
  const [selected, setSelected] = useState('all');
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(Date.now()), 1000);
    return () => globalThis.clearInterval(timer);
  }, []);
  if (matches === undefined) return (
    <div className="kit-live-loading" role="status" aria-label="Loading live matches" aria-busy="true">
      {[0, 1, 2, 3].map(key => <div key={key} aria-hidden="true" />)}
    </div>
  );
  const feed = Array.isArray(matches) ? matches.filter(item => getSportById(item.sport)) : [];
  if (!feed.length) return <EmptyLive />;
  const sports = [...new Set(feed.map(item => item.sport))];
  // If the last match for a selected sport disappears, show the remaining feed.
  const filter = sports.includes(selected) ? selected : 'all';
  return (
    <>
      <p className="kit-sub">{feed.length} {feed.length === 1 ? 'match' : 'matches'} being scored right now</p>
      <div className="kit-live-filters" role="group" aria-label="Filter by sport">
        {['all', ...sports].map(sport => (
          <button key={sport} type="button" aria-pressed={filter === sport} onClick={() => setSelected(sport)} style={sportIdentityVars(sport)}>
            {sport !== 'all' && <i aria-hidden="true" />}{sport === 'all' ? 'All' : getSportById(sport).name}
          </button>
        ))}
      </div>
      <div className="kit-live-list">
        {feed.filter(item => filter === 'all' || item.sport === filter).map(item => <LiveRow key={item.token} item={item} now={now} />)}
      </div>
      <p className="kit-live-footnote">Showing public matches with a point in the last 30 minutes.</p>
    </>
  );
}

export default function MonoLiveNow() {
  const { cloudAuthAvailable } = useAuth();
  return (
    <div className="kit-screen kit-live-screen" data-screen="live">
      <KitWash from={sportIdentity('hockey')?.tint} to={sportIdentity('kabaddi')?.tint} />
      <KitTop title="Live" />
      <h1 className="kit-title">Live now</h1>
      <ErrorBoundary fallback={<EmptyLive />} captureToSentry={false}>
        {cloudAuthAvailable ? <LiveFeed /> : <EmptyLive />}
      </ErrorBoundary>
    </div>
  );
}
