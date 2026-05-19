import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { loadSportTournaments, loadPreference, savePreference } from '../../utils/storage';
import { getSportsByCategory } from '../../models/sportRegistry';
import { CRICKET_FORMATS } from '../../utils/cricketCalculations';
import SportIcon from './SportIcon';

const CRICKET_FORMAT_CARDS = CRICKET_FORMATS.map(format => ({
  id: format.id,
  name: format.name,
  desc: format.desc,
  overs: format.overs,
  players: format.players,
}));

const LAYOUT_KEY = 'se_sport_layout';
const DEFAULT_CATEGORY = 'Cricket';
const QUICK_ACTION_HELP = {
  quick: 'Score one match now',
  tournament: 'Schedule, standings, history',
};

const sportShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  desc: PropTypes.string,
  storageKey: PropTypes.string,
});

const cricketFormatShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  desc: PropTypes.string,
  overs: PropTypes.number,
  players: PropTypes.number,
});

function slugForCategory(category) {
  return category.replaceAll(/\s+/g, '-');
}

function ActionButtons({ onTournament, onQuick, compact = false, stacked = false, className = 'flex gap-2 mt-auto' }) {
  const buttonStyle = compact
    ? { minHeight: 54, padding: '8px 10px', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }
    : { minHeight: 54, fontSize: '0.8125rem', padding: '9px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 };
  const flexClass = stacked ? '' : ' flex-1';

  return (
    <div className={className}>
      <button onClick={onTournament} className={`mono-btn-primary${flexClass}`} style={buttonStyle}>
        <span>Tournament</span>
        <span style={{ fontSize: '0.625rem', fontWeight: 500, opacity: 0.85 }}>{QUICK_ACTION_HELP.tournament}</span>
      </button>
      <button onClick={onQuick} className={`mono-btn${flexClass}`} style={buttonStyle}>
        <span>Quick Match</span>
        <span style={{ fontSize: '0.625rem', fontWeight: 500, color: '#666' }}>{QUICK_ACTION_HELP.quick}</span>
      </button>
    </div>
  );
}

ActionButtons.propTypes = {
  onTournament: PropTypes.func.isRequired,
  onQuick: PropTypes.func.isRequired,
  compact: PropTypes.bool,
  stacked: PropTypes.bool,
  className: PropTypes.string,
};

function Metadata({ children }) {
  return (
    <div className="flex gap-2 mb-4 text-xs font-mono" style={{ color: '#888' }}>
      {children}
    </div>
  );
}

Metadata.propTypes = {
  children: PropTypes.node.isRequired,
};

function SearchResultCard({ entry, navigate }) {
  const isCricketFormat = entry.type === 'cricket-format';
  const format = CRICKET_FORMAT_CARDS.find(card => card.id === entry.formatId);

  return (
    <div className="mono-card flex flex-col" style={{ padding: 0 }}>
      <div className="flex flex-col flex-1" style={{ padding: '20px 24px' }}>
        <div className="flex items-center gap-3 mb-3">
          <SportIcon name={isCricketFormat ? 'Cricket' : entry.name} size={32} color="#111" />
          <div className="flex-1">
            <h3 className="text-base font-semibold" style={{ color: '#111' }}>{entry.name}</h3>
          </div>
        </div>

        <p className="text-xs mb-2" style={{ color: '#888' }}>{entry.desc}</p>

        <Metadata>
          {isCricketFormat ? (
            <span>{entry.id === 'cricket-custom' ? 'Fully configurable' : `${format?.overs || 'Unlimited'} ov`}</span>
          ) : (
            <span>2-8 teams</span>
          )}
        </Metadata>

        <ActionButtons
          onTournament={() => navigate(isCricketFormat ? `/cricket/tournament/new?format=${entry.formatId}` : `/${entry.id}/tournament`)}
          onQuick={() => navigate(isCricketFormat ? `/cricket/quick?format=${entry.formatId}` : `/${entry.id}/quick`)}
        />
      </div>
    </div>
  );
}

SearchResultCard.propTypes = {
  entry: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    desc: PropTypes.string,
    type: PropTypes.string.isRequired,
    formatId: PropTypes.string,
  }).isRequired,
  navigate: PropTypes.func.isRequired,
};

