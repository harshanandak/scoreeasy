import { useState } from 'react';
import { KABADDI_PRESETS, kabaddiRulesLine, resolveKabaddiRules } from '../../../utils/kabaddiRules';
import { KitChoiceGrid } from './KitFormControls';
import { KitSegmented } from './KitSetupParts';
import KabaddiRulesPanel from './KabaddiRulesPanel';

const NAMED = KABADDI_PRESETS.filter(p => p.id !== 'custom');
const CUSTOM = KABADDI_PRESETS.find(p => p.id === 'custom');

/**
 * One model for rules: pick a preset, or open Change rules and edit anything, which makes the match
 * Custom. The Custom chip only appears once rules are edited (it is a state, not a second way in).
 */
export default function KabaddiSetup({ format, onChange, names = ['Team A', 'Team B'] }) {
  const [expanded, setExpanded] = useState(false);
  const r = format.kabaddiRules || resolveKabaddiRules('quick');
  const isNamed = NAMED.some(p => p.id === r.presetId);
  const options = isNamed ? NAMED : [...NAMED, CUSTOM];
  const setRules = kabaddiRules => onChange({ ...format, kabaddiRules });
  return <section className="kit-setup-field" aria-labelledby="kabaddi-format-label">
    <h2 id="kabaddi-format-label" className="kit-setup-label">What are you playing?</h2>
    <KitChoiceGrid labelledBy="kabaddi-format-label" options={options} value={isNamed ? r.presetId : 'custom'}
      onChange={id => { if (id !== 'custom') setRules(resolveKabaddiRules(id)); }} />
    <div className="kit-setup-rules-row">
      <p className="kit-setup-rules">{kabaddiRulesLine(r)}</p>
      <button type="button" className="se-ctl kit-rules-toggle" aria-expanded={expanded} aria-controls="kabaddi-rules-panel"
        onClick={() => setExpanded(v => !v)}>{expanded ? 'Done' : 'Change rules'}</button>
    </div>
    {expanded && <div id="kabaddi-rules-panel"><KabaddiRulesPanel rules={r} onChange={setRules} /></div>}
    <div style={{ marginTop: 16 }}>
      <p id="kabaddi-first-raid" className="kit-setup-label">First raid</p>
      <KitSegmented labelledBy="kabaddi-first-raid"
        options={names.map((name, team) => ({ id: String(team), label: name || `Team ${team ? 'B' : 'A'}` }))}
        value={String(format.openingRaidTeam ?? 0)} onChange={id => onChange({ ...format, openingRaidTeam: Number(id) })} />
    </div>
  </section>;
}
