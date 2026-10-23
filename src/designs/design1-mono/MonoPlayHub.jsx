import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getSportById, getSportsByCategory } from '../../models/sportRegistry';
import { LATER_GROUP_LABEL, PRIORITY_GROUP_LABEL } from '../../models/sportFocus';
import { sportIdentity } from '../../lib/sportIdentity';
import { KitSection, KitTop, KitWash, SportTile } from './kit/KitParts';

/* Play hub (Kit, plan 2026-10-22 §9 S1): every registered sport as an engine-gated identity tile,
   in sportFocus order. Popular is two columns with the hint line; More sports is three, name only.
   A tile starts a quick match; that setup screen carries the switch to tournament setup.
   /play?sport=<id> (marketing sport links, the quick scorer's Back) marks that sport's tile with
   the selected ink ring and scrolls it into view; an id the registry doesn't know is ignored. */
export default function MonoPlayHub() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedId = getSportById(searchParams.get('sport')?.toLowerCase())?.id ?? null;
  const groups = getSportsByCategory();
  const popular = groups[PRIORITY_GROUP_LABEL];
  const more = groups[LATER_GROUP_LABEL];
  const start = (sport) => navigate(`/${sport.id}/quick`, { state: { newMatch: true } });

  useEffect(() => {
    if (!requestedId) return;
    globalThis.document?.getElementById(`sport-tile-${requestedId}`)?.scrollIntoView?.({ block: 'center' });
  }, [requestedId]);

  return (
    <div className="kit-screen" data-screen="play">
      <KitWash from={sportIdentity('kabaddi')?.tint} to={sportIdentity('hockey')?.tint} />
      <KitTop title="Play" />
      <h1 className="kit-title">What are we scoring?</h1>
      <p className="kit-sub">Tap a sport to set up a quick match</p>

      <section aria-labelledby="play-popular">
        <KitSection id="play-popular" title={PRIORITY_GROUP_LABEL} aside={<span>{popular.length} sports</span>} />
        <div className="kit-grid2">
          {popular.map((sport) => (
            <SportTile key={sport.id} sport={sport} selected={sport.id === requestedId} onSelect={start} />
          ))}
        </div>
      </section>

      {more.length > 0 && (
        <section aria-labelledby="play-more">
          <KitSection id="play-more" title={LATER_GROUP_LABEL} />
          <div className="kit-grid3">
            {more.map((sport) => (
              <SportTile key={sport.id} sport={sport} mini selected={sport.id === requestedId} onSelect={start} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
