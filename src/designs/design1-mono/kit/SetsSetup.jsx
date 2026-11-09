// Set rules are always visible. Edits use the existing Custom school format; the sport rules module is unchanged.
import PropTypes from 'prop-types';
import { applySetsPreset, SETS_PROFILES } from '../../../models/setsRules';
import { KitChoiceGrid } from './KitFormControls';
import { MoreRules, RulesFieldRow, RulesPanel, RulesSegmentRow, RulesSummaryLine } from './RulesParts';
import { applyStandardDefaults } from '../../../utils/sportDefaults';
import { setPointPresets, setupRulesLine, matchesSetupPreset, isCustomSetup, setupSourcePreset, setupPresetTitle } from './setupFormats';
import './setupSteps.css';

const CUSTOM = 'Custom school';

/** The selected standard, casual, official or custom card, independent of edited values. */
export function setsPresetOf(format, profile) {
  if (!format.rulesPreset) return 'standard';
  if (format.rulesPreset === profile.label) return 'official';
  return format.rulesPreset === CUSTOM ? 'custom' : 'casual';
}

/** Editable rules for every preset. Each control keeps its existing name. */
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
export function SetsRulesStep({ sport, sportConfig, format, onChange, source, onSourceChange = () => {}, names = ['Team A', 'Team B'] }) {
  const profile = SETS_PROFILES[sport];
  const preset = setsPresetOf(format, profile);
  const label = preset === 'official' ? profile.label : preset === 'standard' ? 'Standard' : preset === 'custom' ? CUSTOM : 'Quick casual';
  const base = setupSourcePreset(sportConfig, format, source);
  const customised = isCustomSetup(format, base, sportConfig);
  const title = setupPresetTitle(customised ? base.label : label, customised);
  const keepToss = next => ({ ...next, ...(Object.hasOwn(format, 'initialServer') ? { initialServer: format.initialServer } : {}) });
  const reset = () => { onSourceChange(null); onChange(keepToss(base.format)); };
  const change = next => {
    if (!isCustomSetup(next, base, sportConfig)) { reset(); return; }
    onSourceChange(base);
    onChange(applySetsPreset(sport, 'custom', next));
  };
  const choosePreset = id => {
    if (id === 'custom') {
      onSourceChange(preset === 'custom' ? base : { label, format });
      onChange(applySetsPreset(sport, 'custom', format));
      return;
    }
    onSourceChange(null);
    onChange(id === 'standard' ? keepToss(applyStandardDefaults(sport, {})) : applySetsPreset(sport, id, format));
  };
  const points = setPointPresets(sportConfig);
  const single = format.type !== 'best-of';
  const choosePoints = id => {
    const n = Number(id.slice(2));
    change({ ...format, ...(single ? { target: n } : { points: n }), ...(format.rulesPreset?.startsWith('Official') ? { rulesPreset: CUSTOM } : {}) });
  };
  return <section className="kit-setup-field" aria-labelledby="sets-rules-summary">
    <RulesSummaryLine id="sets-rules-summary" title={title} detail={setupRulesLine(sportConfig, format)}
      resetLabel={`Reset to ${base.label}`} onReset={customised ? reset : undefined} />
    <RulesPanel testId="sets-rules-panel">
      <div className="kit-rules-block">
        <KitChoiceGrid label="Rules preset" value={preset} onChange={choosePreset}
          options={[{ id: 'standard', label: 'Standard' }, { id: 'casual', label: 'Quick casual' }, { id: 'custom', label: customised ? 'Customised' : CUSTOM }, { id: 'official', label: profile.label }]} />
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
        <CustomRules sport={sport} profile={profile} format={format} onChange={change} />
      </MoreRules>
    </RulesPanel>
  </section>;
}
SetsRulesStep.propTypes = {
  sport: PropTypes.string.isRequired,
  sportConfig: PropTypes.object,
  source: PropTypes.object,
  onSourceChange: PropTypes.func,
  format: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  names: PropTypes.arrayOf(PropTypes.string),
};


// The tennis scorer fixes games and tiebreak rules; only the existing set-count path is editable.
export function TennisRulesStep({ format, onChange }) {
  const custom = isCustomSetup(format, null, { id: 'tennis', engine: 'sets' });
  const standard = applyStandardDefaults('tennis', {});
  return <section className="kit-setup-field">
    <RulesSummaryLine title={setupPresetTitle('Standard', custom)} detail="6 games a set, win by 2, tiebreak at 6-6 to 7"
      resetLabel="Reset to Standard" onReset={custom ? () => onChange(standard) : undefined} />
    <RulesPanel>
      <RulesFieldRow label="Number of sets">
        <select aria-label="Number of sets" value={format.sets || 1} onChange={e => {
          const sets = Number(e.target.value);
          onChange(matchesSetupPreset(sets, standard.sets) ? standard : { ...standard, sets, type: sets === 1 ? 'single' : 'best-of', formatMode: 'custom' });
        }}>
          {[1, 3, 5].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </RulesFieldRow>
      <p className="kit-setup-hint">Games and tiebreak scoring follow the tennis board's fixed rules.</p>
    </RulesPanel>
  </section>;
}
TennisRulesStep.propTypes = { sportConfig: PropTypes.object, format: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired };
