// Profiles are edition-specific. Never change a saved match by resolving its profile again.
export const SETS_PROFILES = {
  volleyball: {
    id: 'fivb-indoor-2025-2028', label: 'Official · FIVB indoor 2025–28',
    source: 'https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN-v05.pdf',
    points: 25, decidingPoints: 15, cap: null, sets: 5,
    serviceMode: 'winner', serviceEvery: 1, firstServerPolicy: 'manual', decidingEndChange: 8, unit: 'Set',
  },
  badminton: {
    id: 'bwf-2025', label: 'Official · BWF Laws 2025',
    source: 'https://extranet.bwf.sport/docs/document-system/81/1466/1470/Section%204.1%20-%20Laws%20of%20Badminton%20-%2026%20April%202025%20V5.0%20(2)%20.pdf',
    points: 21, decidingPoints: 21, cap: 30, sets: 3,
    serviceMode: 'winner', serviceEvery: 1, firstServerPolicy: 'previous-winner', decidingEndChange: 11, unit: 'Game',
  },
  tabletennis: {
    id: 'ittf-2026', label: 'Official · ITTF Laws 2026',
    source: 'https://db.ittf.com/sites/default/files/public/2026-02/2026_Statutes_v1_consolidated_clean.pdf',
    points: 11, decidingPoints: 11, cap: null, sets: 5,
    serviceMode: 'alternating', serviceEvery: 2, firstServerPolicy: 'alternating', decidingEndChange: 5, unit: 'Game',
  },
};

export const supportsSetsRules = (sport) => Object.hasOwn(SETS_PROFILES, sport);
const knownServer = (team) => team === 1 || team === 2 ? team : null;
const other = (team) => team === 1 ? 2 : team === 2 ? 1 : null;

export function freezeSetsFormat(sportConfig, format = {}, { legacy = false, path = 'quick' } = {}) {
  if (!supportsSetsRules(sportConfig?.id)) return format;
  if (format.setsRules) return { ...format, setsRules: Object.freeze(structuredClone(format.setsRules)) };
  const profile = SETS_PROFILES[sportConfig.id];
  const config = sportConfig.config;
  const custom = format.customization || {};
  const single = format.type === 'single';
  const points = single ? (format.target ?? format.points ?? profile.points) : (format.points ?? profile.points);
  const sets = single ? 1 : (format.sets ?? profile.sets);
  const rotation = config.serviceRotation;
  const legacyQuickSeries = legacy && path === 'quick' && !single;
  const winBy = legacy
    ? (legacyQuickSeries ? custom.winBy || config.winBy || 2 : config.winBy ?? 2)
    : custom.winBy ?? 2;
  const cap = legacy
    ? (legacyQuickSeries ? custom.pointCap || config.maxPoints || null : config.maxPoints ?? null)
    : Object.hasOwn(custom, 'pointCap') ? custom.pointCap : profile.cap;
  const legacyService = path === 'quick'
    ? (['volleyball', 'badminton'].includes(sportConfig.id) ? 'winner' : 'manual')
    : (rotation ? 'legacy-alternating' : 'manual');
  const rules = {
    version: legacy ? 0 : 1,
    profile: legacy ? `legacy-${path}` : profile.id,
    preset: format.rulesPreset || 'Quick casual',
    source: legacy ? null : profile.source,
    points, winBy, cap,
    sets, setsToWin: Math.ceil(sets / 2),
    decidingPoints: legacy ? (config.deciderPoints || points) : (custom.decidingPoints ?? profile.decidingPoints),
    serviceMode: legacy ? legacyService : (custom.serviceMode ?? profile.serviceMode),
    serviceEvery: legacy ? (rotation || 1) : (custom.serviceEvery ?? profile.serviceEvery),
    initialServer: legacy ? 1 : knownServer(format.initialServer),
    firstServerPolicy: legacy ? 'carry' : (custom.firstServerPolicy ?? profile.firstServerPolicy),
    perSetServers: Object.freeze([]),
    endChangeBetweenSets: !legacy,
    decidingEndChange: legacy ? null : Object.hasOwn(custom, 'decidingEndChange') ? custom.decidingEndChange : profile.decidingEndChange,
    scoringMode: format.scoringMode || 'rally',
    unit: legacy ? (config.setLabel || 'Set') : profile.unit,
    // Legacy tournament drafts keep their original cap/margin ordering on resume.
    marginBeforeCap: legacy && path === 'tournament',
  };
  return { ...format, setsRules: Object.freeze(rules) };
}

