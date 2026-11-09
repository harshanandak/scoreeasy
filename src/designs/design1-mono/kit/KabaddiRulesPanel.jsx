import PropTypes from 'prop-types';
import { resolveKabaddiRules } from '../../../utils/kabaddiRules';
import { KitNumberStepper, KitToggleRow } from './KitFormControls';
import { KitSegmented } from './KitSetupParts';

const PLAY_TO = [
  { id: 'target', label: 'Target points' },
  { id: 'raids', label: 'Equal raids' },
  { id: 'timed', label: 'Two halves' },
];

const END_DEFAULTS = {
  target: { kind: 'target', points: 21 },
  raids: { kind: 'raids', raidsPerTeam: 10 },
  timed: { kind: 'timed', halves: 2, halfMs: 1200000, intervalMs: 300000 },
};

/**
 * Every kabaddi rule the scorer can change, as Kit controls. Self-contained: it takes the current
 * rules and reports the full next rules object, so it renders the same inline or inside a sheet.
 * Editing any rule makes the rules Custom (resolveKabaddiRules does that); presets are never edited
 * in place. The rule patches are the ones the old checkbox panel produced.
 */
export default function KabaddiRulesPanel({ rules: r, onChange }) {
  const change = patch => onChange(resolveKabaddiRules('custom', { ...r, ...patch }));
  const n = (label, value, min, max, update, extra = {}) => (
    <KitNumberStepper label={label} value={value} min={min} max={max} onChange={update} {...extra} />
  );
  return (
    <div className="kit-rules-panel" data-testid="kabaddi-rules-panel">
      <p className="kit-setup-rules" style={{ margin: 0 }}>Change any rule and this match uses Custom rules.</p>

      {n('Players a side', r.initialPlayers, 2, 12, v => change({
        initialPlayers: v,
        bonus: r.bonus.enabled ? { ...r.bonus, minDefenders: Math.min(v, r.bonus.minDefenders) } : r.bonus,
        superTackle: r.superTackle ? { ...r.superTackle, maxDefenders: Math.min(v, r.superTackle.maxDefenders) } : null,
      }))}

      <div className="kit-rules-block">
        <p id="kabaddi-play-to" className="kit-setup-label">Play to</p>
        <KitSegmented labelledBy="kabaddi-play-to" options={PLAY_TO} value={r.end.kind}
          onChange={id => { if (id !== r.end.kind) change({ end: END_DEFAULTS[id] }); }} />
      </div>
      {r.end.kind === 'target' && n('Target points', r.end.points, 1, 999, v => change({ end: { ...r.end, points: v } }), { hint: 'First team to this score wins.' })}
      {r.end.kind === 'raids' && n('Raids each', r.end.raidsPerTeam, 1, 999, v => change({ end: { ...r.end, raidsPerTeam: v } }))}
      {r.end.kind === 'timed' && <>
        {n('Minutes a half', r.end.halfMs / 60000, 1, 120, v => change({ end: { ...r.end, halfMs: v * 60000 } }))}
        {n('Interval minutes', r.end.intervalMs / 60000, 0, 30, v => change({ end: { ...r.end, intervalMs: v * 60000 } }))}
      </>}

      <KitToggleRow label="Players go out and revive in order" hint="Out players come back in the order they went out."
        checked={r.strategy === 'rectangularOuts'}
        onChange={on => change(on
          ? { strategy: 'rectangularOuts', outs: { mode: 'fifo', revival: 'onePerOpponentOut', allOutPoints: 2, restore: 'allOrdinary' } }
          : { strategy: 'pointsOnly', outs: { mode: 'pointsOnly', revival: 'none', allOutPoints: 0, restore: 'none' }, superTackle: null })} />
      {r.strategy === 'rectangularOuts' && <div className="kit-rules-sub">
        {n('All-out points', r.outs.allOutPoints, 0, 10, v => change({ outs: { ...r.outs, allOutPoints: v } }), { hint: 'Bonus when a whole side is out.' })}
        <KitToggleRow label="Super tackle" hint="Extra point for tackling when few defenders are left."
          checked={Boolean(r.superTackle)}
          onChange={on => change({ superTackle: on ? { maxDefenders: Math.min(3, r.initialPlayers), moment: 'raidStart', outcomes: 'anyRaiderOut', extraPoints: 1 } : null })} />
        {r.superTackle && <div className="kit-rules-sub">
          {n('Super tackle maximum defenders', r.superTackle.maxDefenders, 1, r.initialPlayers, v => change({ superTackle: { ...r.superTackle, maxDefenders: v } }))}
          <KitToggleRow label="Physical tackles only" hint="Out-of-bounds and lobby outs do not count."
            checked={r.superTackle.outcomes === 'physicalTackle'}
            onChange={on => change({ superTackle: { ...r.superTackle, outcomes: on ? 'physicalTackle' : 'anyRaiderOut' } })} />
        </div>}
      </div>}

      <KitToggleRow label="Raid clock" hint="Each raid has a time limit."
        checked={r.raidLimitMs !== null} onChange={on => change({ raidLimitMs: on ? 30000 : null })} />
      {r.raidLimitMs !== null && <div className="kit-rules-sub">
        {n('Raid seconds', r.raidLimitMs / 1000, 1, 120, v => change({ raidLimitMs: v * 1000 }), { unit: 's' })}
      </div>}

      <KitToggleRow label="Bonus point" hint="A raider can win an extra point when enough defenders are in."
        checked={r.bonus.enabled}
        onChange={on => change({ bonus: on ? { enabled: true, minDefenders: Math.min(6, r.initialPlayers), eligibility: 'raidStart', beforeContact: true, points: 1, revives: false } : { enabled: false } })} />
      {r.bonus.enabled && <div className="kit-rules-sub">
        {n('Bonus minimum defenders', r.bonus.minDefenders, 1, r.initialPlayers, v => change({ bonus: { ...r.bonus, minDefenders: v } }))}
      </div>}

      <KitToggleRow label="Do-or-die after empty raids" hint="After a run of empty raids, the next raider must score or go out."
        checked={Boolean(r.doOrDie)}
        onChange={on => change({ doOrDie: on ? { emptyRaids: 2, onFailure: 'raiderOut', carryAcrossHalf: true } : null })} />
      {r.doOrDie && <div className="kit-rules-sub">
        {n('Empty raids before do-or-die', r.doOrDie.emptyRaids, 1, 10, v => change({ doOrDie: { ...r.doOrDie, emptyRaids: v } }))}
        <KitToggleRow label="Carry empty streak across halves"
          checked={r.doOrDie.carryAcrossHalf} onChange={on => change({ doOrDie: { ...r.doOrDie, carryAcrossHalf: on } })} />
      </div>}

      <details className="kit-rules-more">
        <summary>How scoring ends</summary>
        <p className="kit-setup-rules">Targets resolve after the complete raid. Tied targets continue. Equal raids allow a draw. A technical point alone waits for the next completed raid.</p>
        <p className="kit-setup-rules">Line decisions and match administration stay with the referee. Beach, Circle and shootouts are not supported.</p>
      </details>
    </div>
  );
}
KabaddiRulesPanel.propTypes = {
  rules: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};
