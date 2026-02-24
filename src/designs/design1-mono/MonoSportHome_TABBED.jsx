import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSportTournaments } from '../../utils/storage';
import { getSportsByCategory } from '../../models/sportRegistry';

export default function MonoSportHome() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [tournamentCounts, setTournamentCounts] = useState({});
  const [activeTab, setActiveTab] = useState('Racquet Sports');

  const SPORT_CATEGORIES = getSportsByCategory();
  const categoryKeys = Object.keys(SPORT_CATEGORIES);

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

  return (
    <div className={`min-h-screen px-6 py-10 mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <nav className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-sm bg-transparent border-none cursor-pointer font-swiss"
              style={{ color: '#888' }}
            >
              &larr;
            </button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#111' }}>
                Score Easy
              </h1>
              <p className="text-xs mt-1" style={{ color: '#888' }}>
                All sports
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/statistics')}
            className="text-sm bg-transparent border-none cursor-pointer font-swiss"
            style={{ color: '#888' }}
          >
            Statistics
          </button>
        </nav>

        {/* Tabs */}
        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-widest font-normal mb-6" style={{ color: '#888' }}>
            Choose sport
          </h2>

          {/* Tab Headers */}
          <div className="flex gap-3 mb-6 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
            {categoryKeys.map(category => (
              <button
                key={category}
                onClick={() => setActiveTab(category)}
                className={`text-xs px-4 py-2 whitespace-nowrap transition-all ${
                  activeTab === category
                    ? 'font-medium'
                    : 'font-normal'
                }`}
                style={{
                  color: activeTab === category ? '#0066ff' : '#888',
                  borderBottom: activeTab === category ? '2px solid #0066ff' : '2px solid transparent',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SPORT_CATEGORIES[activeTab].map(sport => (
                <div key={sport.id} className="mono-card" style={{ padding: 0 }}>
                  <div style={{ padding: '20px 24px' }}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">{sport.icon}</span>
                      <div className="flex-1">
                        <h3 className="text-base font-semibold mb-1" style={{ color: '#111' }}>
                          {sport.name}
                        </h3>
                        <p className="text-xs" style={{ color: '#888' }}>{sport.desc}</p>
                      </div>
                    </div>

                    {getCounts(sport.id) > 0 && (
                      <div className="text-xs mb-3" style={{ color: '#888' }}>
                        <span className="font-mono">{getCounts(sport.id)} saved</span> tournament{getCounts(sport.id) > 1 ? 's' : ''}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/${sport.id}/tournament`)}
                        className="mono-btn-primary flex-1"
                        style={{ fontSize: '0.8125rem', padding: '10px 16px' }}
                      >
                        <div className="flex flex-col items-center">
                          <span>Tournament</span>
                          <span className="text-xs font-normal opacity-80 mt-0.5">
                            2-8 teams
                          </span>
                        </div>
                      </button>
                      <button
                        onClick={() => navigate(`/${sport.id}/quick`)}
                        className="mono-btn flex-1"
                        style={{ fontSize: '0.8125rem', padding: '10px 16px' }}
                      >
                        <div className="flex flex-col items-center">
                          <span>Quick Match</span>
                          <span className="text-xs font-normal opacity-60 mt-0.5">
                            Instant
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <hr className="mono-divider" />

        {/* More games link */}
        <div className="mt-8 flex flex-col items-center" style={{ minHeight: '10vh' }}>
          <button
            onClick={() => navigate('/setup')}
            className="text-sm bg-transparent border-none cursor-pointer font-swiss"
            style={{ color: '#0066ff' }}
          >
            Other games (generic scorer)
          </button>
          <p className="text-xs mt-2" style={{ color: '#bbb' }}>
            Universal scorekeeper for any game
          </p>
        </div>
      </div>
    </div>
  );
}