export function setWinRule(rules, index = 0) {
  return {
    target: rules.sets > 1 && index === rules.sets - 1 ? rules.decidingPoints : rules.points,
    winBy: rules.winBy, maxPoints: rules.cap, marginBeforeCap: rules.marginBeforeCap,
  };
}

export function isSetsGameComplete(set, rule) {
  if (!set) return false;
  const max = Math.max(set.score1, set.score2);
  const min = Math.min(set.score1, set.score2);
  if (max === min) return false;
  if (rule.marginBeforeCap && (max < rule.target || max - min < rule.winBy)) return false;
  if (rule.maxPoints && max >= rule.maxPoints) return true;
  return max >= rule.target && max - min >= rule.winBy;
}

export function firstServerForSet(rules, index, sets = [], previousServer = null) {
  if (Object.hasOwn(sets[index] || {}, 'firstServer')) return knownServer(sets[index].firstServer);
  if (index === 0) return rules.initialServer;
  if (Object.hasOwn(rules.perSetServers, index)) return knownServer(rules.perSetServers[index]);
  if (rules.firstServerPolicy === 'carry') return previousServer;
  if (rules.firstServerPolicy === 'alternating') return other(firstServerForSet(rules, index - 1, sets));
  const previous = sets[index - 1];
  if (rules.firstServerPolicy === 'previous-winner' && previous?.completed) {
    return previous.score1 > previous.score2 ? 1 : 2;
  }
  return null;
}

export function serveAfterPoint(rules, { score, currentSet = 0, sets = [], servingTeam, winner }) {
  if (rules.serviceMode === 'winner') return winner;
  if (rules.serviceMode === 'manual') return servingTeam;
  const total = score.score1 + score.score2;
  const target = setWinRule(rules, currentSet).target;
  if (rules.serviceMode === 'legacy-alternating') {
    const deuce = !rules.cap && score.score1 >= target - 1 && score.score2 >= target - 1;
    return deuce || total % rules.serviceEvery === 0 ? other(servingTeam) : servingTeam;
  }
  const first = firstServerForSet(rules, currentSet, sets);
  const deuceStart = 2 * (target - 1);
  const turns = Math.floor(Math.min(total, deuceStart) / rules.serviceEvery) + Math.max(0, total - deuceStart);
  return turns % 2 ? other(first) : first;
}

export function endChangeDue(rules, index, score) {
  return rules.version === 1 && rules.decidingEndChange && rules.sets > 1 && index === rules.sets - 1
    && Math.max(score.score1, score.score2) >= rules.decidingEndChange;
}

export const broadcastServer = (team) => team === 1 ? 'A' : team === 2 ? 'B' : undefined;

export function applySetsPreset(sport, name, format = {}) {
  const profile = SETS_PROFILES[sport];
  const { setsRules: _rules, ...editable } = format;
  if (name === 'official') return {
    ...editable, type: 'best-of', sets: profile.sets, points: profile.points,
    rulesPreset: profile.label, customization: {}, scoringMode: 'rally',
  };
  if (name === 'casual') return {
    ...editable, type: 'single', sets: 1, target: sport === 'volleyball' ? 15 : 11,
    rulesPreset: 'Quick casual', customization: {}, scoringMode: 'rally',
  };
  return { ...editable, rulesPreset: 'Custom school' };
}
