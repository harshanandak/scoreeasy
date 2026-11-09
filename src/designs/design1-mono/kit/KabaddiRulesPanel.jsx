import PropTypes from 'prop-types';
import { resolveKabaddiRules } from '../../../utils/kabaddiRules';
import { KitNumberStepper, KitToggleRow } from './KitFormControls';
import { MoreRules, RulesPanel, RulesSegmentRow, RulesSub } from './RulesParts';

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
 * Every kabaddi rule the scorer can change, as compact Kit rows (label left, control right). The
 * common rules show first (players a side, play to, raid clock); the rest sit under one collapsed
 * "More rules" row. Self-contained: it takes the current rules and reports the full next rules
 * object, so it renders the same inline or inside a sheet. Editing any rule makes the rules Custom
 * (resolveKabaddiRules does that); presets are never edited in place. The rule patches are the
 * ones the old checkbox panel produced.
 */
export default function KabaddiRulesPanel({ rules: r, onChange }) {
  const change = patch => onChange(resolveKabaddiRules('custom', { ...r, ...patch }));
  const n = (label, value, min, max, update, extra = {}) => (
    <KitNumberStepper label={label} value={value} min={min} max={max} onChange={update} {...extra} />
  );
  return (
    <RulesPanel testId="kabaddi-rules-panel">
      {n('Players a side', r.initialPlayers, 2, 12, v => change({
        initialPlayers: v,
        bonus: r.bonus.enabled ? { ...r.bonus, minDefenders: Math.min(v, r.bonus.minDefenders) } : r.bonus,
        superTackle: r.superTackle ? { ...r.superTackle, maxDefenders: Math.min(v, r.superTackle.maxDefenders) } : null,
      }))}

      <RulesSegmentRow label="Play to" options={PLAY_TO} value={r.end.kind}
        onChange={id => { if (id !== r.end.kind) change({ end: END_DEFAULTS[id] }); }} />
      {r.end.kind === 'target' && n('Target points', r.end.points, 1, 999, v => change({ end: { ...r.end, points: v } }))}
      {r.end.kind === 'raids' && n('Raids each', r.end.raidsPerTeam, 1, 999, v => change({ end: { ...r.end, raidsPerTeam: v } }))}
      {r.end.kind === 'timed' && <>
        {n('Minutes a half', r.end.halfMs / 60000, 1, 120, v => change({ end: { ...r.end, halfMs: v * 60000 } }))}
        {n('Interval minutes', r.end.intervalMs / 60000, 0, 30, v => change({ end: { ...r.end, intervalMs: v * 60000 } }))}
      </>}

      <KitToggleRow label="Raid clock"
        checked={r.raidLimitMs !== null} onChange={on => change({ raidLimitMs: on ? 30000 : null })} />
      {r.raidLimitMs !== null && <RulesSub>
        {n('Raid seconds', r.raidLimitMs / 1000, 1, 120, v => change({ raidLimitMs: v * 1000 }), { unit: 's' })}
      </RulesSub>}

      <MoreRules>
        <KitToggleRow label="Players go out and revive in order" info="Out players come back in the order they went out."
          checked={r.strategy === 'rectangularOuts'}
          onChange={on => change(on
            ? { strategy: 'rectangularOuts', outs: { mode: 'fifo', revival: 'onePerOpponentOut', allOutPoints: 2, restore: 'allOrdinary' } }
            : { strategy: 'pointsOnly', outs: { mode: 'pointsOnly', revival: 'none', allOutPoints: 0, restore: 'none' }, superTackle: null })} />
        {r.strategy === 'rectangularOuts' && <RulesSub>
          {n('All-out points', r.outs.allOutPoints, 0, 10, v => change({ outs: { ...r.outs, allOutPoints: v } }), { info: 'Bonus when a whole side is out.' })}
          <KitToggleRow label="Super tackle" info="Extra point for tackling when few defenders are left."
            checked={Boolean(r.superTackle)}
            onChange={on => change({ superTackle: on ? { maxDefenders: Math.min(3, r.initialPlayers), moment: 'raidStart', outcomes: 'anyRaiderOut', extraPoints: 1 } : null })} />
          {r.superTackle && <RulesSub>
            {n('Super tackle maximum defenders', r.superTackle.maxDefenders, 1, r.initialPlayers, v => change({ superTackle: { ...r.superTackle, maxDefenders: v } }))}
            <KitToggleRow label="Physical tackles only" info="Out-of-bounds and lobby outs do not count."
              checked={r.superTackle.outcomes === 'physicalTackle'}
              onChange={on => change({ superTackle: { ...r.superTackle, outcomes: on ? 'physicalTackle' : 'anyRaiderOut' } })} />
          </RulesSub>}
        </RulesSub>}

        <KitToggleRow label="Bonus point" info="A raider can win an extra point when enough defenders are in."
          checked={r.bonus.enabled}
          onChange={on => change({ bonus: on ? { enabled: true, minDefenders: Math.min(6, r.initialPlayers), eligibility: 'raidStart', beforeContact: true, points: 1, revives: false } : { enabled: false } })} />
        {r.bonus.enabled && <RulesSub>
          {n('Bonus minimum defenders', r.bonus.minDefenders, 1, r.initialPlayers, v => change({ bonus: { ...r.bonus, minDefenders: v } }))}
        </RulesSub>}

        <KitToggleRow label="Do-or-die after empty raids" info="After a run of empty raids, the next raider must score or go out."
          checked={Boolean(r.doOrDie)}
          onChange={on => change({ doOrDie: on ? { emptyRaids: 2, onFailure: 'raiderOut', carryAcrossHalf: true } : null })} />
        {r.doOrDie && <RulesSub>
          {n('Empty raids before do-or-die', r.doOrDie.emptyRaids, 1, 10, v => change({ doOrDie: { ...r.doOrDie, emptyRaids: v } }))}
          <KitToggleRow label="Carry empty streak across halves"
            checked={r.doOrDie.carryAcrossHalf} onChange={on => change({ doOrDie: { ...r.doOrDie, carryAcrossHalf: on } })} />
        </RulesSub>}

        <details className="kit-rules-more">
          <summary>How scoring ends</summary>
          <p className="kit-setup-rules">Targets resolve after the complete raid. Tied targets continue. Equal raids allow a draw. A technical point alone waits for the next completed raid.</p>
          <p className="kit-setup-rules">Line decisions and match administration stay with the referee. Beach, Circle and shootouts are not supported.</p>
        </details>
      </MoreRules>
    </RulesPanel>
  );
}
KabaddiRulesPanel.propTypes = {
  rules: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};
