import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '../../../hooks/useAuth';
import LiveMatchCard from './LiveMatchCard';
import { getSportById } from '../../../models/sportRegistry';

// Compact "Live now" rail for the app home (scoreeasy-3ws). Surfaces the top few
// public live matches; each card links straight to its public watch page
// (/live/:token). Renders NOTHING when there's nothing live (or no cloud) so it
// never adds empty chrome to the home.
const STRIP_LIMIT = 6;

export default function LiveNowStrip() {
  const { cloudAuthAvailable } = useAuth();
  const matches = useQuery(api.live.listLiveFeed, cloudAuthAvailable ? { limit: STRIP_LIMIT } : 'skip');

  const registeredMatches = Array.isArray(matches) ? matches.filter((match) => getSportById(match?.sport)) : [];
  if (registeredMatches.length === 0) return null;

  return (
    <section className="live-strip" aria-label="Live now">
      <div className="live-strip-head">
        <span className="live-strip-title">
          <span aria-hidden="true" style={{ color: '#dc2626' }}>●</span> Live now
        </span>
      </div>
      <div className="live-strip-rail">
        {registeredMatches.map((m) => (
          <LiveMatchCard key={m.token} item={m} />
        ))}
      </div>
    </section>
  );
}
