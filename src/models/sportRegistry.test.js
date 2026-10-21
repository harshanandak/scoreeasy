import {
  SPORT_REGISTRY,
  getSportsList,
  getSetsSports,
  getGoalsSports,
  getSportById,
  getSportsByCategory,
  getRetiredSport,
  getRetiredSportsList,
  getSportLabel,
  isTeamColourSport,
} from './sportRegistry';
import { LATER_SPORT_IDS, PRIORITY_SPORT_IDS, SPORT_ORDER } from './sportFocus';
import { COURT_MOTIFS } from '../lib/courtMotifs';

const RETIRED_IDS = ['pickleball', 'squash', 'rugby', 'futsal', 'handball'];

// ─── The ICP game focus: 9 registered sports ──────────────────────────────────
// docs/plans/2026-07-20-icp-games/adjusted-plan.md §A

describe('SPORT_REGISTRY', () => {
  const sportIds = Object.keys(SPORT_REGISTRY);

  it('has exactly 9 sports', () => {
    expect(sportIds).toHaveLength(9);
  });

  it('contains every Tier-0 and kept-later sport that has an engine today', () => {
    const expected = [
      'cricket', 'kabaddi', 'volleyball', 'badminton', 'football', 'basketball',
      'tennis', 'tabletennis', 'hockey',
    ];
    expect([...sportIds].sort()).toEqual([...expected].sort());
  });

  it('no longer registers the five deregistered sports', () => {
    RETIRED_IDS.forEach(id => {
      expect(SPORT_REGISTRY).not.toHaveProperty(id);
      expect(getSportById(id)).toBeNull();
    });
  });

  it('does not register throwball or kho kho yet', () => {
    expect(getSportById('throwball')).toBeNull();
    expect(getSportById('khokho')).toBeNull();
  });

  it('gives every registered sport a slot in the focus order', () => {
    sportIds.forEach(id => {
      expect(SPORT_ORDER).toContain(id);
    });
  });

  it('each sport has required fields: id, name, icon, engine, storageKey', () => {
    sportIds.forEach(id => {
      const sport = SPORT_REGISTRY[id];
      expect(sport.id).toBe(id);
      expect(typeof sport.name).toBe('string');
      expect(typeof sport.icon).toBe('string');
      expect(['sets', 'goals', 'custom-cricket']).toContain(sport.engine);
      expect(typeof sport.storageKey).toBe('string');
      expect(sport.storageKey.startsWith('se_')).toBe(true);
    });
  });

  it('each sport has config object', () => {
    sportIds.forEach(id => {
      expect(SPORT_REGISTRY[id]).toHaveProperty('config');
      expect(typeof SPORT_REGISTRY[id].config).toBe('object');
    });
  });

  it('each sport has standingsColumns array', () => {
    sportIds.forEach(id => {
      expect(Array.isArray(SPORT_REGISTRY[id].standingsColumns)).toBe(true);
      expect(SPORT_REGISTRY[id].standingsColumns.length).toBeGreaterThan(0);
    });
  });

  it('each sport has features array', () => {
    sportIds.forEach(id => {
      expect(Array.isArray(SPORT_REGISTRY[id].features)).toBe(true);
      expect(SPORT_REGISTRY[id].features.length).toBeGreaterThan(0);
    });
  });

  it('each sport has a desc string', () => {
    sportIds.forEach(id => {
      expect(typeof SPORT_REGISTRY[id].desc).toBe('string');
    });
  });

  it('all storageKeys are unique', () => {
    const keys = sportIds.map(id => SPORT_REGISTRY[id].storageKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ─── Sets-based sports ─────────────────────────────────────────────────────────

describe('Sets-based sports config', () => {
  const setsSports = ['volleyball', 'badminton', 'tabletennis', 'tennis'];

  it('has engine = "sets"', () => {
    setsSports.forEach(id => {
      expect(SPORT_REGISTRY[id].engine).toBe('sets');
    });
  });

  it('each sets sport has pointsPerSet in config', () => {
    setsSports.forEach(id => {
      expect(typeof SPORT_REGISTRY[id].config.pointsPerSet).toBe('number');
    });
  });

  it('each sets sport has winBy in config', () => {
    setsSports.forEach(id => {
      expect(typeof SPORT_REGISTRY[id].config.winBy).toBe('number');
    });
  });

  it('each sets sport has setFormats array', () => {
    setsSports.forEach(id => {
      expect(Array.isArray(SPORT_REGISTRY[id].config.setFormats)).toBe(true);
      expect(SPORT_REGISTRY[id].config.setFormats.length).toBeGreaterThan(0);
    });
  });

  it('volleyball has 25 points per set, decider at 15', () => {
    const vb = SPORT_REGISTRY.volleyball;
    expect(vb.config.pointsPerSet).toBe(25);
    expect(vb.config.deciderPoints).toBe(15);
  });

  it('badminton has 21 points per set with max 30', () => {
    const bd = SPORT_REGISTRY.badminton;
    expect(bd.config.pointsPerSet).toBe(21);
    expect(bd.config.maxPoints).toBe(30);
  });

  it('table tennis has 11 points per set', () => {
    expect(SPORT_REGISTRY.tabletennis.config.pointsPerSet).toBe(11);
  });
});

// ─── Goals-based sports ────────────────────────────────────────────────────────

describe('Goals-based sports config', () => {
  const goalsSports = ['football', 'basketball', 'hockey', 'kabaddi'];

  it('has engine = "goals"', () => {
    goalsSports.forEach(id => {
      expect(SPORT_REGISTRY[id].engine).toBe('goals');
    });
  });

  it('each goals sport has winPoints in config', () => {
    goalsSports.forEach(id => {
      expect(typeof SPORT_REGISTRY[id].config.winPoints).toBe('number');
    });
  });

  it('football awards 3 points for a win and allows draws', () => {
    const fb = SPORT_REGISTRY.football;
    expect(fb.config.winPoints).toBe(3);
    expect(fb.config.drawAllowed).toBe(true);
    expect(fb.config.drawPoints).toBe(1);
  });

  it('basketball awards 2 points for a win and disallows draws', () => {
    const bb = SPORT_REGISTRY.basketball;
    expect(bb.config.winPoints).toBe(2);
    expect(bb.config.drawAllowed).toBe(false);
  });

  it('basketball has quick buttons for 1/2/3 point scoring', () => {
    const bb = SPORT_REGISTRY.basketball;
    expect(bb.config.quickButtons).toHaveLength(3);
    expect(bb.config.quickButtons.map(b => b.value)).toEqual([1, 2, 3]);
  });

  it('kabaddi awards 2 points for a win', () => {
    expect(SPORT_REGISTRY.kabaddi.config.winPoints).toBe(2);
  });
});

// ─── Cricket ───────────────────────────────────────────────────────────────────

describe('Cricket config', () => {
  it('has custom-cricket engine', () => {
    expect(SPORT_REGISTRY.cricket.engine).toBe('custom-cricket');
  });

  it('has quick buttons including wicket', () => {
    const wicketBtn = SPORT_REGISTRY.cricket.config.quickButtons.find(b => b.isWicket);
    expect(wicketBtn).toBeDefined();
    expect(wicketBtn.label).toBe('W');
  });

  it('has correct storageKey', () => {
    expect(SPORT_REGISTRY.cricket.storageKey).toBe('se_cricket');
  });
});

// ─── Helper functions ──────────────────────────────────────────────────────────

describe('getSportsList', () => {
  it('returns array of 9 sport objects', () => {
    const list = getSportsList();
    expect(list).toHaveLength(9);
    expect(list[0]).toHaveProperty('id');
    expect(list[0]).toHaveProperty('name');
  });

  it("lists Tier-0 first in the plan's India-first order, then the kept-later three", () => {
    expect(getSportsList().map(s => s.id)).toEqual([
      'cricket', 'kabaddi', 'volleyball', 'badminton', 'football', 'basketball',
      'tennis', 'tabletennis', 'hockey',
    ]);
  });

  it('follows the single order source in sportFocus.js', () => {
    const registered = SPORT_ORDER.filter(id => SPORT_REGISTRY[id]);
    expect(getSportsList().map(s => s.id)).toEqual(registered);
  });
});

describe('getSetsSports', () => {
  it('returns only sets-engine sports', () => {
    const setsSports = getSetsSports();
    expect(setsSports).toHaveLength(4);
    setsSports.forEach(s => {
      expect(s.engine).toBe('sets');
    });
  });
});

describe('getGoalsSports', () => {
  it('returns only goals-engine sports', () => {
    const goalsSports = getGoalsSports();
    expect(goalsSports).toHaveLength(4);
    goalsSports.forEach(s => {
      expect(s.engine).toBe('goals');
    });
  });
});

describe('getSportById', () => {
  it('returns correct sport for valid id', () => {
    const volleyball = getSportById('volleyball');
    expect(volleyball).not.toBeNull();
    expect(volleyball.name).toBe('Volleyball');
  });

  it('returns null for invalid id', () => {
    expect(getSportById('nonexistent')).toBeNull();
  });

  it('returns each sport correctly', () => {
    const ids = ['volleyball', 'football', 'cricket', 'basketball'];
    ids.forEach(id => {
      const sport = getSportById(id);
      expect(sport.id).toBe(id);
    });
  });
});

describe('getSportsByCategory', () => {
  it('groups sports into the two focus tiers, Popular first', () => {
    expect(Object.keys(getSportsByCategory())).toEqual(['Popular', 'More sports']);
  });

  it('Popular holds the registered Tier-0 sports in plan order', () => {
    const popular = getSportsByCategory().Popular.map(s => s.id);
    expect(popular).toEqual(['cricket', 'kabaddi', 'volleyball', 'badminton', 'football', 'basketball']);
    expect(popular).toEqual(PRIORITY_SPORT_IDS.filter(id => SPORT_REGISTRY[id]));
  });

  it('More sports holds the kept-later three', () => {
    const later = getSportsByCategory()['More sports'].map(s => s.id);
    expect(later).toEqual(['tennis', 'tabletennis', 'hockey']);
    expect(later).toEqual(LATER_SPORT_IDS);
  });

  it('covers every registered sport exactly once', () => {
    const all = Object.values(getSportsByCategory()).flat().map(s => s.id);
    expect(all).toHaveLength(new Set(all).size);
    expect([...all].sort()).toEqual(Object.keys(SPORT_REGISTRY).sort());
  });

  it('keeps tennis and table tennis as intentionally distinct cards', () => {
    const tennisCards = getSportsByCategory()['More sports'].filter(sport => /tennis/i.test(sport.name));

    expect(tennisCards.map(sport => sport.id)).toEqual(['tennis', 'tabletennis']);
    expect(tennisCards.map(sport => sport.name)).toEqual(['Tennis', 'Table Tennis']);
    expect(new Set(tennisCards.map(sport => sport.desc)).size).toBe(2);
  });
});

// ─── Retired (deregistered) sports — saved data stays readable ────────────────

describe('retired sports', () => {
  it('knows all five deregistered sports with a label, engine and storage key', () => {
    RETIRED_IDS.forEach(id => {
      const retired = getRetiredSport(id);
      expect(retired).not.toBeNull();
      expect(retired.id).toBe(id);
      expect(typeof retired.name).toBe('string');
      expect(['sets', 'goals']).toContain(retired.engine);
      expect(retired.storageKey).toBe(`se_${id}`);
    });
    expect(getRetiredSportsList().map(s => s.id).sort()).toEqual([...RETIRED_IDS].sort());
  });

  it('does not treat a registered or unknown sport as retired', () => {
    expect(getRetiredSport('volleyball')).toBeNull();
    expect(getRetiredSport('nonexistent')).toBeNull();
    expect(getRetiredSport(undefined)).toBeNull();
  });
});

describe('getSportLabel', () => {
  it('names registered sports from the registry', () => {
    expect(getSportLabel('tabletennis')).toBe('Table Tennis');
  });

  it('still names a retired sport so its saved matches read properly', () => {
    expect(getSportLabel('pickleball')).toBe('Pickleball');
    expect(getSportLabel('futsal')).toBe('Futsal');
  });

  it('falls back to a generic label for an unknown or missing sport', () => {
    expect(getSportLabel('curling')).toBe('Other sport');
    expect(getSportLabel(null)).toBe('Other sport');
  });
});

describe('isTeamColourSport', () => {
  it('does not opt retired sports into team colour or put them back in pickers', () => {
    RETIRED_IDS.forEach(id => {
      expect(isTeamColourSport(id)).toBe(false);
    });
    const pickerIds = Object.values(getSportsByCategory()).flat().map(sport => sport.id);
    expect(pickerIds).toEqual(getSportsList().map(sport => sport.id));
    expect(pickerIds.filter(id => isTeamColourSport(id))).toEqual(
      getSportsList().filter(sport => sport.teamColour === true).map(sport => sport.id),
    );
  });

  it('is true only for a sport whose registry entry opts in', () => {
    const registry = {
      on: { id: 'on', engine: 'sets', teamColour: true },
      off: { id: 'off', engine: 'sets' },
    };
    expect(isTeamColourSport('on', registry)).toBe(true);
    expect(isTeamColourSport('off', registry)).toBe(false);
    expect(isTeamColourSport('missing', registry)).toBe(false);
  });

  it('is false for unknown ids and prototype keys', () => {
    expect(isTeamColourSport('nonexistent')).toBe(false);
    expect(isTeamColourSport('toString')).toBe(false);
    expect(isTeamColourSport(undefined)).toBe(false);
  });

  it('only flags sets or goals sports that have a court drawing (never tennis or cricket)', () => {
    for (const sport of getSportsList().filter((s) => isTeamColourSport(s.id))) {
      expect(['sets', 'goals']).toContain(sport.engine);
      expect(['tennis', 'cricket']).not.toContain(sport.id);
      expect(COURT_MOTIFS[sport.id], sport.id).toBeTruthy();
    }
  });
});
