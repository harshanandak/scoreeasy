import PropTypes from 'prop-types';
import { periodPreset, supportsGoalPeriods } from '../../../utils/goalsPeriods';
import '../scoring/goalsPeriods.css';

export default function GoalsPeriodSetup({ sport, format, onChange }) {
  if (!supportsGoalPeriods(sport)) return null;
  const rules = format.periods;
  const preset = format.periodPreset || (rules ? 'custom' : 'casual');
  const update = (count, minutes) => {
    const next = periodPreset(sport, 'custom', count, minutes);
    onChange({ ...next, periods: { ...next.periods, extraDurations: [...(rules.extraDurations || [])] } });
  };
  return <section className="kit-setup-field gp-setup" aria-label="Period rules">
    <label className="kit-setup-label" htmlFor="goal-period-preset">Timing preset</label>
    <select className="kit-setup-input" id="goal-period-preset" value={preset} onChange={e => onChange(periodPreset(sport, e.target.value))}>
      <option value="casual">Quick casual · no clock</option>
      <option value="custom">Custom school/event</option>
      <option value="official">{sport === 'football' ? 'IFAB 2026/27 · 2 × 45 min' : sport === 'basketball' ? 'FIBA 5-on-5 2024 · 4 × 10 min' : 'FIH outdoor 2027 · 4 × 15 min'}</option>
    </select>
    {rules && <>
      <div className="gp-fields">
        <label>Periods<input className="kit-setup-input" aria-label="Number of periods" type="number" min="1" max="8" value={rules.durations.length} onChange={e => update(e.target.value, rules.durations[0] / 60)} /></label>
        <label>Minutes each<input className="kit-setup-input" aria-label="Minutes per period" type="number" min="1" max="120" value={rules.durations[0] / 60} onChange={e => update(rules.durations.length, e.target.value)} /></label>
      </div>
      {sport === 'football' && <label className="gp-extra"><input type="checkbox" checked={Boolean(rules.extraDurations?.length)} onChange={e => onChange({ ...format, periods: { ...rules, extraDurations: e.target.checked ? [900, 900] : [] } })} />Allow two 15-minute extra-time halves if tied</label>}
      <p className="kit-setup-rules">Scorer controls every period end. {sport === 'basketball' ? 'Ties use repeated 5-minute overtime. No shot clock.' : 'Referee manages stoppages and any shootout.'} Timing baseline only; event rules take precedence.</p>
    </>}
  </section>;
}
GoalsPeriodSetup.propTypes = { sport: PropTypes.string.isRequired, format: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired };
