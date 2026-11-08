// Presets are copied into a match. Editing one creates Custom; saved rules never follow defaults.
const copy = value => JSON.parse(JSON.stringify(value));
const check = (ok, text) => { if (!ok) throw new Error(`Kabaddi: ${text}`); };
const int = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= min && n <= max;
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
const keys = (value, names) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(k => names.includes(k)) && names.every(k => Object.hasOwn(value, k));
export const KABADDI_PRESETS = [
  { id: 'quick', label: 'Quick casual' },
  { id: 'standard', label: 'Standard' },
  { id: 'women', label: 'Standard women / younger' },
  { id: 'pro', label: 'Pro Kabaddi style' },
  { id: 'custom', label: 'Custom' },
];

function standard(presetId) {
  return {
    schemaVersion: 2, rulesVersion: 'rectangular-v2', presetId, presetRevision: 1,
    source: presetId === 'pro' ? 'Rectangular baseline; style only, no season-specific tiebreak' : 'IKF v2.1.0 inspired; referee-managed, not certified',
    strategy: 'rectangularOuts', initialPlayers: 7, squadLimit: null,
    end: { kind: 'timed', halves: 2, halfMs: presetId === 'women' ? 900000 : 1200000, intervalMs: 300000 },
    raidLimitMs: 30000, expiry: 'refereeRuling',
    bonus: { enabled: true, minDefenders: 6, eligibility: 'raidStart', beforeContact: true, points: 1, revives: false },
    superTackle: { maxDefenders: 3, moment: 'raidStart', outcomes: 'anyRaiderOut', extraPoints: 1 },
    doOrDie: { emptyRaids: 2, onFailure: 'raiderOut', carryAcrossHalf: true },
    outs: { mode: 'fifo', revival: 'onePerOpponentOut', allOutPoints: 2, restore: 'allOrdinary' },
    lobby: 'refereeManaged', boundary: 'refereeManaged', tie: 'draw', technical: 'refereeManaged',
    management: 'refereeManaged', court: presetId === 'women' ? { shape: 'rectangle', lengthM: 11, widthM: 8 } : null,
  };
}

export function resolveKabaddiRules(presetId = 'standard', supplied) {
  check([...KABADDI_PRESETS.map(p => p.id), 'legacy-club'].includes(presetId), 'unsupported format');
  let rules = standard(presetId);
  if (presetId === 'quick' || (presetId === 'custom' && !supplied)) rules = {
    ...rules, source: 'House rules; not an official format', strategy: 'pointsOnly', initialPlayers: 5,
    end: { kind: 'target', points: 21 }, raidLimitMs: null, bonus: { enabled: false }, superTackle: null, doOrDie: null,
    outs: { mode: 'pointsOnly', revival: 'none', allOutPoints: 0, restore: 'none' },
  };
  if (supplied) {
    check(presetId === 'custom' || presetId === 'legacy-club', 'preset rules are fixed; choose Custom to edit');
    rules = { ...copy(supplied), presetId };
  }
  validateKabaddiRules(rules);
  return copy(rules);
}

