import {
  SPORT_REGISTRY,
  getSportsList,
  getSetsSports,
  getGoalsSports,
  getSportById,
  getSportsByCategory,
} from './sportRegistry';

// ─── All 14 sports registered ──────────────────────────────────────────────────

describe('SPORT_REGISTRY', () => {
  const sportIds = Object.keys(SPORT_REGISTRY);

  it('has exactly 14 sports', () => {
    expect(sportIds).toHaveLength(14);
  });

  it('contains all expected sport ids', () => {
    const expected = [
      'volleyball', 'badminton', 'tabletennis', 'tennis', 'pickleball', 'squash',
      'football', 'basketball', 'hockey', 'handball', 'futsal', 'kabaddi', 'rugby',
      'cricket',
    ];
    expected.forEach(id => {
      expect(SPORT_REGISTRY).toHaveProperty(id);
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
  const setsSports = ['volleyball', 'badminton', 'tabletennis', 'tennis', 'pickleball', 'squash'];

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
  const goalsSports = ['football', 'basketball', 'hockey', 'handball', 'futsal', 'kabaddi', 'rugby'];

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

  it('rugby awards 4 points for a win and 2 for draw', () => {
    const rugby = SPORT_REGISTRY.rugby;
    expect(rugby.config.winPoints).toBe(4);
    expect(rugby.config.drawPoints).toBe(2);
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
  it('returns array of 14 sport objects', () => {
    const list = getSportsList();
    expect(list).toHaveLength(14);
    expect(list[0]).toHaveProperty('id');
    expect(list[0]).toHaveProperty('name');
  });
});

describe('getSetsSports', () => {
  it('returns only sets-engine sports', () => {
    const setsSports = getSetsSports();
    expect(setsSports).toHaveLength(6);
    setsSports.forEach(s => {
      expect(s.engine).toBe('sets');
    });
  });
});

describe('getGoalsSports', () => {
  it('returns only goals-engine sports', () => {
    const goalsSports = getGoalsSports();
    expect(goalsSports).toHaveLength(7);
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
  it('returns an object with category keys', () => {
    const categories = getSportsByCategory();
    expect(categories).toHaveProperty('Racquet Sports');
    expect(categories).toHaveProperty('Team Sports');
    expect(categories).toHaveProperty('Contact Sports');
    expect(categories).toHaveProperty('Net Sports');
    expect(categories).toHaveProperty('Cricket');
  });

  it('Racquet Sports has 5 sports', () => {
    expect(getSportsByCategory()['Racquet Sports']).toHaveLength(5);
  });

  it('Team Sports has 5 sports', () => {
    expect(getSportsByCategory()['Team Sports']).toHaveLength(5);
  });

  it('Contact Sports has 2 sports', () => {
    expect(getSportsByCategory()['Contact Sports']).toHaveLength(2);
  });

  it('Net Sports has 1 sport (volleyball)', () => {
    const net = getSportsByCategory()['Net Sports'];
    expect(net).toHaveLength(1);
    expect(net[0].id).toBe('volleyball');
  });

  it('Cricket has 1 sport (cricket)', () => {
    const cricket = getSportsByCategory()['Cricket'];
    expect(cricket).toHaveLength(1);
    expect(cricket[0].id).toBe('cricket');
  });
});