function SearchResults({ filteredSports, navigate }) {
  return (
    <div className="mb-8">
      <h2 className="text-xs uppercase tracking-widest font-normal mb-6" style={{ color: '#888' }}>
        {filteredSports.length} result{filteredSports.length === 1 ? '' : 's'}
      </h2>
      {filteredSports.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSports.map(entry => (
            <SearchResultCard key={entry.id} entry={entry} navigate={navigate} />
          ))}
        </div>
      ) : (
        <p className="text-sm" style={{ color: '#888' }}>No sports found.</p>
      )}
    </div>
  );
}

SearchResults.propTypes = {
  filteredSports: PropTypes.arrayOf(SearchResultCard.propTypes.entry).isRequired,
  navigate: PropTypes.func.isRequired,
};

const priorityFastStartActions = [
  { label: 'Start Cricket', path: '/cricket/quick?format=T20', className: 'mono-btn-primary' },
  { label: 'Start Football', path: '/football/quick', className: 'mono-btn' },
  { label: 'Start Volleyball', path: '/volleyball/quick', className: 'mono-btn' },
];

const priorityActionStyle = { minHeight: 52, fontSize: '0.875rem', padding: '10px 14px' };
const secondaryPriorityActionStyle = { ...priorityActionStyle, background: '#fff' };

