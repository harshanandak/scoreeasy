// Quick setup Rules step for cricket. Game keeps its format cards (T20, T10, ODI, Test, Gully,
// Custom). Rules: one summary line and, for the two formats whose rules a scorer may change (Gully
// and Custom), the overs, players and match type, with innings and the gully house rules under
// More rules. The fixed formats say so instead of showing rules that cannot change. Every patch
// below is the one the old rules page made; the cricket rules modules and the match are unchanged.
import { useState } from 'react';
import PropTypes from 'prop-types';
import { OVERS_PRESETS, getCricketFormat } from '../../../utils/cricketCalculations';
import { KitNumberStepper, KitToggleRow } from './KitFormControls';
import { KitStepper } from './KitSetupParts';
import { MoreRules, RulesFieldRow, RulesPanel, RulesSegmentRow, RulesSummaryLine } from './RulesParts';
import { setupRulesLine } from './setupFormats';
import './setupSteps.css';

const HOUSE_RULES = [
  { key: 'lastManStands', label: 'Last man bats', info: 'Last batter plays alone.' },
  { key: 'trialBall', label: 'Trial ball', info: 'First ball doesn’t count.' },
  { key: 'oneTipOneHand', label: 'One tip one hand', info: 'One-bounce catch is out.' },
];

const isPresetOvers = overs => overs === null || OVERS_PRESETS.some(p => p.value === overs);

/** The overs row: no limit, the usual presets, or a number typed in (1 to 50). */
function OversRow({ format, onChange }) {
  const [custom, setCustom] = useState(() => !isPresetOvers(format.overs) && format.overs !== undefined);
  const [text, setText] = useState(() => (custom && format.overs ? String(format.overs) : ''));
  const value = custom ? 'custom' : format.overs === null ? 'none' : `ov-${format.overs}`;
  const choose = id => {
    if (id === 'custom') { setCustom(true); setText(''); return; }
    onChange({ ...format, overs: id === 'none' ? null : Number(id.slice(3)) });
    setText('');
    setCustom(false);
  };
  return <>
    <RulesSegmentRow label="Overs" value={value} onChange={choose} hint={format.overs === null && !custom ? 'No overs: just runs and balls' : undefined}
      options={[{ id: 'none', label: 'No limit' }, ...OVERS_PRESETS.map(p => ({ id: `ov-${p.value}`, label: String(p.value) })), { id: 'custom', label: 'Custom' }]} />
    {custom && <RulesFieldRow label="Overs a side">
      <input type="number" min="1" max="50" inputMode="numeric" aria-label="Custom overs (1 to 50)" placeholder="1-50" value={text}
        onChange={e => {
          const v = Number.parseInt(e.target.value, 10);
          setText(e.target.value);
          if (v >= 1 && v <= 50) onChange({ ...format, overs: v });
        }} />
    </RulesFieldRow>}
  </>;
}
OversRow.propTypes = { format: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired };

/** Step "Rules" for cricket. */
export function CricketRulesStep({ sportConfig, format, cricketPreset, onChange }) {
  const preset = getCricketFormat(cricketPreset);
  const editable = Boolean(preset?.customizable);
  const players = format.players || 6;
  const maxPlayers = format.solo ? 10 : 11;
  const balls = format.trackOvers === false;
  return <section className="kit-setup-field" aria-labelledby="cricket-rules-summary">
    <RulesSummaryLine id="cricket-rules-summary" title={preset?.name || 'Cricket'} detail={setupRulesLine(sportConfig, format)} />
    {!editable
      ? <p className="kit-setup-hint">These rules are fixed for {preset?.name || 'this format'}. Choose Gully or Custom on the Game step to change them.</p>
      : <RulesPanel testId="cricket-rules-panel">
        {cricketPreset === 'custom' && <RulesSegmentRow label="Scoring format" value={balls ? 'balls' : 'overs'}
          options={[{ id: 'overs', label: 'By overs' }, { id: 'balls', label: 'By balls' }]}
          onChange={id => onChange(id === 'balls' ? { ...format, trackOvers: false, overs: null, powerplay: [] } : { ...format, trackOvers: true, maxBalls: null })} />}
        {!balls && <OversRow format={format} onChange={onChange} />}
        {cricketPreset === 'custom' && balls && <div className="kit-rules-block">
          <p id="cricket-balls-label" className="kit-setup-label">Ball limit</p>
          <div className="kit-rules-custom">
            <KitStepper label="balls" labelledBy="cricket-balls-label" value={format.maxBalls || '∞'}
              onDecrease={() => onChange({ ...format, maxBalls: Math.max(6, (format.maxBalls || 30) - 6) })}
              onIncrease={() => onChange({ ...format, maxBalls: (format.maxBalls || 24) + 6 })} />
            <button type="button" className="se-ctl" aria-pressed={!format.maxBalls ? 'true' : 'false'} onClick={() => onChange({ ...format, maxBalls: null })}>No limit</button>
          </div>
        </div>}
        <KitNumberStepper label="Players per side" min={2} max={maxPlayers} value={players}
          hint={`${players - 1} wickets to bowl a team out`}
          onChange={v => onChange({ ...format, players: Math.min(maxPlayers, Math.max(2, v)) })} />
        <RulesSegmentRow label="Match type" hint={format.solo ? 'One team bats, the other bowls' : 'Both teams bat and bowl'}
          value={format.solo ? 'solo' : (format.solo === false ? 'both' : null)}
          options={[{ id: 'solo', label: 'Bat only' }, { id: 'both', label: 'Bat and bowl' }]}
          onChange={id => onChange(id === 'solo' ? { ...format, solo: true, players: Math.min(format.players || 6, 10) } : { ...format, solo: false })} />
        <MoreRules>
          <RulesSegmentRow label="Innings" value={(format.totalInnings || 2) === 4 ? '2' : '1'}
            options={[{ id: '1', label: '1 per side' }, { id: '2', label: '2 per side (Test)' }]}
            onChange={id => onChange(id === '2' ? { ...format, totalInnings: 4, declaration: true, followOn: true } : { ...format, totalInnings: 2, declaration: false, followOn: false })} />
          {cricketPreset === 'gully' && HOUSE_RULES.map(rule => (
            <KitToggleRow key={rule.key} label={rule.label} info={rule.info} checked={Boolean(format[rule.key])}
              onChange={() => onChange({ ...format, [rule.key]: !format[rule.key] })} />
          ))}
        </MoreRules>
      </RulesPanel>}
  </section>;
}
CricketRulesStep.propTypes = {
  sportConfig: PropTypes.object,
  format: PropTypes.object.isRequired,
  cricketPreset: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};
