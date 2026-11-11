import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getSportById } from '../../models/sportRegistry';
import { sportIdentity } from '../../lib/sportIdentity';
import { KitTop, KitWash } from './kit/KitParts';
import SportPicker from './kit/SportPicker';

/* Play hub (Kit, plan 2026-10-22 §9 S1): every registered sport as an engine-gated identity tile,
   in sportFocus order. Popular is two columns with the hint line; More sports is three, name only.
   A tile starts a quick match; that setup screen carries the switch to tournament setup.
   /play?sport=<id> (marketing sport links, the quick scorer's Back) marks that sport's tile with
   the selected ink ring and scrolls it into view; an id the registry doesn't know is ignored. */
export default function MonoPlayHub() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedId = getSportById(searchParams.get('sport')?.toLowerCase())?.id ?? null;
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

      <SportPicker onSelect={start} selectedId={requestedId} idPrefix="play" />
    </div>
  );
}
