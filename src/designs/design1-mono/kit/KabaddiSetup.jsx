// Kabaddi quick setup, split across the setup steps: the game step picks a preset, the teams step
// picks who raids first, the rules step shows and edits every rule. One model for rules: pick a
// preset, or edit any rule and the match becomes Custom (the Custom card is a state, not a second
// way in). The rules module and the saved match object are unchanged.
import { KABADDI_PRESETS, kabaddiRulesLine, resolveKabaddiRules } from '../../../utils/kabaddiRules';
import { KitChoiceGrid } from './KitFormControls';
import { KitSegmented } from './KitSetupParts';
import KabaddiRulesPanel from './KabaddiRulesPanel';
import './setupSteps.css';

const NAMED = KABADDI_PRESETS.filter(p => p.id !== 'custom');
const CUSTOM = KABADDI_PRESETS.find(p => p.id === 'custom');

/** The named preset a rules object started from (a Custom copy keeps its source and court). */
export function basePresetOf(r) {
  if (NAMED.some(p => p.id === r.presetId)) return r.presetId;
  if (/^House rules/.test(r.source || '')) return 'quick';
  if (/^Rectangular baseline/.test(r.source || '')) return 'pro';
  return r.court ? 'women' : 'standard';
}

const endText = end => end.kind === 'timed' ? `2 × ${end.halfMs / 60000} min halves`
  : end.kind === 'target' ? `first to ${end.points}` : `${end.raidsPerTeam} raids each`;

/** One plain line for a rules object: who, how it ends, which extras are on. */
export function kabaddiBlurb(r) {
  const extras = [r.raidLimitMs !== null && 'raid clock', r.bonus.enabled && 'bonus point', r.superTackle && 'super tackle', r.doOrDie && 'do-or-die'].filter(Boolean);
  return [`${r.initialPlayers} a side`, endText(r.end), extras.length ? extras.join(', ') : 'no clocks or extras'].join(' · ');
}

/** What differs from the preset the rules started from, as short plain phrases. */
export function kabaddiChanges(base, r) {
  const out = [];
  const diff = (label, a, b, text) => { if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${label}: ${text}`); };
  diff('Players a side', base.initialPlayers, r.initialPlayers, r.initialPlayers);
  diff('Play to', base.end, r.end, endText(r.end));
  diff('Revive in order', base.strategy, r.strategy, r.strategy === 'rectangularOuts' ? 'on' : 'off');
  diff('All-out points', base.outs.allOutPoints, r.outs.allOutPoints, r.outs.allOutPoints);
  diff('Raid clock', base.raidLimitMs, r.raidLimitMs, r.raidLimitMs === null ? 'off' : `${r.raidLimitMs / 1000} s`);
  diff('Bonus point', base.bonus, r.bonus, r.bonus.enabled ? `on, ${r.bonus.minDefenders}+ defenders` : 'off');
  diff('Super tackle', base.superTackle, r.superTackle, r.superTackle ? `on, up to ${r.superTackle.maxDefenders} defenders` : 'off');
  diff('Do-or-die', base.doOrDie, r.doOrDie, r.doOrDie ? `on, after ${r.doOrDie.emptyRaids} empty raids` : 'off');
  return out;
}

/** Step "What are you playing": one card per preset with a one-line description. */
export function KabaddiGameStep({ format, onChange }) {
  const r = format.kabaddiRules || resolveKabaddiRules('quick');
  const isNamed = NAMED.some(p => p.id === r.presetId);
  const options = [...NAMED.map(p => ({ id: p.id, label: p.label, hint: kabaddiBlurb(resolveKabaddiRules(p.id)) })),
    ...(isNamed ? [] : [{ ...CUSTOM, hint: `Your edited rules: ${kabaddiBlurb(r)}` }])];
  return <section className="kit-setup-field" aria-labelledby="kabaddi-format-label">
    <h2 id="kabaddi-format-label" className="kit-setup-label">What are you playing?</h2>
    <KitChoiceGrid labelledBy="kabaddi-format-label" columns={1} options={options} value={isNamed ? r.presetId : 'custom'}
      onChange={id => { if (id !== 'custom') onChange({ ...format, kabaddiRules: resolveKabaddiRules(id) }); }} />
  </section>;
}

/** Who raids first: it names the two teams, so it sits with them. */
export function KabaddiFirstRaid({ format, onChange, names = ['Team A', 'Team B'] }) {
  return <div className="kit-setup-field">
    <p id="kabaddi-first-raid" className="kit-setup-label">First raid</p>
    <KitSegmented labelledBy="kabaddi-first-raid"
      options={names.map((name, team) => ({ id: String(team), label: name || `Team ${team ? 'B' : 'A'}` }))}
      value={String(format.openingRaidTeam ?? 0)} onChange={id => onChange({ ...format, openingRaidTeam: Number(id) })} />
  </div>;
}

/** Step "Rules": a summary on top, what changed from the preset with one-tap reset, then the groups. */
export function KabaddiRulesStep({ format, onChange }) {
  const r = format.kabaddiRules || resolveKabaddiRules('quick');
  const baseId = basePresetOf(r);
  const baseLabel = NAMED.find(p => p.id === baseId).label;
  const changes = r.presetId === 'custom' ? kabaddiChanges(resolveKabaddiRules(baseId), r) : [];
  const setRules = kabaddiRules => onChange({ ...format, kabaddiRules });
  return <section className="kit-setup-field" aria-labelledby="kabaddi-rules-summary">
    <div className="kit-rules-summary">
      <h2 id="kabaddi-rules-summary">{r.presetId === 'custom' ? `Custom, based on ${baseLabel}` : baseLabel}</h2>
      <p>{kabaddiRulesLine(r)}</p>
      {changes.length > 0
        ? <ul className="kit-rules-changes" aria-label={`Changed from ${baseLabel}`}>{changes.map(c => <li key={c}>{c}</li>)}</ul>
        : <p className="kit-setup-rules" style={{ margin: 0 }}>Change any rule below and this match becomes Custom.</p>}
      {changes.length > 0 && <button type="button" className="se-ctl" onClick={() => setRules(resolveKabaddiRules(baseId))}>Reset to {baseLabel}</button>}
    </div>
    <KabaddiRulesPanel rules={r} onChange={setRules} />
  </section>;
}