function PriorityFastStart({ navigate }) {
  return (
    <section className="mono-card mb-8" aria-label="Priority sport fast start" style={{ padding: 0, overflow: 'hidden', borderColor: '#dbe7ff' }}>
      <div style={{ padding: '20px 24px', background: '#f8fbff' }}>
        <div className="flex items-start gap-4">
          <div aria-hidden="true" style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #dbe7ff' }}>
            <SportIcon name="Cricket" size={32} color="#0066ff" />
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#0066ff' }}>Ready to score</p>
            <h2 className="text-lg font-semibold mb-1" style={{ color: '#111' }}>Cricket and football are ready first</h2>
            <p className="text-sm" style={{ color: '#555', lineHeight: 1.5 }}>
              Start the most-played formats quickly, then use the sport cards below when you need volleyball or another game.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {priorityFastStartActions.map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className={action.className}
              style={action.className === 'mono-btn-primary' ? priorityActionStyle : secondaryPriorityActionStyle}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

PriorityFastStart.propTypes = {
  navigate: PropTypes.func.isRequired,
};

function CategoryTabs({ categoryKeys, activeTab, setActiveTab }) {
  return (
    <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Sport categories">
      {categoryKeys.map(category => {
        const categorySlug = slugForCategory(category);
        return (
          <button
            key={category}
            id={`tab-${categorySlug}`}
            onClick={() => setActiveTab(category)}
            role="tab"
            aria-selected={activeTab === category}
            aria-controls={`tabpanel-${categorySlug}`}
            className={`text-xs px-4 transition-all ${activeTab === category ? 'font-medium' : 'font-normal'}`}
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
        );
      })}
    </div>
  );
}

CategoryTabs.propTypes = {
  categoryKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
  activeTab: PropTypes.string,
  setActiveTab: PropTypes.func.isRequired,
};

function CricketListCard({ format, navigate }) {
  return (
    <div className="mono-card flex flex-col" style={{ padding: 0 }}>
      <div className="flex flex-col flex-1" style={{ padding: '20px 24px' }}>
        <div className="flex items-center gap-3 mb-3">
          <SportIcon name="Cricket" size={32} color="#111" />
          <div className="flex-1">
            <h3 className="text-base font-semibold" style={{ color: '#111' }}>{format.name}</h3>
          </div>
        </div>

        <p className="text-xs mb-2" style={{ color: '#888' }}>{format.desc}</p>

        <Metadata>
          {format.id === 'custom' ? (
            <span>Fully configurable</span>
          ) : (
            <>
              <span>{format.overs ? `${format.overs} ov` : 'Unlimited'}</span>
              <span style={{ color: '#ddd' }}>|</span>
              <span>{format.players} players</span>
            </>
          )}
        </Metadata>

        <ActionButtons
          onTournament={() => navigate(`/cricket/tournament/new?format=${format.id}`)}
          onQuick={() => navigate(`/cricket/quick?format=${format.id}`)}
        />
      </div>
    </div>
  );
}

CricketListCard.propTypes = {
  format: cricketFormatShape.isRequired,
  navigate: PropTypes.func.isRequired,
};

function SportListCard({ sport, navigate, getCounts }) {
  const savedCount = getCounts(sport.id);

  return (
    <div className="mono-card flex flex-col" style={{ padding: 0 }}>
      <div className="flex flex-col flex-1" style={{ padding: '20px 24px' }}>
        <div className="flex items-center gap-3 mb-3">
          <SportIcon name={sport.name} size={32} color="#111" />
          <div className="flex-1">
            <h3 className="text-base font-semibold" style={{ color: '#111' }}>{sport.name}</h3>
          </div>
        </div>

        <p className="text-xs mb-2" style={{ color: '#888' }}>{sport.desc}</p>

        <Metadata>
          {savedCount > 0 ? (
            <span>{savedCount} saved tournament{savedCount === 1 ? '' : 's'}</span>
          ) : (
            <span>2-8 teams</span>
          )}
        </Metadata>

        <ActionButtons
          onTournament={() => navigate(`/${sport.id}/tournament`)}
          onQuick={() => navigate(`/${sport.id}/quick`)}
        />
      </div>
    </div>
  );
}

SportListCard.propTypes = {
  sport: sportShape.isRequired,
  navigate: PropTypes.func.isRequired,
  getCounts: PropTypes.func.isRequired,
};

function TabsLayout({ activeTab, activeSports, categoryKeys, setActiveTab, navigate, getCounts }) {
  const activeTabSlug = activeTab ? slugForCategory(activeTab) : 'empty';
  const activeTabPanelId = `tabpanel-${activeTabSlug}`;

  return (
    <>
      <CategoryTabs categoryKeys={categoryKeys} activeTab={activeTab} setActiveTab={setActiveTab} />

      <div
        className="animate-fade-in"
        role="tabpanel"
        id={activeTabPanelId}
        aria-labelledby={activeTab ? `tab-${activeTabSlug}` : undefined}
        aria-label={activeTab || 'No category selected'}
      >
        {activeTab === 'Cricket' ? (
          <CricketTab navigate={navigate} getCounts={getCounts} />
        ) : (
          <SportTab activeSports={activeSports} navigate={navigate} getCounts={getCounts} />
        )}
      </div>
    </>
  );
}

TabsLayout.propTypes = {
  activeTab: PropTypes.string,
  activeSports: PropTypes.arrayOf(sportShape).isRequired,
  categoryKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
  setActiveTab: PropTypes.func.isRequired,
  navigate: PropTypes.func.isRequired,
  getCounts: PropTypes.func.isRequired,
};

function CricketTab({ navigate, getCounts }) {
  const cricketCount = getCounts('cricket');

  return (
    <div>
      {cricketCount > 0 && (
        <div className="text-xs mb-4 flex items-center gap-2" style={{ color: '#888' }}>
          <span className="font-mono">{cricketCount} saved</span> tournament{cricketCount > 1 ? 's' : ''}
          <button onClick={() => navigate('/cricket/tournament')} className="text-xs bg-transparent border-none cursor-pointer font-swiss" style={{ color: '#0066ff' }}>
            View all
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {CRICKET_FORMAT_CARDS.map(format => (
          <CricketListCard key={format.id} format={format} navigate={navigate} />
        ))}
      </div>
    </div>
  );
}

CricketTab.propTypes = {
  navigate: PropTypes.func.isRequired,
  getCounts: PropTypes.func.isRequired,
};

function SportTab({ activeSports, navigate, getCounts }) {
  if (activeSports.length === 0) {
    return <p className="text-sm" style={{ color: '#888' }}>No sports available.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {activeSports.map(sport => (
        <SportListCard key={sport.id} sport={sport} navigate={navigate} getCounts={getCounts} />
      ))}
    </div>
  );
}

SportTab.propTypes = {
  activeSports: PropTypes.arrayOf(sportShape).isRequired,
  navigate: PropTypes.func.isRequired,
  getCounts: PropTypes.func.isRequired,
};

function GridCard({ id, title, description, iconName, selectedSportId, setSelectedSportId, children, savedCount = 0 }) {
  const isOpen = selectedSportId === id;

  return (
    <div
      className="transition-all"
      style={{
        padding: '16px',
        background: isOpen ? '#fff' : 'transparent',
        border: isOpen ? '1px solid #0066ff' : '1px solid #eee',
      }}
    >
      <button className="w-full bg-transparent border-none cursor-pointer" style={{ padding: 0 }} onClick={() => setSelectedSportId(isOpen ? null : id)} aria-label={`Select ${title}`}>
        <div className="flex flex-col items-center text-center">
          <SportIcon name={iconName} size={28} color="#111" />
          <span className="text-sm font-semibold mb-1 block" style={{ color: '#111' }}>{title}</span>
          {description && <span className="text-xs" style={{ color: '#888' }}>{description}</span>}
          {savedCount > 0 && <span className="text-xs font-mono" style={{ color: '#888' }}>{savedCount} saved</span>}
        </div>
      </button>

      {isOpen && children}
    </div>
  );
}

GridCard.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  iconName: PropTypes.string.isRequired,
  selectedSportId: PropTypes.string,
  setSelectedSportId: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  savedCount: PropTypes.number,
};

function GridActions({ onTournament, onQuick }) {
  return (
    <ActionButtons
      onTournament={onTournament}
      onQuick={onQuick}
      compact
      stacked
      className="flex flex-col gap-2 mt-3 pt-3"
    />
  );
}

GridActions.propTypes = {
  onTournament: PropTypes.func.isRequired,
  onQuick: PropTypes.func.isRequired,
};

function GridLayout({ sportCategories, selectedSportId, setSelectedSportId, navigate, getCounts }) {
  return (
    <>
      {Object.entries(sportCategories).map(([category, sports]) => (
        <div key={category} className="mb-8">
          <h3 className="text-xs font-medium mb-4" style={{ color: '#666' }}>{category}</h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {category === 'Cricket' ? (
              CRICKET_FORMAT_CARDS.map(format => (
                <GridCard
                  key={format.id}
                  id={`cricket-${format.id}`}
                  title={format.name}
                  description={format.desc}
                  iconName="Cricket"
                  selectedSportId={selectedSportId}
                  setSelectedSportId={setSelectedSportId}
                >
                  <GridActions
                    onTournament={() => navigate(`/cricket/tournament/new?format=${format.id}`)}
                    onQuick={() => navigate(`/cricket/quick?format=${format.id}`)}
                  />
                </GridCard>
              ))
            ) : (
              sports.map(sport => (
                <GridCard
                  key={sport.id}
                  id={sport.id}
                  title={sport.name}
                  iconName={sport.name}
                  selectedSportId={selectedSportId}
                  setSelectedSportId={setSelectedSportId}
                  savedCount={getCounts(sport.id)}
                >
                  <GridActions
                    onTournament={() => navigate(`/${sport.id}/tournament`)}
                    onQuick={() => navigate(`/${sport.id}/quick`)}
                  />
                </GridCard>
              ))
            )}
          </div>
        </div>
      ))}
    </>
  );
}

GridLayout.propTypes = {
  sportCategories: PropTypes.objectOf(PropTypes.arrayOf(sportShape)).isRequired,
  selectedSportId: PropTypes.string,
  setSelectedSportId: PropTypes.func.isRequired,
  navigate: PropTypes.func.isRequired,
  getCounts: PropTypes.func.isRequired,
};

function BrowseSports({ layout, activeTab, activeSports, categoryKeys, setActiveTab, sportCategories, selectedSportId, setSelectedSportId, navigate, getCounts }) {
  return (
    <div className="mb-8">
      <PriorityFastStart navigate={navigate} />

      <h2 className="text-xs uppercase tracking-widest font-normal mb-6" style={{ color: '#888' }}>
        Choose sport
      </h2>

      {layout === 'tabs' ? (
        <TabsLayout activeTab={activeTab} activeSports={activeSports} categoryKeys={categoryKeys} setActiveTab={setActiveTab} navigate={navigate} getCounts={getCounts} />
      ) : (
        <GridLayout sportCategories={sportCategories} selectedSportId={selectedSportId} setSelectedSportId={setSelectedSportId} navigate={navigate} getCounts={getCounts} />
      )}
    </div>
  );
}

BrowseSports.propTypes = {
  layout: PropTypes.string.isRequired,
  activeTab: PropTypes.string,
  activeSports: PropTypes.arrayOf(sportShape).isRequired,
  categoryKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
  setActiveTab: PropTypes.func.isRequired,
  sportCategories: PropTypes.objectOf(PropTypes.arrayOf(sportShape)).isRequired,
  selectedSportId: PropTypes.string,
  setSelectedSportId: PropTypes.func.isRequired,
  navigate: PropTypes.func.isRequired,
  getCounts: PropTypes.func.isRequired,
};

export default function MonoSportHome() {
  const navigate = useNavigate();
  const sportCategories = getSportsByCategory();
  const categoryKeys = Object.keys(sportCategories);
  const [visible, setVisible] = useState(false);
  const [tournamentCounts, setTournamentCounts] = useState({});
  const [activeTab, setActiveTab] = useState(sportCategories[DEFAULT_CATEGORY] ? DEFAULT_CATEGORY : (categoryKeys[0] ?? null));
  const [selectedSportId, setSelectedSportId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [layout, setLayout] = useState(() => loadPreference(LAYOUT_KEY, 'tabs'));

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    const counts = {};
    Object.values(sportCategories).flat().forEach(sport => {
      const tournaments = loadSportTournaments(sport.storageKey);
      counts[sport.id] = tournaments.length;
    });
    setTournamentCounts(counts);
  }, []);

  const getCounts = (id) => tournamentCounts[id] || 0;

  const switchLayout = () => {
    const newLayout = layout === 'tabs' ? 'grid' : 'tabs';
    setLayout(newLayout);
    savePreference(LAYOUT_KEY, newLayout);
  };

  const allSports = Object.values(sportCategories).flat().filter(sport => sport.id !== 'cricket');
  const allEntries = [
    ...allSports.map(sport => ({ ...sport, type: 'sport' })),
    ...CRICKET_FORMAT_CARDS.map(format => ({
      id: `cricket-${format.id}`,
      name: `Cricket ${format.name}`,
      desc: format.desc,
      type: 'cricket-format',
      formatId: format.id,
    })),
  ];
  const trimmedSearch = searchQuery.trim();
  const filteredSports = trimmedSearch
    ? allEntries.filter(entry => entry.name.toLowerCase().includes(trimmedSearch.toLowerCase()))
    : [];
  const activeSports = activeTab ? (sportCategories[activeTab] ?? []) : [];

  return (
    <div className={`min-h-screen px-4 sm:px-6 py-6 sm:py-10 mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center gap-2">
          <input
            type="text"
            className="mono-input flex-1"
            aria-label="Search sports"
            placeholder="Search sports..."
            style={{ minWidth: 0 }}
            value={searchQuery}
            onChange={event => {
              setSearchQuery(event.target.value);
              setSelectedSportId(null);
            }}
          />
          <button
            onClick={switchLayout}
            className="mono-btn flex items-center justify-center"
            aria-label={layout === 'grid' ? 'Switch to list layout' : 'Switch to grid layout'}
            style={{ width: 48, minWidth: 48, minHeight: 44, padding: 0, fontSize: '0.8125rem', fontWeight: 700 }}
            title={layout === 'grid' ? 'Switch to list' : 'Switch to grid'}
          >
            {layout === 'grid' ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><line x1="1" y1="4" x2="15" y2="4"/><line x1="1" y1="8" x2="15" y2="8"/><line x1="1" y1="12" x2="15" y2="12"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
            )}
          </button>
        </div>

        {trimmedSearch ? (
          <SearchResults filteredSports={filteredSports} navigate={navigate} />
        ) : (
          <BrowseSports
            layout={layout}
            activeTab={activeTab}
            activeSports={activeSports}
            categoryKeys={categoryKeys}
            setActiveTab={setActiveTab}
            sportCategories={sportCategories}
            selectedSportId={selectedSportId}
            setSelectedSportId={setSelectedSportId}
            navigate={navigate}
            getCounts={getCounts}
          />
        )}
      </div>
    </div>
  );
}
