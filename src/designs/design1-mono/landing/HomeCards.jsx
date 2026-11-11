import PropTypes from 'prop-types';
import { memo, useEffect, useState } from 'react';
import { getSportById } from '../../../models/sportRegistry';
import { PRESETS, deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import { sportIdentityVars } from '../../../lib/sportIdentity';
import { SportBadge } from '../kit/KitParts';
import { MOMENT_OPACITY, momentStack } from './cardTimelines';
import './homeCards.css';

/* The art inside each Home card. Every card is drawn from one state of its timeline (cardTimelines.js)
   and holds no clock of its own; all of it is hidden from assistive tech, the card's picture
   carries one label that says what happens. */

const ROLL_OUT_MS = 520;

/* Text that rolls (the old value fades up and out, the new one rises in) whenever `value` changes. */
export function Roll({ value, dir = 1, as: Tag = 'div', className = '', children }) {
  const [shown, setShown] = useState({ now: value, old: null });
  if (shown.now !== value) setShown({ now: value, old: shown.now });
  useEffect(() => {
    if (shown.old === null) return undefined;
    const timer = window.setTimeout(() => setShown((current) => ({ ...current, old: null })), ROLL_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [shown.now, shown.old]);
  const changed = shown.old !== null;
  return (
    <Tag className={`home-roller ${className}`} style={{ '--dir': dir }}>
      {children}
      {changed && <span key={`out-${shown.old}`} className="home-r is-out" aria-hidden="true">{shown.old}</span>}
      <span key={`now-${shown.now}`} className={`home-r${changed ? ' is-in' : ''}`}>{shown.now}</span>
    </Tag>
  );
}
Roll.propTypes = {
  value: PropTypes.string.isRequired,
  dir: PropTypes.number,
  as: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node,
};

const Touch = () => <i className="home-touch" aria-hidden="true" />;

// ---- tap: Tap. The rule answers. -------------------------------------------------------------
function TapArt({ s }) {
  return (
    <div className="home-tap" aria-hidden="true">
      <div className="home-tap-mid">
        <Roll className={`home-tap-call${s.hot ? ' is-hot' : ''}`} value={s.call}>
          <svg className="home-tap-swoosh" viewBox="0 0 120 16" preserveAspectRatio="none" aria-hidden="true">
            <path d="M2.5 9.6C26 6.4 58 5 117 6.6C96 7.6 70 9.4 48 12.6" vectorEffect="non-scaling-stroke" />
          </svg>
        </Roll>
        <Roll className="home-tap-rule" value={s.rule} />
      </div>
      <div className="home-tap-keys">
        <div className={`home-tap-key is-a${s.down === 'a' ? ' is-down' : ''}`}>
          <span className="home-tap-name">Asha</span>
          <Roll as="span" className="home-tap-pt" value={s.pa} />
          <Touch />
        </div>
        <div className={`home-tap-key is-b${s.down === 'b' ? ' is-down' : ''}`}>
          <span className="home-tap-name">Meera</span>
          <Roll as="span" className="home-tap-pt" value={s.pb} />
          <Touch />
        </div>
      </div>
    </div>
  );
}

// ---- undo: Wrong tap? Undo. ------------------------------------------------------------------
function UndoArt({ s }) {
  return (
    <div className="home-undo" aria-hidden="true">
      <div className="home-undo-mid">
        <Roll className="home-undo-num" value={s.num} dir={s.dir} />
        <div className="home-undo-side">
          <div className="home-undo-label">Runs this over</div>
          <Roll className="home-undo-status" value={s.status} dir={s.dir} />
          <Roll className="home-undo-cap" value={s.cap} dir={s.dir} />
        </div>
      </div>
      <div className="home-undo-row">
        <div className="home-undo-balls">
          {s.balls.map((ball, i) => (
            // The six slots of an over never reorder, so the index is their identity.
            <span key={i} className={`home-undo-ball${ball.on ? ' is-on' : ''}${ball.t === '4' || ball.t === '6' ? ' is-big' : ''}`}><i>{ball.t}</i></span>
          ))}
        </div>
        <div className={`home-undo-btn${s.down ? ' is-down' : ''}`}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
          Undo
        </div>
      </div>
    </div>
  );
}

// ---- live: Friends follow live. --------------------------------------------------------------
function LiveArt({ s }) {
  return (
    <div className={`home-live${s.off ? ' is-off' : ''}`} aria-hidden="true">
      <div className="home-live-phone is-a">
        <div className="home-live-who">You score</div>
        <div className="home-live-team">City</div>
        <Roll className="home-live-num" value={s.na} />
        <Roll className={`home-live-chip${s.kind ? ` is-${s.kind}` : ''}`} value={s.chip} />
        <div className={`home-live-key${s.down ? ' is-down' : ''}`}>Goal<Touch /></div>
      </div>
      <div className={`home-live-phone is-b${s.on ? ' is-on' : ''}`}>
        <div className="home-live-wait">Riya is waiting for the link</div>
        <div className="home-live-on">
          <Roll className="home-live-who" value={s.who} />
          <div className="home-live-team">City</div>
          <Roll className="home-live-num" value={s.nb} />
          <div className="home-live-foot">Riya&apos;s phone</div>
        </div>
      </div>
      <div className="home-live-lane">
        <div className="home-live-wire" />
        <i className={`home-live-pkt${s.p1 ? ` is-${s.p1}` : ''}`} style={{ '--y': `${s.y1}px` }} />
        <i className={`home-live-pkt${s.p2 ? ` is-${s.p2}` : ''}`} style={{ '--y': '8px' }} />
        <div className="home-live-nosig">No signal</div>
      </div>
      <div className={`home-live-link${s.link ? ` is-${s.link}` : ''}`}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" /></svg>
        Live link
      </div>
    </div>
  );
}

// ---- moments: Nine sports, every rule. -------------------------------------------------------
function MomentsArt({ s }) {
  return (
    <div className="home-mom" aria-hidden="true">
      {momentStack(s.tick).map(({ card, moment: [sportId, title, line], slot }) => (
        <div key={card} className="home-mom-card" style={{ '--slot': slot, '--op': MOMENT_OPACITY[slot] }}>
          <SportBadge sportId={sportId} />
          <span className="home-mom-text">
            <span className="home-mom-sport">{getSportById(sportId).name}</span>
            <span className="home-mom-title">{title}</span>
            <span className="home-mom-sub">{line}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ---- paper: Paper, minus the sums. -----------------------------------------------------------
function PaperArt({ s }) {
  return (
    <div className={`home-paper${s.mode ? ` is-${s.mode}` : ''}`} aria-hidden="true">
      <div className="home-paper-sheet">
        <span className="home-paper-tag">By hand</span>
        <div className="home-paper-line"><span className="home-paper-tilt">Over 19</span><small>Aus chasing 176</small></div>
        <div className="home-paper-line"><span>1</span><span>4</span><span>W</span><span>2</span></div>
        <div className="home-paper-line">
          <span>157 + 7 =</span>
          <span className="home-paper-x">163<svg viewBox="0 0 60 30" preserveAspectRatio="none"><path d="M3 22C18 14 40 9 57 5M5 7C22 12 40 19 56 25" vectorEffect="non-scaling-stroke" /></svg></span>
          <span className="home-paper-tilt">164</span>
        </div>
        <div className="home-paper-line"><span>need 13?</span><span className="home-paper-tilt">12?</span><small>balls left ...</small></div>
      </div>
      <div className="home-paper-clip">
        <div className="home-paper-app">
          <div className="home-paper-head">
            <SportBadge sportId="cricket" />
            <span>Cricket</span>
            <span className="home-paper-tag">Score Easy</span>
          </div>
          <div className="home-paper-balls">
            <span className="home-paper-ball">1</span><span className="home-paper-ball">4</span>
            <span className="home-paper-ball is-w">W</span><span className="home-paper-ball">2</span>
            <span className={`home-paper-ball is-empty${s.hit ? ' is-hit' : ''}`}><i>6</i></span>
            <span className="home-paper-ball is-empty" />
          </div>
          <div className="home-paper-over">Over 19</div>
          <Roll className="home-paper-need" value={s.need} />
          <Roll className="home-paper-foot" value={s.foot} />
        </div>
        <i className={`home-paper-edge${s.left ? ' is-left' : ''}`} />
      </div>
    </div>
  );
}

const ART = { tap: TapArt, undo: UndoArt, live: LiveArt, moments: MomentsArt, paper: PaperArt };

/* Colours a card needs beyond the app tokens: the tennis keys are a sky and a navy side (the same
   pair the tennis board uses), and the live card's Goal key is football's identity green. */
const TAP_VARS = teamColourVars(deriveTeamColours(...PRESETS['Sky v Navy']));
export const cardVars = (card) => {
  if (card.id === 'tap') return TAP_VARS;
  if (card.id === 'live') return sportIdentityVars('football');
  return undefined;
};

/** One card's head (title, sport badge) and its art, drawn from `state`. */
export const CardFace = memo(function CardFace({ card, state }) {
  const Art = ART[card.id];
  return (
    <>
      <div className="home-card-head">
        <h3 className="home-card-title">{card.title}</h3>
        {card.sportId && <SportBadge sportId={card.sportId} />}
      </div>
      <div className="home-card-art" role="img" aria-label={card.label}>
        <Art s={state} />
      </div>
    </>
  );
});
CardFace.propTypes = {
  card: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    sportId: PropTypes.string,
  }).isRequired,
  state: PropTypes.shape({}).isRequired,
};
