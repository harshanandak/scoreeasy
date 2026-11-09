// Quick setup for the period sports (basketball, football, hockey), split across the same steps as
// every other sport. Game: one card per timing preset. Rules: one summary line, the periods and
// minutes (or, for quick casual, how the match ends), and the less common rules under More rules.
// The match format object, the period rules module and what the board plays are unchanged.
import PropTypes from 'prop-types';
import { periodPreset } from '../../../utils/goalsPeriods';
import { KitNumberStepper, KitToggleRow, KitChoiceGrid } from './KitFormControls';
import { MoreRules, RulesPanel, RulesSegmentRow, RulesSummaryLine } from './RulesParts';
import { applyFormatChoice, applyGoalsDetail, formatChoices, goalsDetail, setupRulesLine } from './setupFormats';
import './setupSteps.css';

/** Which timing preset a format is: official and custom carry period rules, casual has none. */
export const goalsPresetOf = format => format.periodPreset || (format.periods ? 'custom' : 'casual');

const minutesOf = rules => rules.durations[0] / 60;

function officialOf(sport) {
  const { periods } = periodPreset(sport, 'official');
  return { source: periods.source, count: periods.durations.length, minutes: minutesOf(periods) };
}

/** Step "What are you playing": the three timing presets, each with a one-line plain description. */
export function GoalsGameStep({ sport, format, onChange }) {
  const official = officialOf(sport);
  const options = [
    { id: 'official', label: official.source, hint: `${official.count} × ${official.minutes} min · the scorer ends every period` },
    { id: 'custom', label: 'Custom school/event', hint: 'Set your own periods and minutes' },
    { id: 'casual', label: 'Quick casual', hint: 'No period clock · play to a target, a timer, or free' },
  ];
  return <section className="kit-setup-field" aria-labelledby="goals-format-label">
    <h2 id="goals-format-label" className="kit-setup-label">What are you playing?</h2>
    <KitChoiceGrid labelledBy="goals-format-label" columns={1} options={options} value={goalsPresetOf(format)}
      onChange={id => onChange(periodPreset(sport, id))} />
  </section>;
}
GoalsGameStep.propTypes = { sport: PropTypes.string.isRequired, format: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired };

/** Step "Rules" for a period sport. */
export function GoalsRulesStep({ sport, sportConfig, format, onChange }) {
  const preset = goalsPresetOf(format);
  const rules = format.periods;
  const official = officialOf(sport);
  const title = preset === 'official' ? official.source : preset === 'custom' ? 'Custom school/event' : 'Quick casual';
  const detail = rules ? `${rules.durations.length} × ${minutesOf(rules)} min` : setupRulesLine(sportConfig, format);
  const update = (count, minutes) => {
    const next = periodPreset(sport, 'custom', count, minutes);
    onChange({ ...next, periods: { ...next.periods, extraDurations: [...(rules.extraDurations || [])] } });
  };
  const detailRow = goalsDetail(sportConfig, format);
  return <section className="kit-setup-field" aria-labelledby="goals-rules-summary">
    <RulesSummaryLine id="goals-rules-summary" title={title} detail={detail}
      resetLabel={`Reset to ${official.source}`} onReset={preset === 'custom' ? () => onChange(periodPreset(sport, 'official')) : undefined} />
    <RulesPanel testId="goals-rules-panel">
      {rules ? <>
        <KitNumberStepper label="Number of periods" value={rules.durations.length} min={1} max={8} onChange={count => update(count, minutesOf(rules))} />
        <KitNumberStepper label="Minutes per period" value={minutesOf(rules)} min={1} max={120} unit="min" onChange={minutes => update(rules.durations.length, minutes)} />
        <MoreRules>
          {sport === 'football' && <KitToggleRow label="Two 15-minute extra-time halves if tied"
            checked={Boolean(rules.extraDurations?.length)}
            onChange={on => onChange({ ...format, periods: { ...rules, extraDurations: on ? [900, 900] : [] } })} />}
          <p className="kit-setup-rules">
            Scorer controls every period end. {sport === 'basketball' ? 'Ties use repeated 5-minute overtime. No shot clock.' : 'Referee manages stoppages and any shootout.'} Timing baseline only; event rules take precedence.
          </p>
        </MoreRules>
      </> : <>
        <RulesSegmentRow label="Match ends" options={formatChoices(sportConfig).choices} value={format.mode || 'free'}
          onChange={id => onChange(applyFormatChoice(sportConfig, id, format))} />
        {detailRow && <RulesSegmentRow label={detailRow.label} options={detailRow.options} value={detailRow.selected}
          onChange={id => onChange(applyGoalsDetail(format, id))} />}
      </>}
    </RulesPanel>
  </section>;
}
GoalsRulesStep.propTypes = {
  sport: PropTypes.string.isRequired,
  sportConfig: PropTypes.object,
  format: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};
