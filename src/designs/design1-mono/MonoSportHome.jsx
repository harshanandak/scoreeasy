import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loadSportTournaments } from '../../utils/storage';
import { getSportsByCategory } from '../../models/sportRegistry';
import { prioritySports } from './theme/sportsTokens';
import SportIcon from './SportIcon';

const CATEGORY_PRIORITY = ['Cricket', 'Team Sports', 'Net Sports', 'Racquet Sports', 'Contact Sports'];
const MONO = 'var(--font-mono)';

/* Design-system tokens — single source of truth lives in index.css */
const t = {
  text: 'var(--foreground)',
  soft: 'var(--se-color-ink-soft)',
  muted: 'var(--muted-foreground)',
  green: 'var(--primary)',
  divider: 'color-mix(in oklch, var(--border) 14%, transparent)',
  highlight: 'color-mix(in oklch, var(--primary) 8%, transparent)',
};

const eyebrowStyle = {
  fontFamily: MONO,
  fontSize: '0.625rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: t.muted,
};

/* Bold mono is reserved for actions — things you press. */
const actionStyle = (color) => ({
  background: 'transparent',
  border: 'none',
  margin: 0,
  fontFamily: MONO,
  fontSize: '0.625rem',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color,
  cursor: 'pointer',
  padding: '14px 8px',
  minHeight: 44,
});

const sportShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  desc: PropTypes.string,
  storageKey: PropTypes.string,
});

function getOrderedCategories(sportCategories) {
  const categoryKeys = Object.keys(sportCategories);
  return [
    ...CATEGORY_PRIORITY.filter(category => categoryKeys.includes(category)),
    ...categoryKeys.filter(category => !CATEGORY_PRIORITY.includes(category)),
  ];
}

function SportRow({ sport, savedCount, highlighted, isLast, navigate }) {
  return (
    <div
      id={`sport-row-${sport.id}`}
      className="play-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 0',
        borderBottom: isLast ? 'none' : `1px solid ${t.divider}`,
        background: highlighted ? t.highlight : 'transparent',
        transition: 'background 400ms ease',
      }}
    >
      <SportIcon name={sport.name} size={22} color={t.text} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sport.name}</span>
        {savedCount > 0 && (
          <span style={{ display: 'block', marginTop: 1, fontFamily: MONO, fontSize: '0.625rem', color: t.muted }}>
            {savedCount} saved tournament{savedCount === 1 ? '' : 's'}
          </span>
        )}
      </span>
      <button type="button" className="play-action" aria-label={`Quick match: ${sport.name}`} onClick={() => navigate(`/${sport.id}/quick`)} style={actionStyle(t.green)}>
        Quick &#9656;
      </button>
      <button type="button" className="play-action" aria-label={`Tournament: ${sport.name}`} onClick={() => navigate(`/${sport.id}/tournament`)} style={actionStyle(t.text)}>
        Tournament
      </button>
    </div>
  );
}

SportRow.propTypes = {
  sport: sportShape.isRequired,
  savedCount: PropTypes.number,
  highlighted: PropTypes.bool,
  isLast: PropTypes.bool,
  navigate: PropTypes.func.isRequired,
};

function RowGroup({ label, sports, getCounts, requestedSportId, navigate, withRule }) {
  if (sports.length === 0) return null;
  return (
    <div style={withRule ? { borderTop: `1px solid ${t.divider}`, marginTop: 24, paddingTop: 20 } : { marginTop: 20 }}>
      <span style={{ ...eyebrowStyle, display: 'block', marginBottom: 2 }}>{label}</span>
      {sports.map((sport, i) => (
        <SportRow
          key={sport.id}
          sport={sport}
          savedCount={getCounts(sport.id)}
          highlighted={requestedSportId === sport.id}
          isLast={i === sports.length - 1}
          navigate={navigate}
        />
      ))}
    </div>
  );
}

