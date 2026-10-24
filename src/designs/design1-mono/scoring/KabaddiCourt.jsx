import { useRef } from 'react';
import PropTypes from 'prop-types';

// The kabaddi court, top down: the midline across the screen, each team's half tinted in its
// colour with the baulk and bonus lines, the players on the mat as anonymous tokens, the sitting
// block behind each end line, and the raider at (or across) the midline. Presentation only: every
// count, eligibility and preview comes from the board, which reads it from the raid engine.
// Tokens are counts, never players: no names, numbers or positions are implied.

const teamKey = (team) => (team === 0 ? 'a' : 'b');

/** One half: lines, the mat row, and (for the defending side during a raid) the bonus line. */
function Half({ side, edge, sweep }) {
  const { team, name, tokens, raider, bonus, pick, tags, overlay, superOn, moment } = side;
  const key = teamKey(team);
  const touchable = tokens.some((t) => t.onToggle);
  const handlers = touchable ? sweep.handlers : {};
  return (
    <div
      className={`kb-half kb-half-${edge} kb-half-${key}`}
      data-super={superOn ? '' : undefined}
      data-moment={moment ?? undefined}
      data-picked={pick?.pressed ? '' : undefined}
      role="group"
      aria-label={`${name} half`}
    >
      <i className="kb-line kb-line-baulk" aria-hidden="true" />
      <i className="kb-lobby" aria-hidden="true" />
      {pick && (
        <button type="button" className="kb-pick" aria-pressed={pick.pressed} onClick={pick.onPick}>
          <span>{name} raid first</span>
        </button>
      )}
      <div className="kb-row" {...handlers}>
        {tokens.map((t) => (t.onToggle ? (
          <button
            key={t.slot}
            type="button"
            className={`kb-tok kb-tok-${key} kb-tok-btn`}
            data-slot={t.slot}
            data-state={t.state}
            style={{ '--i': t.index }}
            aria-pressed={t.state === 'touched' || t.state === 'void'}
            aria-label={`${name} defender ${t.index + 1}`}
            onClick={(e) => sweep.click(e, t.slot)}
          >
            <i aria-hidden="true" />
          </button>
        ) : (
          <span key={t.slot} className={`kb-tok kb-tok-${key}`} data-state={t.state} style={{ '--i': t.index }} aria-hidden="true"><i /></span>
        )))}
      </div>
      {bonus ? (
        <button type="button" className={`kb-bonus kb-bonus-${teamKey(1 - team)}`} aria-pressed={bonus.on} disabled={!bonus.eligible} onClick={bonus.onToggle}>
          <i className="kb-line kb-line-bonus" aria-hidden="true" />
          <span className="kb-bonus-pill">
            {bonus.eligible ? <><b>{bonus.on ? '✓ Bonus' : 'Bonus'}</b> +1</> : <>Bonus · needs 6</>}
          </span>
        </button>
      ) : (
        <span className="kb-bonus kb-bonus-static" aria-hidden="true"><i className="kb-line kb-line-bonus" /></span>
      )}
      {tags.length > 0 && <span className="kb-tags">{tags}</span>}
      {raider && (
        <span className={`kb-raider kb-tok-${teamKey(raider.team)}`} data-state={raider.state} data-dod={raider.doOrDie ? '' : undefined} aria-hidden="true">
          <i className="kb-raider-mark" />
        </span>
      )}
      {overlay}
    </div>
  );
}

Half.propTypes = {
  side: PropTypes.object.isRequired,
  edge: PropTypes.oneOf(['top', 'bottom']).isRequired,
  sweep: PropTypes.object.isRequired,
};

/** Behind each end line: the team, its mat count, and the players sitting out in revival order. */
function Sitting({ side, edge }) {
  const { team, name, onMat, sitting, note } = side;
  const key = teamKey(team);
  return (
    <div className={`kb-sit kb-sit-${edge}`}>
      <span className="kb-sit-team">
        <i className={`kb-pip kb-pip-${key}`} aria-hidden="true" />
        <b>{name}</b>
        <span className="kb-matcount" role="img" aria-label={`${name}: ${onMat} of 7 on mat${sitting ? `, ${sitting} out` : ''}`}>
          <b>{onMat}</b> on mat
        </span>
      </span>
      {note}
      <span className="kb-sit-block" aria-hidden="true">
        {sitting > 0 ? (
          <>
            <span className="kb-sit-label">Sitting · next in →</span>
            {Array.from({ length: sitting }, (_, i) => <i key={i} className={`kb-seat kb-seat-${key}`} data-next={i === 0 ? '' : undefined} />)}
          </>
        ) : <span className="kb-sit-label">Sitting block empty</span>}
      </span>
    </div>
  );
}

Sitting.propTypes = { side: PropTypes.object.isRequired, edge: PropTypes.oneOf(['top', 'bottom']).isRequired };

/**
 * Touch marking: tap a defender to mark or clear it, or drag across several in one stroke (the
 * raider's sweep). Keyboard and screen readers use the buttons one by one.
 */
function useSweep(onSet) {
  const drag = useRef(null);
  const slotAt = (x, y) => document.elementFromPoint?.(x, y)?.closest?.('[data-slot]')?.getAttribute('data-slot') ?? null;
  return {
    click(event, slot) {
      // A pointer press already marked this token; the click that follows must not undo it.
      if (drag.current?.handled?.has(slot)) {
        drag.current = null;
        return;
      }
      drag.current = null;
      onSet(slot, null);
    },
    handlers: {
      onPointerDown(event) {
        const slot = event.target.closest?.('[data-slot]')?.getAttribute('data-slot');
        if (!slot) return;
        const mark = event.target.closest('[data-slot]').getAttribute('aria-pressed') !== 'true';
        drag.current = { mark, handled: new Set([slot]) };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        onSet(slot, mark);
      },
      onPointerMove(event) {
        if (!drag.current) return;
        const slot = slotAt(event.clientX, event.clientY);
        if (!slot || drag.current.handled.has(slot)) return;
        drag.current.handled.add(slot);
        onSet(slot, drag.current.mark);
      },
      onPointerUp() {
        // The click that ends this press (if any) runs first; then a later keyboard press toggles.
        const ended = drag.current;
        setTimeout(() => { if (drag.current === ended) drag.current = null; }, 0);
      },
    },
  };
}

export default function KabaddiCourt({ sides, midline, overlay, onTouch, dim = false }) {
  const sweep = useSweep(onTouch ?? (() => {}));
  const [top, bottom] = sides;
  return (
    <div className="kb-courtwrap" data-dim={dim ? '' : undefined}>
      <Sitting side={top} edge="top" />
      <div className="kb-court">
        <Half side={top} edge="top" sweep={sweep} />
        <div className="kb-mid">
          <i className="kb-line kb-line-mid" aria-hidden="true" />
          {midline.left && <span className="kb-mid-left">{midline.left}</span>}
          {midline.centre && <span className="kb-mid-centre">{midline.centre}</span>}
          {midline.right && <span className="kb-mid-right">{midline.right}</span>}
        </div>
        <Half side={bottom} edge="bottom" sweep={sweep} />
        {overlay}
      </div>
      <Sitting side={bottom} edge="bottom" />
    </div>
  );
}

KabaddiCourt.propTypes = {
  sides: PropTypes.arrayOf(PropTypes.object).isRequired,
  midline: PropTypes.shape({ left: PropTypes.node, centre: PropTypes.node, right: PropTypes.node }).isRequired,
  overlay: PropTypes.node,
  onTouch: PropTypes.func,
  dim: PropTypes.bool,
};
