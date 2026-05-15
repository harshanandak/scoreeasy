import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSportTournaments, loadPreference, savePreference } from '../../utils/storage';
import { getSportsByCategory } from '../../models/sportRegistry';
import { CRICKET_FORMATS } from '../../utils/cricketCalculations';
import BackArrow from './components/BackArrow';
import SportIcon from './SportIcon';

// Cricket formats as individual sport-like cards
const CRICKET_FORMAT_CARDS = CRICKET_FORMATS.map(f => ({
  id: f.id,
  name: f.name,
  desc: f.desc,
  icon: '🏏',
  overs: f.overs,
  players: f.players,
}));

const LAYOUT_KEY = 'se_sport_layout';
const DEFAULT_CATEGORY = 'Net Sports';
const QUICK_ACTION_HELP = {
  quick: 'Score one match now',
  tournament: 'Schedule, standings, history',
};

export default function MonoSportHome() {
  const navigate = useNavigate();
  const SPORT_CATEGORIES = getSportsByCategory();
  const categoryKeys = Object.keys(SPORT_CATEGORIES);
  const [visible, setVisible] = useState(false);
  const [tournamentCounts, setTournamentCounts] = useState({});
  const [activeTab, setActiveTab] = useState(SPORT_CATEGORIES[DEFAULT_CATEGORY] ? DEFAULT_CATEGORY : (categoryKeys[0] ?? null));
  const [selectedSportId, setSelectedSportId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [layout, setLayout] = useState(() => {
    return loadPreference(LAYOUT_KEY, 'tabs'); // 'tabs' or 'grid'
  });

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    // Load tournament counts for all sports
    const counts = {};
    Object.values(SPORT_CATEGORIES).flat().forEach(sport => {
      const tournaments = loadSportTournaments(sport.storageKey);
      counts[sport.id] = tournaments.length;
    });
    setTournamentCounts(counts);
  }, []);

  const getCounts = (id) => {
    return tournamentCounts[id] || 0;
  };

  const switchLayout = () => {
    const newLayout = layout === 'tabs' ? 'grid' : 'tabs';
    setLayout(newLayout);
    savePreference(LAYOUT_KEY, newLayout);
  };

  const allSports = Object.values(SPORT_CATEGORIES).flat().filter(s => s.id !== 'cricket');
  // Include cricket formats as searchable entries
  const allEntries = [
    ...allSports.map(s => ({ ...s, type: 'sport' })),
    ...CRICKET_FORMAT_CARDS.map(cf => ({
      id: `cricket-${cf.id}`,
      name: `Cricket ${cf.name}`,
      desc: cf.desc,
      icon: cf.icon,
      type: 'cricket-format',
      formatId: cf.id,
    })),
  ];
  const filteredSports = searchQuery.trim()
    ? allEntries.filter(s => s.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : [];
  const activeSports = activeTab ? (SPORT_CATEGORIES[activeTab] ?? []) : [];
  const activeTabPanelId = activeTab ? `tabpanel-${activeTab.replaceAll(/\s+/g, '-')}` : 'tabpanel-empty';

  return (
    <div className={`min-h-screen px-4 sm:px-6 py-6 sm:py-10 mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <nav className="flex items-center justify-between mb-12" aria-label="Sport selection navigation">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-sm bg-transparent border-none cursor-pointer font-swiss"
              style={{ color: '#888' }}
              aria-label="Go back to home"
            >
              <BackArrow />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="font-mono" style={{ fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#111', lineHeight: 1.1 }}>
                  SCORE EASY
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: '#888' }}>
                All sports
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={switchLayout}
              style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #eee', background: '#fff', color: '#888', cursor: 'pointer' }}
              title={layout === 'grid' ? 'Switch to list' : 'Switch to grid'}
            >
              {layout === 'grid' ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="4" x2="15" y2="4"/><line x1="1" y1="8" x2="15" y2="8"/><line x1="1" y1="12" x2="15" y2="12"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
              )}
            </button>
            <button
              onClick={() => navigate('/statistics')}
              className="mono-btn"
              style={{ fontSize: '0.9375rem', padding: '10px 18px', fontWeight: '500' }}
            >
              Statistics
            </button>
          </div>
        </nav>

        {/* Search */}
        <div className="mb-8">
          <input
            type="text"
            className="mono-input"
            placeholder="Search sports..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSelectedSportId(null); }}
          />
        </div>

        {/* Search Results */}
        {searchQuery.trim() ? (
          <div className="mb-8">
            <h2 className="text-xs uppercase tracking-widest font-normal mb-6" style={{ color: '#888' }}>
              {filteredSports.length} result{filteredSports.length === 1 ? '' : 's'}
            </h2>
            {filteredSports.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredSports.map(entry => (
                  <div key={entry.id} className="mono-card flex flex-col" style={{ padding: 0 }}>
                    <div className="flex flex-col flex-1" style={{ padding: '20px 24px' }}>
                      <div className="flex items-center gap-3 mb-3">
                        <SportIcon name={entry.type === 'cricket-format' ? 'Cricket' : entry.name} size={32} color="#111" />
                        <div className="flex-1">
                          <h3 className="text-base font-semibold" style={{ color: '#111' }}>
                            {entry.name}
                          </h3>
                        </div>
                      </div>

                      <p className="text-xs mb-2" style={{ color: '#888' }}>{entry.desc}</p>

                      <div className="flex gap-2 mb-4 text-xs font-mono" style={{ color: '#888' }}>
                        {entry.type === 'cricket-format' ? (
                          <span>{entry.id === 'cricket-custom' ? 'Fully configurable' : `${CRICKET_FORMAT_CARDS.find(c => c.id === entry.formatId)?.overs || 'Unlimited'} ov`}</span>
                        ) : (
                          <span>2-8 teams</span>
                        )}
                      </div>

                      <div className="flex gap-2 mt-auto">
                        <button
                          onClick={() => navigate(
                            entry.type === 'cricket-format'
                              ? `/cricket/tournament/new?format=${entry.formatId}`
                              : `/${entry.id}/tournament`
                          )}
                          className="mono-btn-primary flex-1"
                          style={{ minHeight: 54, fontSize: '0.8125rem', padding: '9px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}
                        >
                          <span>Tournament</span>
                          <span style={{ fontSize: '0.625rem', fontWeight: 500, opacity: 0.85 }}>{QUICK_ACTION_HELP.tournament}</span>
                        </button>
                        <button
                          onClick={() => navigate(
                            entry.type === 'cricket-format'
                              ? `/cricket/quick?format=${entry.formatId}`
                              : `/${entry.id}/quick`
                          )}
                          className="mono-btn flex-1"
                          style={{ minHeight: 54, fontSize: '0.8125rem', padding: '9px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}
                        >
                          <span>Quick Match</span>
                          <span style={{ fontSize: '0.625rem', fontWeight: 500, color: '#666' }}>{QUICK_ACTION_HELP.quick}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: '#888' }}>No sports found.</p>
            )}
          </div>
        ) : (

        <div className="mb-8">
          <section
            className="mono-card mb-8"
            aria-label="Volleyball fast start"
            style={{ padding: 0, overflow: 'hidden', borderColor: '#dbe7ff' }}
          >
            <div style={{ padding: '20px 24px', background: '#f8fbff' }}>
              <div className="flex items-start gap-4">
                <div
                  aria-hidden="true"
                  style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #dbe7ff' }}
                >
                  <SportIcon name="Volleyball" size={32} color="#0066ff" />
                </div>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#0066ff' }}>Ready to score</p>
                  <h2 className="text-lg font-semibold mb-1" style={{ color: '#111' }}>Volleyball is ready first</h2>
                  <p className="text-sm" style={{ color: '#555', lineHeight: 1.5 }}>
                    Start a single match immediately, or build a tournament with standings when you need a full event.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() => navigate('/volleyball/quick')}
                  className="mono-btn-primary"
                  style={{ minHeight: 52, fontSize: '0.875rem', padding: '10px 14px' }}
                >
                  Start Volleyball Match
                </button>
                <button
                  onClick={() => navigate('/volleyball/tournament')}
                  className="mono-btn"
                  style={{ minHeight: 52, fontSize: '0.875rem', padding: '10px 14px', background: '#fff' }}
                >
                  Create Volleyball Tournament
                </button>
              </div>
            </div>
          </section>

          <h2 className="text-xs uppercase tracking-widest font-normal mb-6" style={{ color: '#888' }}>
            Choose sport
          </h2>

          {/* TABBED LAYOUT */}
          {layout === 'tabs' && (
            <>
              {/* Tab Headers */}
              <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Sport categories">
                {categoryKeys.map(category => (
                  <button
                    key={category}
                    onClick={() => setActiveTab(category)}
                    role="tab"
                    aria-selected={activeTab === category}
                    aria-controls={`tabpanel-${category.replaceAll(/\s+/g, '-')}`}
                    className={`text-xs px-4 transition-all ${
                      activeTab === category ? 'font-medium' : 'font-normal'
                    }`}
                    style={{
                      minHeight: 44,
                      color: activeTab === category ? '#0066ff' : '#555',
                      background: activeTab === category ? '#eef5ff' : '#fff',
                      border: activeTab === category ? '1px solid #0066ff' : '1px solid #eee',
                      cursor: 'pointer',
                    }}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="animate-fade-in" role="tabpanel" id={activeTabPanelId} aria-label={activeTab || 'No category selected'}>
                {activeTab === 'Cricket' ? (
                  /* Cricket: each format is its own card */
                  <div>
                    {getCounts('cricket') > 0 && (
                      <div className="text-xs mb-4 flex items-center gap-2" style={{ color: '#888' }}>
                        <span className="font-mono">{getCounts('cricket')} saved</span> tournament{getCounts('cricket') > 1 ? 's' : ''}
                        <button
                          onClick={() => navigate('/cricket/tournament')}
                          className="text-xs bg-transparent border-none cursor-pointer font-swiss"
                          style={{ color: '#0066ff' }}
                        >
                          View all
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {CRICKET_FORMAT_CARDS.map(cf => (
                        <div key={cf.id} className="mono-card flex flex-col" style={{ padding: 0 }}>
                          <div className="flex flex-col flex-1" style={{ padding: '20px 24px' }}>
                            <div className="flex items-center gap-3 mb-3">
                              <SportIcon name="Cricket" size={32} color="#111" />
                              <div className="flex-1">
                                <h3 className="text-base font-semibold" style={{ color: '#111' }}>
                                  {cf.name}
                                </h3>
                              </div>
                            </div>

                            <p className="text-xs mb-2" style={{ color: '#888' }}>{cf.desc}</p>

                            <div className="flex gap-2 mb-4 text-xs font-mono" style={{ color: '#888' }}>
                              {cf.id === 'custom' ? (
                                <span>Fully configurable</span>
                              ) : (
                                <>
                                  <span>{cf.overs ? `${cf.overs} ov` : 'Unlimited'}</span>
                                  <span style={{ color: '#ddd' }}>|</span>
                                  <span>{cf.players} players</span>
                                </>
                              )}
                            </div>

                            <div className="flex gap-2 mt-auto">
                            <button
                              onClick={() => navigate(`/cricket/tournament/new?format=${cf.id}`)}
                              className="mono-btn-primary flex-1"
                              style={{ minHeight: 54, fontSize: '0.8125rem', padding: '9px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}
                            >
                              <span>Tournament</span>
                              <span style={{ fontSize: '0.625rem', fontWeight: 500, opacity: 0.85 }}>{QUICK_ACTION_HELP.tournament}</span>
                            </button>
                            <button
                              onClick={() => navigate(`/cricket/quick?format=${cf.id}`)}
                              className="mono-btn flex-1"
                              style={{ minHeight: 54, fontSize: '0.8125rem', padding: '9px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}
                            >
                              <span>Quick Match</span>
                              <span style={{ fontSize: '0.625rem', fontWeight: 500, color: '#666' }}>{QUICK_ACTION_HELP.quick}</span>
                            </button>
                          </div>
                        </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Standard sports grid */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {activeSports.length > 0 ? activeSports.map(sport => (
                      <div key={sport.id} className="mono-card flex flex-col" style={{ padding: 0 }}>
                        <div className="flex flex-col flex-1" style={{ padding: '20px 24px' }}>
                          <div className="flex items-center gap-3 mb-3">
                            <SportIcon name={sport.name} size={32} color="#111" />
                            <div className="flex-1">
                              <h3 className="text-base font-semibold" style={{ color: '#111' }}>
                                {sport.name}
                              </h3>
                            </div>
                          </div>

                          <p className="text-xs mb-2" style={{ color: '#888' }}>{sport.desc}</p>

                          <div className="flex gap-2 mb-4 text-xs font-mono" style={{ color: '#888' }}>
                            {getCounts(sport.id) > 0 ? (
                              <span>{getCounts(sport.id)} saved tournament{getCounts(sport.id) === 1 ? '' : 's'}</span>
                            ) : (
                              <span>2-8 teams</span>
                            )}
                          </div>

                          <div className="flex gap-2 mt-auto">
                            <button
                              onClick={() => navigate(`/${sport.id}/tournament`)}
                              className="mono-btn-primary flex-1"
                              style={{ minHeight: 54, fontSize: '0.8125rem', padding: '9px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}
                            >
                              <span>Tournament</span>
                              <span style={{ fontSize: '0.625rem', fontWeight: 500, opacity: 0.85 }}>{QUICK_ACTION_HELP.tournament}</span>
                            </button>
                            <button
                              onClick={() => navigate(`/${sport.id}/quick`)}
                              className="mono-btn flex-1"
                              style={{ minHeight: 54, fontSize: '0.8125rem', padding: '9px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}
                            >
                              <span>Quick Match</span>
                              <span style={{ fontSize: '0.625rem', fontWeight: 500, color: '#666' }}>{QUICK_ACTION_HELP.quick}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm" style={{ color: '#888' }}>No sports available.</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* GRID LAYOUT */}
          {layout === 'grid' && (
            <>
              {Object.entries(SPORT_CATEGORIES).map(([category, sports]) => (
                <div key={category} className="mb-8">
                  <h3 className="text-xs font-medium mb-4" style={{ color: '#666' }}>
                    {category}
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {category === 'Cricket' ? (
                      /* Cricket: each format is its own grid card */
                      CRICKET_FORMAT_CARDS.map(cf => {
                        const isOpen = selectedSportId === `cricket-${cf.id}`;
                        return (
                          <div
                            key={cf.id}
                            className="transition-all"
                            style={{
                              padding: '16px',
                              background: isOpen ? '#fff' : 'transparent',
                              border: isOpen ? '1px solid #0066ff' : '1px solid #eee',
                            }}
                          >
                            <button
                              className="w-full bg-transparent border-none cursor-pointer"
                              style={{ padding: 0 }}
                              onClick={() => setSelectedSportId(isOpen ? null : `cricket-${cf.id}`)}
                              aria-label={`Select ${cf.name}`}
                            >
                              <div className="flex flex-col items-center text-center">
                                <SportIcon name="Cricket" size={28} color="#111" />
                                <span className="text-sm font-semibold mb-1 block" style={{ color: '#111' }}>
                                  {cf.name}
                                </span>
                                <span className="text-xs" style={{ color: '#888' }}>
                                  {cf.desc}
                                </span>
                              </div>
                            </button>

                            {isOpen && (
                              <div className="flex flex-col gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #eee' }}>
                                <button
                                  onClick={() => navigate(`/cricket/tournament/new?format=${cf.id}`)}
                                  className="mono-btn-primary"
                                  style={{ minHeight: 54, padding: '8px 10px', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}
                                >
                                  <span>Tournament</span>
                                  <span style={{ fontSize: '0.625rem', fontWeight: 500, opacity: 0.85 }}>{QUICK_ACTION_HELP.tournament}</span>
                                </button>
                                <button
                                  onClick={() => navigate(`/cricket/quick?format=${cf.id}`)}
                                  className="mono-btn"
                                  style={{ minHeight: 54, padding: '8px 10px', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}
                                >
                                  <span>Quick Match</span>
                                  <span style={{ fontSize: '0.625rem', fontWeight: 500, color: '#666' }}>{QUICK_ACTION_HELP.quick}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      /* Standard sports */
                      sports.map(sport => {
                        const isOpen = selectedSportId === sport.id;
                        return (
                          <div
                            key={sport.id}
                            className="transition-all"
                            style={{
                              padding: '16px',
                              background: isOpen ? '#fff' : 'transparent',
                              border: isOpen ? '1px solid #0066ff' : '1px solid #eee',
                            }}
                          >
                            <button
                              className="w-full bg-transparent border-none cursor-pointer"
                              style={{ padding: 0 }}
                              onClick={() => setSelectedSportId(isOpen ? null : sport.id)}
                              aria-label={`Select ${sport.name}`}
                            >
                              <div className="flex flex-col items-center text-center">
                                <SportIcon name={sport.name} size={28} color="#111" />
                                <span className="text-sm font-semibold mb-1 block" style={{ color: '#111' }}>
                                  {sport.name}
                                </span>
                                {getCounts(sport.id) > 0 && (
                                  <span className="text-xs font-mono" style={{ color: '#888' }}>
                                    {getCounts(sport.id)} saved
                                  </span>
                                )}
                              </div>
                            </button>

                            {isOpen && (
                              <div className="flex flex-col gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #eee' }}>
                                <button
                                  onClick={() => navigate(`/${sport.id}/tournament`)}
                                  className="mono-btn-primary"
                                  style={{ minHeight: 54, padding: '8px 10px', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}
                                >
                                  <span>Tournament</span>
                                  <span style={{ fontSize: '0.625rem', fontWeight: 500, opacity: 0.85 }}>{QUICK_ACTION_HELP.tournament}</span>
                                </button>
                                <button
                                  onClick={() => navigate(`/${sport.id}/quick`)}
                                  className="mono-btn"
                                  style={{ minHeight: 54, padding: '8px 10px', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}
                                >
                                  <span>Quick Match</span>
                                  <span style={{ fontSize: '0.625rem', fontWeight: 500, color: '#666' }}>{QUICK_ACTION_HELP.quick}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        )}
      </div>
    </div>
  );
}
