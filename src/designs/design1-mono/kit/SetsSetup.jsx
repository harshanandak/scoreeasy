// Quick setup Rules step for the set sports that have rules to edit (volleyball, badminton, table
// tennis). Game keeps its cards (single set, best of 3 ...). Rules: one summary line, the preset,
// points a set and who serves first, and under More rules the source link or, for Custom school,
// every other rule. The patches are the ones the old rules screen produced; the rules module
// (models/setsRules) and the saved match are unchanged.
import PropTypes from 'prop-types';
import { applySetsPreset, SETS_PROFILES } from '../../../models/setsRules';
import { KitChoiceGrid } from './KitFormControls';
import { MoreRules, RulesFieldRow, RulesPanel, RulesSegmentRow, RulesSummaryLine } from './RulesParts';
import { setPointPresets, setupRulesLine } from './setupFormats';
import './setupSteps.css';

const CUSTOM = 'Custom school';

/** casual, custom or official, from the format's saved preset name. */
export function setsPresetOf(format, profile) {
  if (format.rulesPreset === profile.label) return 'official';
  return format.rulesPreset === CUSTOM ? 'custom' : 'casual';
}

/** The rules that only Custom school edits. Each control keeps the name it always had. */
function CustomRules({ sport, profile, format, onChange }) {
  const custom = format.customization || {};
  const change = (key, value) => onChange({ ...format, rulesPreset: CUSTOM, customization: { ...custom, [key]: value } });
  const unit = profile.unit.toLowerCase();
  const serviceMode = custom.serviceMode ?? profile.serviceMode;
  const optionalNumber = (key, value) => change(key, value ? Math.max(1, Number(value)) : null);
  return <>
    <p className="kit-setup-hint">Use your event circular. This is not an SGFI preset.</p>
    <RulesFieldRow label={`Number of ${unit}s`}>
      <select aria-label="Number of games or sets" value={format.type === 'single' ? 1 : format.sets}
        onChange={e => {
          const sets = Number(e.target.value);
          onChange({ ...format, sets, type: sets === 1 ? 'single' : 'best-of', target: format.target ?? format.points ?? profile.points });
        }}>
        {[1, 3, 5, 7].map(n => <option key={n} value={n}>{n === 1 ? 'Single' : `Best of ${n}`}</option>)}
      </select>
    </RulesFieldRow>
    <RulesFieldRow label="Points to win">
      <input aria-label="Custom points to win" type="number" min="1" inputMode="numeric"
        value={format.type === 'single' ? format.target ?? format.points ?? profile.points : format.points ?? profile.points}
        onChange={e => { const points = Math.max(1, Number(e.target.value)); onChange({ ...format, points, target: points }); }} />
    </RulesFieldRow>
    <RulesFieldRow label="Win by">
      <select aria-label="Win by" value={custom.winBy ?? 2} onChange={e => change('winBy', Number(e.target.value))}>
        <option value="1">1</option><option value="2">2</option>
      </select>
    </RulesFieldRow>
    <RulesFieldRow label="Point cap">
      <input aria-label="Point cap" type="number" min="1" inputMode="numeric" placeholder="No cap"
        value={Object.hasOwn(custom, 'pointCap') ? custom.pointCap ?? '' : profile.cap ?? ''}
        onChange={e => optionalNumber('pointCap', e.target.value)} />
    </RulesFieldRow>
    <RulesFieldRow label={`Deciding ${unit} target`}>
      <input aria-label="Deciding target" type="number" min="1" inputMode="numeric"
        value={custom.decidingPoints ?? profile.decidingPoints}
        onChange={e => change('decidingPoints', Math.max(1, Number(e.target.value)))} />
    </RulesFieldRow>
    <RulesFieldRow label="Service mode">
      <select aria-label="Service mode" value={serviceMode} onChange={e => change('serviceMode', e.target.value)}>
        <option value="winner">Winner serves</option><option value="alternating">Alternating</option><option value="manual">Manual</option>
      </select>
    </RulesFieldRow>
    {serviceMode === 'alternating' && <RulesFieldRow label="Serve every">
      <input aria-label="Serve every" type="number" min="1" inputMode="numeric"
        value={custom.serviceEvery ?? profile.serviceEvery}
        onChange={e => change('serviceEvery', Math.max(1, Number(e.target.value)))} />
    </RulesFieldRow>}
    <RulesFieldRow label={`First server next ${unit}`}>
      <select aria-label="Next game first server" value={custom.firstServerPolicy ?? profile.firstServerPolicy}
        onChange={e => change('firstServerPolicy', e.target.value)}>
        <option value="manual">Choose each time</option><option value="previous-winner">Previous winner</option><option value="alternating">Alternate first server</option>
      </select>
    </RulesFieldRow>
    <RulesFieldRow label="Deciding end change">
      <input aria-label="Deciding end change" type="number" min="1" inputMode="numeric" placeholder="Off"
        value={Object.hasOwn(custom, 'decidingEndChange') ? custom.decidingEndChange ?? '' : profile.decidingEndChange}
        onChange={e => optionalNumber('decidingEndChange', e.target.value)} />
    </RulesFieldRow>
    {sport === 'volleyball' && <RulesFieldRow label="Scoring mode">
      <select aria-label="Scoring mode" value={format.scoringMode || 'rally'} onChange={e => onChange({ ...format, scoringMode: e.target.value })}>
        <option value="rally">Rally</option><option value="side-out">Side-out</option>
      </select>
    </RulesFieldRow>}
  </>;
}
CustomRules.propTypes = {
  sport: PropTypes.string.isRequired,
  profile: PropTypes.object.isRequired,
  format: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

/** Step "Rules" for a set sport with a rules profile. */
export function SetsRulesStep({ sport, sportConfig, format, onChange, names = ['Team A', 'Team B'] }) {
  const profile = SETS_PROFILES[sport];
  const preset = setsPresetOf(format, profile);
  const title = preset === 'official' ? profile.label : preset === 'custom' ? CUSTOM : 'Quick casual';
  const points = setPointPresets(sportConfig);
  const single = format.type !== 'best-of';
  const choosePoints = id => {
    const n = Number(id.slice(2));
    onChange({ ...format, ...(single ? { target: n } : { points: n }), ...(format.rulesPreset?.startsWith('Official') ? { rulesPreset: CUSTOM } : {}) });
  };
  return <section className="kit-setup-field" aria-labelledby="sets-rules-summary">
    <RulesSummaryLine id="sets-rules-summary" title={title} detail={setupRulesLine(sportConfig, format)} />
    <RulesPanel testId="sets-rules-panel">
      <div className="kit-rules-block">
        <KitChoiceGrid label="Rules preset" value={preset} onChange={id => onChange(applySetsPreset(sport, id, format))}
          options={[{ id: 'casual', label: 'Quick casual' }, { id: 'custom', label: CUSTOM }, { id: 'official', label: profile.label }]} />
      </div>
      {points.length > 0 && <RulesSegmentRow label={single ? 'Points to win' : 'Points per set'}
        options={points.map(n => ({ id: `p-${n}`, label: String(n) }))}
        value={single ? `p-${format.target}` : `p-${format.points}`} onChange={choosePoints} />}
      <RulesSegmentRow label="First server" hint="Team-level service. Choose unknown if the toss has not been recorded."
        options={[{ id: 'none', label: 'Unknown' }, { id: '1', label: names[0] || 'Team A' }, { id: '2', label: names[1] || 'Team B' }]}
        value={format.initialServer ? String(format.initialServer) : 'none'}
        onChange={id => onChange({ ...format, initialServer: id === 'none' ? null : Number(id) })} />
      <MoreRules>
        {preset === 'official' && <p className="kit-setup-hint"><a href={profile.source} target="_blank" rel="noreferrer">Rules source and edition</a></p>}
        {preset === 'custom'
          ? <CustomRules sport={sport} profile={profile} format={format} onChange={onChange} />
          : <p className="kit-setup-hint">Choose Custom school to change win by, the point cap and service rules.</p>}
      </MoreRules>
    </RulesPanel>
  </section>;
}
SetsRulesStep.propTypes = {
  sport: PropTypes.string.isRequired,
  sportConfig: PropTypes.object,
  format: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  names: PropTypes.arrayOf(PropTypes.string),
};