export function validateKabaddiRules(r) {
  check(keys(r, ['schemaVersion', 'rulesVersion', 'presetId', 'presetRevision', 'source', 'strategy', 'initialPlayers', 'squadLimit', 'end', 'raidLimitMs', 'expiry', 'bonus', 'superTackle', 'doOrDie', 'outs', 'lobby', 'boundary', 'tie', 'technical', 'management', 'court']), 'unknown or missing rules field');
  check(r.schemaVersion === 2 && r.rulesVersion === 'rectangular-v2' && [...KABADDI_PRESETS.map(p => p.id), 'legacy-club'].includes(r.presetId) && r.presetRevision === 1 && typeof r.source === 'string', 'unsupported rules version');
  check(['rectangularOuts', 'pointsOnly'].includes(r.strategy) && int(r.initialPlayers, 2, 12), 'invalid player strategy or capacity');
  check(r.squadLimit === null || int(r.squadLimit, r.initialPlayers), 'invalid squad limit');
  const end = r.end;
  check(end && (
    (end.kind === 'timed' && keys(end, ['kind', 'halves', 'halfMs', 'intervalMs']) && end.halves === 2 && int(end.halfMs, 1) && int(end.intervalMs)) ||
    (end.kind === 'target' && keys(end, ['kind', 'points']) && int(end.points, 1)) ||
    (end.kind === 'raids' && keys(end, ['kind', 'raidsPerTeam']) && int(end.raidsPerTeam, 1))
  ), 'invalid match end');
  check((r.raidLimitMs === null || int(r.raidLimitMs, 1)) && r.expiry === 'refereeRuling', 'invalid raid clock');
  check(r.bonus && (r.bonus.enabled === false ? keys(r.bonus, ['enabled']) : keys(r.bonus, ['enabled', 'minDefenders', 'eligibility', 'beforeContact', 'points', 'revives']) && r.bonus.enabled === true && int(r.bonus.minDefenders, 1, r.initialPlayers) && r.bonus.eligibility === 'raidStart' && r.bonus.beforeContact === true && r.bonus.points === 1 && r.bonus.revives === false), 'invalid bonus rule');
  check(r.superTackle === null || keys(r.superTackle, ['maxDefenders', 'moment', 'outcomes', 'extraPoints']) && int(r.superTackle.maxDefenders, 1, r.initialPlayers) && r.superTackle.moment === 'raidStart' && ['physicalTackle', 'anyRaiderOut'].includes(r.superTackle.outcomes) && r.superTackle.extraPoints === 1, 'invalid super tackle');
  check(r.doOrDie === null || keys(r.doOrDie, ['emptyRaids', 'onFailure', 'carryAcrossHalf']) && int(r.doOrDie.emptyRaids, 1) && r.doOrDie.onFailure === 'raiderOut' && typeof r.doOrDie.carryAcrossHalf === 'boolean', 'invalid do-or-die');
  check(keys(r.outs, ['mode', 'revival', 'allOutPoints', 'restore']), 'invalid outs fields');
  check(r.strategy === 'pointsOnly'
    ? r.outs.mode === 'pointsOnly' && r.outs.revival === 'none' && r.outs.allOutPoints === 0 && r.outs.restore === 'none' && !r.superTackle
    : r.outs.mode === 'fifo' && r.outs.revival === 'onePerOpponentOut' && int(r.outs.allOutPoints, 0, 10) && r.outs.restore === 'allOrdinary', 'incompatible player-state rules');
  check(['none', 'refereeManaged'].includes(r.lobby) && ['none', 'refereeManaged'].includes(r.boundary) && ['draw', 'refereeDecision'].includes(r.tie) && ['off', 'refereeManaged'].includes(r.technical) && r.management === 'refereeManaged', 'unsupported adjudication policy');
  check(r.court === null || keys(r.court, ['shape', 'lengthM', 'widthM']) && r.court.shape === 'rectangle' && Number.isFinite(r.court.lengthM) && r.court.lengthM > 0 && Number.isFinite(r.court.widthM) && r.court.widthM > 0, 'invalid court metadata');
  if (!['custom', 'legacy-club'].includes(r.presetId)) check(JSON.stringify(ordered(r)) === JSON.stringify(ordered(resolvePreset(r.presetId))), 'preset was edited without choosing Custom');
}

function resolvePreset(id) {
  const r = standard(id);
  return id === 'quick' ? { ...r, source: 'House rules; not an official format', strategy: 'pointsOnly', initialPlayers: 5, end: { kind: 'target', points: 21 }, raidLimitMs: null, bonus: { enabled: false }, superTackle: null, doOrDie: null, outs: { mode: 'pointsOnly', revival: 'none', allOutPoints: 0, restore: 'none' } } : r;
}

export function kabaddiRulesLine(r) {
  const end = r.end.kind === 'timed' ? `2 × ${r.end.halfMs / 60000} min` : r.end.kind === 'target' ? `First to ${r.end.points}` : `${r.end.raidsPerTeam} raids each`;
  return `${r.initialPlayers} a side · ${end} · ${r.strategy === 'pointsOnly' ? 'players stay' : 'FIFO revival'}${r.raidLimitMs === null ? ' · no clocks' : ''}`;
}
