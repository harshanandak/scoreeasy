import { useNavigate } from 'react-router-dom';

export default function MonoMatchCardShowcase() {
  const navigate = useNavigate();

  // Sample match data
  const match = {
    id: 'match-1',
    team1: 'Ślepsk Suwałki',
    team2: 'Cuprum Stilon Gorzów',
    team1SetsWon: 3,
    team2SetsWon: 2,
    sets: [
      { score1: 25, score2: 23 },
      { score1: 23, score2: 25 },
      { score1: 25, score2: 22 },
      { score1: 22, score2: 25 },
      { score1: 15, score2: 13 },
    ],
    status: 'completed'
  };

  const matchWinner = match.team1SetsWon > match.team2SetsWon ? 'team1' : 'team2';
  const team1Color = matchWinner === 'team1' ? '#111' : '#888';
  const team2Color = matchWinner === 'team2' ? '#111' : '#888';

  return (
    <div className="min-h-screen px-6 py-10" style={{ background: '#fafafa' }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="text-sm mb-4 bg-transparent border-none cursor-pointer font-swiss"
            style={{ color: '#888' }}
          >
            ← Back
          </button>
          <h1 className="text-2xl font-medium mb-2">Match Card Design Variations</h1>
          <p className="text-sm" style={{ color: '#888' }}>
            Full card layout variations with different spacing, hierarchy, and visual approaches
          </p>
        </div>

        <div className="space-y-8">
          {/* Variation 1: Current Compact */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest font-medium" style={{ color: '#888' }}>
                Variation 1: Compact (Current)
              </span>
            </div>
            <div className="mono-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono" style={{ color: '#888' }}>
                    MATCH 1
                  </span>
                  <span className="mono-badge mono-badge-final">
                    Completed
                  </span>
                </div>
                <button
                  className="text-xs"
                  style={{ color: '#dc2626' }}
                >
                  Clear
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center mb-3">
                <div className="text-right">
                  <div className="font-medium" style={{ color: team1Color }}>
                    {match.team1}
                  </div>
                  <div className="text-2xl font-mono font-bold mt-1" style={{ color: team1Color }}>
                    {match.team1SetsWon}
                  </div>
                </div>
                <div className="text-center text-xs" style={{ color: '#888' }}>
                  vs
                </div>
                <div className="text-left">
                  <div className="font-medium" style={{ color: team2Color }}>
                    {match.team2}
                  </div>
                  <div className="text-2xl font-mono font-bold mt-1" style={{ color: team2Color }}>
                    {match.team2SetsWon}
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-1.5 flex-wrap mb-3">
                {match.sets.map((set, i) => {
                  const setWinner = set.score1 > set.score2 ? 'team1' : 'team2';
                  const isMatchWinnerSet = setWinner === matchWinner;
                  return (
                    <span
                      key={`v1-set-${i}-${set.score1}-${set.score2}`}
                      className="px-3 py-1.5 rounded text-sm font-mono"
                      style={{
                        background: isMatchWinnerSet ? '#dcfce7' : '#fee2e2',
                        color: '#111'
                      }}
                    >
                      <span style={{ fontWeight: set.score1 > set.score2 ? 'bold' : 'normal' }}>{set.score1}</span>
                      <span style={{ color: '#ccc', margin: '0 2px' }}>-</span>
                      <span style={{ fontWeight: set.score2 > set.score1 ? 'bold' : 'normal' }}>{set.score2}</span>
                    </span>
                  );
                })}
              </div>

              <button className="mono-btn w-full">
                Edit Score
              </button>
            </div>
          </div>

          {/* Variation 2: Spacious */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest font-medium" style={{ color: '#888' }}>
                Variation 2: Spacious (More Breathing Room)
              </span>
              <span className="text-xs px-2 py-1 rounded" style={{ background: '#dcfce7', color: '#0066ff' }}>
                Recommended
              </span>
            </div>
            <div className="mono-card p-5">
              {/* Header with match number and status */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#aaa' }}>
                  Match 1
                </span>
                <div className="flex items-center gap-2">
                  <span className="mono-badge mono-badge-final">
                    Completed
                  </span>
                  <button
                    className="text-xs opacity-50 hover:opacity-100 transition-opacity"
                    style={{ color: '#dc2626' }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Teams and scores */}
              <div className="grid grid-cols-3 gap-6 items-center mb-5">
                <div className="text-right">
                  <div className="text-base font-medium mb-1" style={{ color: team1Color }}>
                    {match.team1}
                  </div>
                  <div className="text-3xl font-mono font-bold" style={{ color: team1Color }}>
                    {match.team1SetsWon}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium" style={{ color: '#bbb' }}>vs</div>
                </div>
                <div className="text-left">
                  <div className="text-base font-medium mb-1" style={{ color: team2Color }}>
                    {match.team2}
                  </div>
                  <div className="text-3xl font-mono font-bold" style={{ color: team2Color }}>
                    {match.team2SetsWon}
                  </div>
                </div>
              </div>

              {/* Set scores */}
              <div className="flex justify-center gap-2 flex-wrap mb-5 py-3" style={{ borderTop: '1px solid #f5f5f5', borderBottom: '1px solid #f5f5f5' }}>
                {match.sets.map((set, i) => {
                  const setWinner = set.score1 > set.score2 ? 'team1' : 'team2';
                  const isMatchWinnerSet = setWinner === matchWinner;
                  return (
                    <span
                      key={`v2-set-${i}-${set.score1}-${set.score2}`}
                      className="px-3 py-1.5 rounded font-mono"
                      style={{
                        background: isMatchWinnerSet ? '#dcfce7' : '#fee2e2',
                        color: '#111',
                        fontSize: '0.875rem'
                      }}
                    >
                      <span style={{ fontWeight: set.score1 > set.score2 ? '600' : 'normal' }}>{set.score1}</span>
                      <span style={{ color: '#ccc', margin: '0 4px', fontWeight: '300' }}>-</span>
                      <span style={{ fontWeight: set.score2 > set.score1 ? '600' : 'normal' }}>{set.score2}</span>
                    </span>
                  );
                })}
              </div>

              {/* Action button */}
              <button className="mono-btn w-full">
                Edit Score
              </button>
            </div>
          </div>
          {/* Variation 3: Vertical Stacked */}
          <div>
            <div className="mb-3">
              <span className="text-xs uppercase tracking-widest font-medium" style={{ color: '#888' }}>
                Variation 3: Vertical Stacked
              </span>
            </div>
            <div className="mono-card p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#aaa' }}>
                  Match 1
                </span>
                <div className="flex items-center gap-2">
                  <span className="mono-badge mono-badge-final">
                    Completed
                  </span>
                  <button
                    className="text-xs opacity-50 hover:opacity-100 transition-opacity"
                    style={{ color: '#dc2626' }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Team 1 */}
              <div className="mb-3 pb-3" style={{ borderBottom: '1px solid #f5f5f5' }}>
                <div className="flex items-center justify-between">
                  <div className="text-base font-medium" style={{ color: team1Color }}>
                    {match.team1}
                  </div>
                  <div className="text-3xl font-mono font-bold" style={{ color: team1Color }}>
                    {match.team1SetsWon}
                  </div>
                </div>
              </div>

              {/* Team 2 */}
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <div className="text-base font-medium" style={{ color: team2Color }}>
                    {match.team2}
                  </div>
                  <div className="text-3xl font-mono font-bold" style={{ color: team2Color }}>
                    {match.team2SetsWon}
                  </div>
                </div>
              </div>

              {/* Set scores */}
              <div className="flex justify-center gap-2 flex-wrap mb-4 py-3" style={{ borderTop: '1px solid #f5f5f5', borderBottom: '1px solid #f5f5f5' }}>
                {match.sets.map((set, i) => {
                  const setWinner = set.score1 > set.score2 ? 'team1' : 'team2';
                  const isMatchWinnerSet = setWinner === matchWinner;
                  return (
                    <span
                      key={`v3-set-${i}-${set.score1}-${set.score2}`}
                      className="px-3 py-1.5 rounded font-mono"
                      style={{
                        background: isMatchWinnerSet ? '#dcfce7' : '#fee2e2',
                        color: '#111',
                        fontSize: '0.875rem'
                      }}
                    >
                      <span style={{ fontWeight: set.score1 > set.score2 ? '600' : 'normal' }}>{set.score1}</span>
                      <span style={{ color: '#ccc', margin: '0 4px', fontWeight: '300' }}>-</span>
                      <span style={{ fontWeight: set.score2 > set.score1 ? '600' : 'normal' }}>{set.score2}</span>
                    </span>
                  );
                })}
              </div>

              {/* Action button */}
              <button className="mono-btn w-full">
                Edit Score
              </button>
            </div>
          </div>

          {/* Variation 4: Minimal Header */}
          <div>
            <div className="mb-3">
              <span className="text-xs uppercase tracking-widest font-medium" style={{ color: '#888' }}>
                Variation 4: Minimal Header (No Match Number)
              </span>
            </div>
            <div className="mono-card p-5">
              {/* Header - minimal */}
              <div className="flex items-center justify-between mb-5">
                <span className="mono-badge mono-badge-final">
                  Completed
                </span>
                <button
                  className="text-xs opacity-50 hover:opacity-100 transition-opacity"
                  style={{ color: '#dc2626' }}
                >
                  Clear
                </button>
              </div>

              {/* Teams and scores */}
              <div className="grid grid-cols-3 gap-6 items-center mb-5">
                <div className="text-right">
                  <div className="text-base font-medium mb-1" style={{ color: team1Color }}>
                    {match.team1}
                  </div>
                  <div className="text-3xl font-mono font-bold" style={{ color: team1Color }}>
                    {match.team1SetsWon}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium" style={{ color: '#bbb' }}>vs</div>
                </div>
                <div className="text-left">
                  <div className="text-base font-medium mb-1" style={{ color: team2Color }}>
                    {match.team2}
                  </div>
                  <div className="text-3xl font-mono font-bold" style={{ color: team2Color }}>
                    {match.team2SetsWon}
                  </div>
                </div>
              </div>

              {/* Set scores */}
              <div className="flex justify-center gap-2 flex-wrap mb-5 py-3" style={{ borderTop: '1px solid #f5f5f5', borderBottom: '1px solid #f5f5f5' }}>
                {match.sets.map((set, i) => {
                  const setWinner = set.score1 > set.score2 ? 'team1' : 'team2';
                  const isMatchWinnerSet = setWinner === matchWinner;
                  return (
                    <span
                      key={`v4-set-${i}-${set.score1}-${set.score2}`}
                      className="px-3 py-1.5 rounded font-mono"
                      style={{
                        background: isMatchWinnerSet ? '#dcfce7' : '#fee2e2',
                        color: '#111',
                        fontSize: '0.875rem'
                      }}
                    >
                      <span style={{ fontWeight: set.score1 > set.score2 ? '600' : 'normal' }}>{set.score1}</span>
                      <span style={{ color: '#ccc', margin: '0 4px', fontWeight: '300' }}>-</span>
                      <span style={{ fontWeight: set.score2 > set.score1 ? '600' : 'normal' }}>{set.score2}</span>
                    </span>
                  );
                })}
              </div>

              {/* Action button */}
              <button className="mono-btn w-full">
                Edit Score
              </button>
            </div>
          </div>

          {/* Variation 5: Score Emphasis */}
          <div>
            <div className="mb-3">
              <span className="text-xs uppercase tracking-widest font-medium" style={{ color: '#888' }}>
                Variation 5: Score Emphasis (Larger Numbers)
              </span>
            </div>
            <div className="mono-card p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#aaa' }}>
                  Match 1
                </span>
                <div className="flex items-center gap-2">
                  <span className="mono-badge mono-badge-final">
                    Completed
                  </span>
                  <button
                    className="text-xs opacity-50 hover:opacity-100 transition-opacity"
                    style={{ color: '#dc2626' }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Teams and scores - larger scores */}
              <div className="grid grid-cols-3 gap-6 items-center mb-5">
                <div className="text-right">
                  <div className="text-sm font-medium mb-2" style={{ color: team1Color }}>
                    {match.team1}
                  </div>
                  <div className="text-5xl font-mono font-bold" style={{ color: team1Color }}>
                    {match.team1SetsWon}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium" style={{ color: '#bbb' }}>vs</div>
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium mb-2" style={{ color: team2Color }}>
                    {match.team2}
                  </div>
                  <div className="text-5xl font-mono font-bold" style={{ color: team2Color }}>
                    {match.team2SetsWon}
                  </div>
                </div>
              </div>

              {/* Set scores */}
              <div className="flex justify-center gap-2 flex-wrap mb-5 py-3" style={{ borderTop: '1px solid #f5f5f5', borderBottom: '1px solid #f5f5f5' }}>
                {match.sets.map((set, i) => {
                  const setWinner = set.score1 > set.score2 ? 'team1' : 'team2';
                  const isMatchWinnerSet = setWinner === matchWinner;
                  return (
                    <span
                      key={`v5-set-${i}-${set.score1}-${set.score2}`}
                      className="px-3 py-1.5 rounded font-mono"
                      style={{
                        background: isMatchWinnerSet ? '#dcfce7' : '#fee2e2',
                        color: '#111',
                        fontSize: '0.875rem'
                      }}
                    >
                      <span style={{ fontWeight: set.score1 > set.score2 ? '600' : 'normal' }}>{set.score1}</span>
                      <span style={{ color: '#ccc', margin: '0 4px', fontWeight: '300' }}>-</span>
                      <span style={{ fontWeight: set.score2 > set.score1 ? '600' : 'normal' }}>{set.score2}</span>
                    </span>
                  );
                })}
              </div>

              {/* Action button */}
              <button className="mono-btn w-full">
                Edit Score
              </button>
            </div>
          </div>

          {/* Variation 6: Borderless Sets */}
          <div>
            <div className="mb-3">
              <span className="text-xs uppercase tracking-widest font-medium" style={{ color: '#888' }}>
                Variation 6: Borderless Sets (No Separators)
              </span>
            </div>
            <div className="mono-card p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#aaa' }}>
                  Match 1
                </span>
                <div className="flex items-center gap-2">
                  <span className="mono-badge mono-badge-final">
                    Completed
                  </span>
                  <button
                    className="text-xs opacity-50 hover:opacity-100 transition-opacity"
                    style={{ color: '#dc2626' }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Teams and scores */}
              <div className="grid grid-cols-3 gap-6 items-center mb-5">
                <div className="text-right">
                  <div className="text-base font-medium mb-1" style={{ color: team1Color }}>
                    {match.team1}
                  </div>
                  <div className="text-3xl font-mono font-bold" style={{ color: team1Color }}>
                    {match.team1SetsWon}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium" style={{ color: '#bbb' }}>vs</div>
                </div>
                <div className="text-left">
                  <div className="text-base font-medium mb-1" style={{ color: team2Color }}>
                    {match.team2}
                  </div>
                  <div className="text-3xl font-mono font-bold" style={{ color: team2Color }}>
                    {match.team2SetsWon}
                  </div>
                </div>
              </div>

              {/* Set scores - no borders */}
              <div className="flex justify-center gap-2 flex-wrap mb-5">
                {match.sets.map((set, i) => {
                  const setWinner = set.score1 > set.score2 ? 'team1' : 'team2';
                  const isMatchWinnerSet = setWinner === matchWinner;
                  return (
                    <span
                      key={`v6-set-${i}-${set.score1}-${set.score2}`}
                      className="px-3 py-1.5 rounded font-mono"
                      style={{
                        background: isMatchWinnerSet ? '#dcfce7' : '#fee2e2',
                        color: '#111',
                        fontSize: '0.875rem'
                      }}
                    >
                      <span style={{ fontWeight: set.score1 > set.score2 ? '600' : 'normal' }}>{set.score1}</span>
                      <span style={{ color: '#ccc', margin: '0 4px', fontWeight: '300' }}>-</span>
                      <span style={{ fontWeight: set.score2 > set.score1 ? '600' : 'normal' }}>{set.score2}</span>
                    </span>
                  );
                })}
              </div>

              {/* Action button */}
              <button className="mono-btn w-full">
                Edit Score
              </button>
            </div>
          </div>
        </div>

        {/* Comparison Guide */}
        <div className="mt-8 mono-card p-6">
          <h2 className="text-lg font-medium mb-4">Design Comparison</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2" style={{ color: '#0066ff' }}>Variation 1: Compact</h3>
              <p className="text-sm" style={{ color: '#666' }}>Current design. Minimal padding (p-4), smaller scores (text-2xl). Good for dense information.</p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2" style={{ color: '#0066ff' }}>Variation 2: Spacious ⭐ Recommended</h3>
              <p className="text-sm" style={{ color: '#666' }}>More breathing room (p-5), larger scores (text-3xl), subtle borders. Better hierarchy and scanability.</p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2" style={{ color: '#0066ff' }}>Variation 3: Vertical Stacked</h3>
              <p className="text-sm" style={{ color: '#666' }}>Team scores stacked vertically with dividers. Good for long team names or mobile screens.</p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2" style={{ color: '#0066ff' }}>Variation 4: Minimal Header</h3>
              <p className="text-sm" style={{ color: '#666' }}>No match number label. Ultra-clean for when match order is already clear from context.</p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2" style={{ color: '#0066ff' }}>Variation 5: Score Emphasis</h3>
              <p className="text-sm" style={{ color: '#666' }}>Massive scores (text-5xl). Best when final score is the most important information.</p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2" style={{ color: '#0066ff' }}>Variation 6: Borderless Sets</h3>
              <p className="text-sm" style={{ color: '#666' }}>Set scores without top/bottom borders. Cleaner look with less visual division.</p>
            </div>
          </div>
          <p className="text-sm mt-4" style={{ color: '#888' }}>
            Choose your favorite and I'll apply it to all tournament match cards!
          </p>
        </div>
      </div>
    </div>
  );
}