RowGroup.propTypes = {
  label: PropTypes.string.isRequired,
  sports: PropTypes.arrayOf(sportShape).isRequired,
  getCounts: PropTypes.func.isRequired,
  requestedSportId: PropTypes.string,
  navigate: PropTypes.func.isRequired,
  withRule: PropTypes.bool,
};

export default function MonoSportHome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sportCategories = getSportsByCategory();
  const categoryKeys = getOrderedCategories(sportCategories);
  const requestedSportId = searchParams.get('sport')?.toLowerCase() ?? null;
  const [visible, setVisible] = useState(false);
  const [tournamentCounts, setTournamentCounts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const allSports = Object.values(sportCategories).flat();

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    const counts = {};
    allSports.forEach(sport => {
      const tournaments = loadSportTournaments(sport.storageKey);
      counts[sport.id] = tournaments.length;
    });
    setTournamentCounts(counts);
  }, []);

  useEffect(() => {
    if (!requestedSportId) return;
    requestAnimationFrame(() => {
      document.getElementById(`sport-row-${requestedSportId}`)?.scrollIntoView?.({ block: 'center' });
    });
  }, [requestedSportId]);

  const getCounts = (id) => tournamentCounts[id] || 0;

  const popular = prioritySports
    .map(id => allSports.find(sport => sport.id === id))
    .filter(Boolean);
  const categorySections = categoryKeys
    .map(category => ({
      category,
      sports: (sportCategories[category] ?? []).filter(sport => !prioritySports.includes(sport.id)),
    }))
    .filter(section => section.sports.length > 0);

  const trimmedSearch = searchQuery.trim().toLowerCase();
  const results = trimmedSearch
    ? allSports.filter(sport => sport.name.toLowerCase().includes(trimmedSearch))
    : null;

  return (
    <div className={`min-h-screen px-4 sm:px-6 py-6 sm:py-10 mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>
      <div className="mono-page-shell">
        <h1 className="mono-page-header text-xl font-semibold tracking-tight" style={{ color: t.text }}>
          Play
        </h1>

        <section aria-labelledby="choose-sport" className="mb-8">
          <h2 id="choose-sport" style={{ ...eyebrowStyle, margin: 0 }}>
            Choose sport
          </h2>
          <p style={{ margin: '4px 0 14px', fontSize: '0.75rem', color: t.muted }}>
            Quick starts scoring now. Tournament builds a bracket. Formats are picked during setup.
          </p>

          <input
            type="text"
            className="mono-input w-full"
            aria-label="Search sports"
            placeholder="Search sports..."
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
          />

          {results ? (
            <div style={{ marginTop: 20 }}>
              <span style={{ ...eyebrowStyle, display: 'block', marginBottom: 2 }}>
                {results.length} result{results.length === 1 ? '' : 's'}
              </span>
              {results.length > 0 ? (
                results.map((sport, i) => (
                  <SportRow
                    key={sport.id}
                    sport={sport}
                    savedCount={getCounts(sport.id)}
                    highlighted={false}
                    isLast={i === results.length - 1}
                    navigate={navigate}
                  />
                ))
              ) : (
                <p style={{ margin: '10px 0 0', fontSize: '0.8125rem', color: t.muted }}>No sports found.</p>
              )}
            </div>
          ) : (
            <>
              <RowGroup
                label="Popular"
                sports={popular}
                getCounts={getCounts}
                requestedSportId={requestedSportId}
                navigate={navigate}
              />
              {categorySections.map(({ category, sports }) => (
                <RowGroup
                  key={category}
                  label={category}
                  sports={sports}
                  getCounts={getCounts}
                  requestedSportId={requestedSportId}
                  navigate={navigate}
                  withRule
                />
              ))}
            </>
          )}
        </section>
      </div>

      {/* Micro-interactions — match the dashboard's action language */}
      <style>{`
        .play-action { border-radius: var(--radius); transition: background 150ms ease, transform 120ms ease; }
        .play-action:hover { background: var(--muted); transform: translateY(-1px); }
        .play-action:active { transform: translateY(0); background: var(--accent); }
      `}</style>
    </div>
  );
}
