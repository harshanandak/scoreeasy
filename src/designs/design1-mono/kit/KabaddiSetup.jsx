import { useState } from 'react';
import { KABADDI_PRESETS, kabaddiRulesLine, resolveKabaddiRules } from '../../../utils/kabaddiRules';

export default function KabaddiSetup({ format, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const r = format.kabaddiRules || resolveKabaddiRules('quick');
  const change = patch => onChange({ ...format, kabaddiRules: resolveKabaddiRules('custom', { ...r, ...patch }) });
  const number = (label, value, min, max, update) => <label className="kit-rules-group" style={{ display: 'grid', gap: 8 }}>
    {label}<input aria-label={label} type="number" min={min} max={max} value={value} onChange={e => {
      const n = Number(e.target.value);
      if (Number.isSafeInteger(n) && n >= min && n <= max) update(n);
    }} style={{ minHeight: 48, padding: 10, color: 'var(--se-color-ink)', background: 'var(--se-color-surface)', border: '1px solid currentColor' }} />
  </label>;
  return <section className="kit-setup-field" aria-labelledby="kabaddi-format-label">
    <h2 id="kabaddi-format-label" className="kit-setup-label">What are you playing?</h2>
    <div role="group" aria-labelledby="kabaddi-format-label" style={{ display: 'grid', gap: 8 }}>
      {KABADDI_PRESETS.map(p => <button type="button" key={p.id} aria-pressed={r.presetId === p.id}
        className={r.presetId === p.id ? 'mono-btn-primary' : 'mono-btn'} style={{ minHeight: 48 }}
        onClick={() => { onChange({ ...format, kabaddiRules: resolveKabaddiRules(p.id, p.id === 'custom' ? r : undefined) }); if (p.id === 'custom') setExpanded(true); }}>{p.label}</button>)}
    </div>
    <div className="kit-setup-rules-row">
      <p className="kit-setup-rules">{kabaddiRulesLine(r)}</p>
      <button type="button" className="kit-setup-link" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>Change rules</button>
    </div>
    {expanded && <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
      <p className="kit-setup-rules">Changes use Custom rules. Line decisions and match administration stay with the referee. Beach, Circle and shootouts are not supported.</p>
      {number('Players a side', r.initialPlayers, 2, 12, n => change({ initialPlayers: n,
        bonus: r.bonus.enabled ? { ...r.bonus, minDefenders: Math.min(n, r.bonus.minDefenders) } : r.bonus,
        superTackle: r.superTackle ? { ...r.superTackle, maxDefenders: Math.min(n, r.superTackle.maxDefenders) } : null }))}
      <label>Play to<select aria-label="Play to" value={r.end.kind} onChange={e => change({ end: e.target.value === 'target' ? { kind: 'target', points: 21 } : e.target.value === 'raids' ? { kind: 'raids', raidsPerTeam: 10 } : { kind: 'timed', halves: 2, halfMs: 1200000, intervalMs: 300000 } })} style={{ display: 'block', minHeight: 48, width: '100%' }}>
        <option value="target">Target points</option><option value="raids">Equal raids</option><option value="timed">Two halves</option>
      </select></label>
      {r.end.kind === 'target' && number('Target points', r.end.points, 1, 999, n => change({ end: { ...r.end, points: n } }))}
      {r.end.kind === 'raids' && number('Raids each', r.end.raidsPerTeam, 1, 999, n => change({ end: { ...r.end, raidsPerTeam: n } }))}
      {r.end.kind === 'timed' && <>
        {number('Minutes a half', r.end.halfMs / 60000, 1, 120, n => change({ end: { ...r.end, halfMs: n * 60000 } }))}
        {number('Interval minutes', r.end.intervalMs / 60000, 0, 30, n => change({ end: { ...r.end, intervalMs: n * 60000 } }))}
      </>}
      <label><input type="checkbox" checked={r.strategy === 'rectangularOuts'} onChange={e => change(e.target.checked
        ? { strategy: 'rectangularOuts', outs: { mode: 'fifo', revival: 'onePerOpponentOut', allOutPoints: 2, restore: 'allOrdinary' } }
        : { strategy: 'pointsOnly', outs: { mode: 'pointsOnly', revival: 'none', allOutPoints: 0, restore: 'none' }, superTackle: null })} /> Players go out and revive in order</label>
      <label><input type="checkbox" checked={r.raidLimitMs !== null} onChange={e => change({ raidLimitMs: e.target.checked ? 30000 : null })} /> Raid clock</label>
      {r.raidLimitMs !== null && number('Raid seconds', r.raidLimitMs / 1000, 1, 120, n => change({ raidLimitMs: n * 1000 }))}
      <label><input type="checkbox" checked={r.bonus.enabled} onChange={e => change({ bonus: e.target.checked ? { enabled: true, minDefenders: Math.min(6, r.initialPlayers), eligibility: 'raidStart', beforeContact: true, points: 1, revives: false } : { enabled: false } })} /> Bonus point</label>
      {r.bonus.enabled && number('Bonus minimum defenders', r.bonus.minDefenders, 1, r.initialPlayers, n => change({ bonus: { ...r.bonus, minDefenders: n } }))}
      {r.strategy === 'rectangularOuts' && <>
        <label><input type="checkbox" checked={Boolean(r.superTackle)} onChange={e => change({ superTackle: e.target.checked ? { maxDefenders: Math.min(3, r.initialPlayers), moment: 'raidStart', outcomes: 'anyRaiderOut', extraPoints: 1 } : null })} /> Super tackle</label>
        {r.superTackle && <>
          {number('Super tackle maximum defenders', r.superTackle.maxDefenders, 1, r.initialPlayers, n => change({ superTackle: { ...r.superTackle, maxDefenders: n } }))}
          <label><input type="checkbox" checked={r.superTackle.outcomes === 'physicalTackle'} onChange={e => change({ superTackle: { ...r.superTackle, outcomes: e.target.checked ? 'physicalTackle' : 'anyRaiderOut' } })} /> Physical tackles only</label>
        </>}
        {number('All-out points', r.outs.allOutPoints, 0, 10, n => change({ outs: { ...r.outs, allOutPoints: n } }))}
      </>}
      <label><input type="checkbox" checked={Boolean(r.doOrDie)} onChange={e => change({ doOrDie: e.target.checked ? { emptyRaids: 2, onFailure: 'raiderOut', carryAcrossHalf: true } : null })} /> Do-or-die after empty raids</label>
      {r.doOrDie && <>
        {number('Empty raids before do-or-die', r.doOrDie.emptyRaids, 1, 10, n => change({ doOrDie: { ...r.doOrDie, emptyRaids: n } }))}
        <label><input type="checkbox" checked={r.doOrDie.carryAcrossHalf} onChange={e => change({ doOrDie: { ...r.doOrDie, carryAcrossHalf: e.target.checked } })} /> Carry empty streak across halves</label>
      </>}
      <p className="kit-setup-rules">Targets resolve after the complete raid. Tied targets continue. Equal raids allow a draw. A technical point alone waits for the next completed raid.</p>
    </div>}
  </section>;
}
