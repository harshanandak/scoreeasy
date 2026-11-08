import { applySetsPreset, SETS_PROFILES } from '../../../models/setsRules';

const controlStyle = { minHeight: 44, width: '100%', color: 'var(--se-color-ink)', background: 'var(--se-color-surface)' };

export function ServerChoice({ value, onChange, names = ['Team A', 'Team B'], label = 'First server' }) {
  return <label className="kit-setup-label">{label}
    <select aria-label={label} style={controlStyle} value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">Server unknown</option>
      <option value="1">{names[0]}</option>
      <option value="2">{names[1]}</option>
    </select>
  </label>;
}

export default function SetsRulesControls({ sport, format, onChange, names }) {
  const profile = SETS_PROFILES[sport];
  const custom = format.customization || {};
  const change = (key, value) => onChange({ ...format, rulesPreset: 'Custom school', customization: { ...custom, [key]: value } });
  return <div className="kit-rules-group">
    <label className="kit-setup-label">Rules preset
      <select aria-label="Rules preset" style={controlStyle} value={format.rulesPreset === profile.label ? 'official' : format.rulesPreset === 'Custom school' ? 'custom' : 'casual'} onChange={e => onChange(applySetsPreset(sport, e.target.value, format))}>
        <option value="casual">Quick casual</option>
        <option value="custom">Custom school</option>
        <option value="official">{profile.label}</option>
      </select>
    </label>
    <ServerChoice value={format.initialServer} names={names} onChange={initialServer => onChange({ ...format, initialServer })} />
    <p className="kit-setup-hint">Team-level service. Choose unknown if the toss has not been recorded.</p>
    {format.rulesPreset === profile.label && <p className="kit-setup-hint"><a href={profile.source} target="_blank" rel="noreferrer">Rules source and edition</a></p>}
    {format.rulesPreset === 'Custom school' && <>
      <p className="kit-setup-hint">Use your event circular. This is not an SGFI preset.</p>
      <label className="kit-setup-label">Number of {profile.unit.toLowerCase()}s
        <select aria-label="Number of games or sets" style={controlStyle} value={format.type === 'single' ? 1 : format.sets} onChange={e => { const sets = Number(e.target.value); onChange({ ...format, sets, type: sets === 1 ? 'single' : 'best-of', target: format.target ?? format.points ?? profile.points }); }}>
          {[1, 3, 5, 7].map(n => <option key={n} value={n}>{n === 1 ? 'Single' : `Best of ${n}`}</option>)}
        </select>
      </label>
      <label className="kit-setup-label">Points to win
        <input aria-label="Custom points to win" type="number" min="1" style={controlStyle} value={format.type === 'single' ? format.target ?? format.points ?? profile.points : format.points ?? profile.points} onChange={e => { const points = Math.max(1, Number(e.target.value)); onChange({ ...format, points, target: points }); }} />
      </label>
      <label className="kit-setup-label">Win by
        <select aria-label="Win by" style={controlStyle} value={custom.winBy ?? 2} onChange={e => change('winBy', Number(e.target.value))}>
          <option value="1">1</option><option value="2">2</option>
        </select>
      </label>
      <label className="kit-setup-label">Point cap (empty means no cap)
        <input aria-label="Point cap" type="number" min="1" style={controlStyle} value={Object.hasOwn(custom, 'pointCap') ? custom.pointCap ?? '' : profile.cap ?? ''} onChange={e => change('pointCap', e.target.value ? Math.max(1, Number(e.target.value)) : null)} />
      </label>
      <label className="kit-setup-label">Deciding {profile.unit.toLowerCase()} target
        <input aria-label="Deciding target" type="number" min="1" style={controlStyle} value={custom.decidingPoints ?? profile.decidingPoints} onChange={e => change('decidingPoints', Math.max(1, Number(e.target.value)))} />
      </label>
      <label className="kit-setup-label">Service mode
        <select aria-label="Service mode" style={controlStyle} value={custom.serviceMode ?? profile.serviceMode} onChange={e => change('serviceMode', e.target.value)}>
          <option value="winner">Winner serves</option><option value="alternating">Alternating</option><option value="manual">Manual</option>
        </select>
      </label>
      {(custom.serviceMode ?? profile.serviceMode) === 'alternating' && <label className="kit-setup-label">Serve every
        <input aria-label="Serve every" type="number" min="1" style={controlStyle} value={custom.serviceEvery ?? profile.serviceEvery} onChange={e => change('serviceEvery', Math.max(1, Number(e.target.value)))} />
      </label>}
      <label className="kit-setup-label">First server next {profile.unit.toLowerCase()}
        <select aria-label="Next game first server" style={controlStyle} value={custom.firstServerPolicy ?? profile.firstServerPolicy} onChange={e => change('firstServerPolicy', e.target.value)}>
          <option value="manual">Choose each time</option><option value="previous-winner">Previous winner</option><option value="alternating">Alternate first server</option>
        </select>
      </label>
      <label className="kit-setup-label">Deciding end change (empty means off)
        <input aria-label="Deciding end change" type="number" min="1" style={controlStyle} value={Object.hasOwn(custom, 'decidingEndChange') ? custom.decidingEndChange ?? '' : profile.decidingEndChange} onChange={e => change('decidingEndChange', e.target.value ? Math.max(1, Number(e.target.value)) : null)} />
      </label>
      {sport === 'volleyball' && <label className="kit-setup-label">Scoring mode
        <select aria-label="Scoring mode" style={controlStyle} value={format.scoringMode || 'rally'} onChange={e => onChange({ ...format, scoringMode: e.target.value })}>
          <option value="rally">Rally</option><option value="side-out">Side-out</option>
        </select>
      </label>}
    </>}
  </div>;
}
