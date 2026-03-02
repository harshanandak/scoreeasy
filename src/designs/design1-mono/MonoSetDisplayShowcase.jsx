import { useNavigate } from 'react-router-dom';

export default function MonoSetDisplayShowcase() {
  const navigate = useNavigate();

  // Sample match data - 5-set thriller where both teams win sets
  const match = {
    team1: 'Ślepsk Suwałki',
    team2: 'Cuprum Stilon Gorzów',
    team1SetsWon: 3,
    team2SetsWon: 2,
    sets: [
      { score1: 25, score2: 23 }, // Team 1 wins
      { score1: 23, score2: 25 }, // Team 2 wins
      { score1: 25, score2: 22 }, // Team 1 wins
      { score1: 22, score2: 25 }, // Team 2 wins
      { score1: 15, score2: 13 }, // Team 1 wins (decider)
    ],
  };

  // Determine match winner for better styling
  const matchWinner = match.team1SetsWon > match.team2SetsWon ? 'team1' : 'team2';

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
          <h1 className="text-2xl font-medium mb-2">Set Display Design Variations</h1>
          <p className="text-sm" style={{ color: '#888' }}>
            Blends of Option 1B (subtle backgrounds) + 1C (bold winner emphasis)
          </p>
        </div>

        {/* Design Options */}
        <div className="space-y-8">
          {/* Variation 1: Subtle backgrounds + Bold winner */}
          <div className="mono-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest font-medium" style={{ color: '#888' }}>
                Variation 1: Match winner's sets (green) vs loser's sets (red)
              </span>
              <span className="text-xs px-2 py-1 rounded" style={{ background: '#dcfce7', color: '#0066ff' }}>
                Recommended
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="text-right">
                <div className="font-medium" style={{ color: matchWinner === 'team1' ? '#111' : '#888' }}>
                  {match.team1}
                </div>
                <div className="text-3xl font-mono font-bold mt-2" style={{ color: matchWinner === 'team1' ? '#111' : '#888' }}>
                  {match.team1SetsWon}
                </div>
              </div>
              <div className="text-center text-xs" style={{ color: '#888' }}>vs</div>
              <div className="text-left">
                <div className="font-medium" style={{ color: matchWinner === 'team2' ? '#111' : '#888' }}>
                  {match.team2}
                </div>
                <div className="text-3xl font-mono font-bold mt-2" style={{ color: matchWinner === 'team2' ? '#111' : '#888' }}>
                  {match.team2SetsWon}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-1.5 flex-wrap">
              {match.sets.map((s, i) => {
                const setWinner = s.score1 > s.score2 ? 'team1' : 'team2';
                const isMatchWinnerSet = setWinner === matchWinner;
                return (
                  <span
                    key={`v1-set-${i}-${s.score1}-${s.score2}`}
                    className="px-3 py-1.5 rounded text-sm font-mono"
                    style={{
                      background: isMatchWinnerSet ? '#dcfce7' : '#fee2e2',
                      color: '#111'
                    }}
                  >
                    <span style={{ fontWeight: s.score1 > s.score2 ? 'bold' : 'normal' }}>{s.score1}</span>
                    <span style={{ color: '#ccc', margin: '0 2px' }}>-</span>
                    <span style={{ fontWeight: s.score2 > s.score1 ? 'bold' : 'normal' }}>{s.score2}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Variation 6: Very subtle + Size emphasis */}
          <div className="mono-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest font-medium" style={{ color: '#888' }}>
                Variation 6: Ultra-subtle backgrounds (match winner darker)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="text-right">
                <div className="font-medium" style={{ color: matchWinner === 'team1' ? '#111' : '#888' }}>
                  {match.team1}
                </div>
                <div className="text-3xl font-mono font-bold mt-2" style={{ color: matchWinner === 'team1' ? '#111' : '#888' }}>
                  {match.team1SetsWon}
                </div>
              </div>
              <div className="text-center text-xs" style={{ color: '#888' }}>vs</div>
              <div className="text-left">
                <div className="font-medium" style={{ color: matchWinner === 'team2' ? '#111' : '#888' }}>
                  {match.team2}
                </div>
                <div className="text-3xl font-mono font-bold mt-2" style={{ color: matchWinner === 'team2' ? '#111' : '#888' }}>
                  {match.team2SetsWon}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-1.5 flex-wrap">
              {match.sets.map((s, i) => {
                const setWinner = s.score1 > s.score2 ? 'team1' : 'team2';
                const isMatchWinnerSet = setWinner === matchWinner;
                return (
                  <span
                    key={`v6-set-${i}-${s.score1}-${s.score2}`}
                    className="px-3 py-1.5 rounded font-mono"
                    style={{
                      background: isMatchWinnerSet ? 'rgba(5, 150, 105, 0.15)' : 'rgba(220, 38, 38, 0.15)',
                      color: '#111'
                    }}
                  >
                    <span style={{ fontWeight: s.score1 > s.score2 ? 'bold' : 'normal', fontSize: s.score1 > s.score2 ? '0.9375rem' : '0.875rem' }}>
                      {s.score1}
                    </span>
                    <span style={{ color: '#ddd', margin: '0 2px', fontSize: '0.75rem' }}>-</span>
                    <span style={{ fontWeight: s.score2 > s.score1 ? 'bold' : 'normal', fontSize: s.score2 > s.score1 ? '0.9375rem' : '0.875rem' }}>
                      {s.score2}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Variation 7: Gradient backgrounds */}
          <div className="mono-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest font-medium" style={{ color: '#888' }}>
                Variation 7: Green gradient (winner) vs red gradient (loser)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="text-right">
                <div className="font-medium" style={{ color: matchWinner === 'team1' ? '#111' : '#888' }}>
                  {match.team1}
                </div>
                <div className="text-3xl font-mono font-bold mt-2" style={{ color: matchWinner === 'team1' ? '#111' : '#888' }}>
                  {match.team1SetsWon}
                </div>
              </div>
              <div className="text-center text-xs" style={{ color: '#888' }}>vs</div>
              <div className="text-left">
                <div className="font-medium" style={{ color: matchWinner === 'team2' ? '#111' : '#888' }}>
                  {match.team2}
                </div>
                <div className="text-3xl font-mono font-bold mt-2" style={{ color: matchWinner === 'team2' ? '#111' : '#888' }}>
                  {match.team2SetsWon}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-1.5 flex-wrap">
              {match.sets.map((s, i) => {
                const setWinner = s.score1 > s.score2 ? 'team1' : 'team2';
                const isMatchWinnerSet = setWinner === matchWinner;
                return (
                  <span
                    key={`v7-set-${i}-${s.score1}-${s.score2}`}
                    className="px-3 py-1.5 rounded text-sm font-mono"
                    style={{
                      background: isMatchWinnerSet
                        ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)'
                        : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                      color: '#111'
                    }}
                  >
                    <span style={{ fontWeight: s.score1 > s.score2 ? 'bold' : 'normal' }}>{s.score1}</span>
                    <span style={{ color: '#ccc', margin: '0 2px' }}>-</span>
                    <span style={{ fontWeight: s.score2 > s.score1 ? 'bold' : 'normal' }}>{s.score2}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Variation 8: Border-only (minimal) */}
          <div className="mono-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest font-medium" style={{ color: '#888' }}>
                Variation 8: Border-only minimal (green/red borders)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="text-right">
                <div className="font-medium" style={{ color: matchWinner === 'team1' ? '#111' : '#888' }}>
                  {match.team1}
                </div>
                <div className="text-3xl font-mono font-bold mt-2" style={{ color: matchWinner === 'team1' ? '#111' : '#888' }}>
                  {match.team1SetsWon}
                </div>
              </div>
              <div className="text-center text-xs" style={{ color: '#888' }}>vs</div>
              <div className="text-left">
                <div className="font-medium" style={{ color: matchWinner === 'team2' ? '#111' : '#888' }}>
                  {match.team2}
                </div>
                <div className="text-3xl font-mono font-bold mt-2" style={{ color: matchWinner === 'team2' ? '#111' : '#888' }}>
                  {match.team2SetsWon}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-1.5 flex-wrap">
              {match.sets.map((s, i) => {
                const setWinner = s.score1 > s.score2 ? 'team1' : 'team2';
                const isMatchWinnerSet = setWinner === matchWinner;
                return (
                  <span
                    key={`v8-set-${i}-${s.score1}-${s.score2}`}
                    className="px-3 py-1.5 rounded text-sm font-mono"
                    style={{
                      background: '#fafafa',
                      border: `2px solid ${isMatchWinnerSet ? '#10b981' : '#ef4444'}`,
                      color: '#111'
                    }}
                  >
                    <span style={{ fontWeight: s.score1 > s.score2 ? 'bold' : 'normal' }}>{s.score1}</span>
                    <span style={{ color: '#ccc', margin: '0 2px' }}>-</span>
                    <span style={{ fontWeight: s.score2 > s.score1 ? 'bold' : 'normal' }}>{s.score2}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Variation 9: Monochrome intensity */}
          <div className="mono-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest font-medium" style={{ color: '#888' }}>
                Variation 9: Monochrome (darker = winner, lighter = loser)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="text-right">
                <div className="font-medium" style={{ color: matchWinner === 'team1' ? '#111' : '#888' }}>
                  {match.team1}
                </div>
                <div className="text-3xl font-mono font-bold mt-2" style={{ color: matchWinner === 'team1' ? '#111' : '#888' }}>
                  {match.team1SetsWon}
                </div>
              </div>
              <div className="text-center text-xs" style={{ color: '#888' }}>vs</div>
              <div className="text-left">
                <div className="font-medium" style={{ color: matchWinner === 'team2' ? '#111' : '#888' }}>
                  {match.team2}
                </div>
                <div className="text-3xl font-mono font-bold mt-2" style={{ color: matchWinner === 'team2' ? '#111' : '#888' }}>
                  {match.team2SetsWon}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-1.5 flex-wrap">
              {match.sets.map((s, i) => {
                const setWinner = s.score1 > s.score2 ? 'team1' : 'team2';
                const isMatchWinnerSet = setWinner === matchWinner;
                return (
                  <span
                    key={`v9-set-${i}-${s.score1}-${s.score2}`}
                    className="px-3 py-1.5 rounded text-sm font-mono"
                    style={{
                      background: isMatchWinnerSet ? '#e5e5e5' : '#f5f5f5',
                      color: '#111',
                      fontWeight: isMatchWinnerSet ? '600' : 'normal'
                    }}
                  >
                    <span style={{ fontWeight: s.score1 > s.score2 ? 'bold' : 'normal' }}>{s.score1}</span>
                    <span style={{ color: '#ccc', margin: '0 2px' }}>-</span>
                    <span style={{ fontWeight: s.score2 > s.score1 ? 'bold' : 'normal' }}>{s.score2}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Variation 10: Blue accent (Mono brand color) */}
          <div className="mono-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest font-medium" style={{ color: '#888' }}>
                Variation 10: Blue accent for winner (Mono brand color)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="text-right">
                <div className="font-medium" style={{ color: matchWinner === 'team1' ? '#111' : '#888' }}>
                  {match.team1}
                </div>
                <div className="text-3xl font-mono font-bold mt-2" style={{ color: matchWinner === 'team1' ? '#111' : '#888' }}>
                  {match.team1SetsWon}
                </div>
              </div>
              <div className="text-center text-xs" style={{ color: '#888' }}>vs</div>
              <div className="text-left">
                <div className="font-medium" style={{ color: matchWinner === 'team2' ? '#111' : '#888' }}>
                  {match.team2}
                </div>
                <div className="text-3xl font-mono font-bold mt-2" style={{ color: matchWinner === 'team2' ? '#111' : '#888' }}>
                  {match.team2SetsWon}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-1.5 flex-wrap">
              {match.sets.map((s, i) => {
                const setWinner = s.score1 > s.score2 ? 'team1' : 'team2';
                const isMatchWinnerSet = setWinner === matchWinner;
                return (
                  <span
                    key={`v10-set-${i}-${s.score1}-${s.score2}`}
                    className="px-3 py-1.5 rounded text-sm font-mono"
                    style={{
                      background: isMatchWinnerSet ? '#dcfce7' : '#f5f5f5',
                      color: isMatchWinnerSet ? '#0066ff' : '#888',
                      fontWeight: isMatchWinnerSet ? '600' : 'normal'
                    }}
                  >
                    <span style={{ fontWeight: s.score1 > s.score2 ? 'bold' : 'normal' }}>{s.score1}</span>
                    <span style={{ color: '#ccc', margin: '0 2px' }}>-</span>
                    <span style={{ fontWeight: s.score2 > s.score1 ? 'bold' : 'normal' }}>{s.score2}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Variation 11: No color coding (pure minimal) */}
          <div className="mono-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest font-medium" style={{ color: '#888' }}>
                Variation 11: Pure minimal (no color coding, weight only)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="text-right">
                <div className="font-medium" style={{ color: matchWinner === 'team1' ? '#111' : '#888' }}>
                  {match.team1}
                </div>
                <div className="text-3xl font-mono font-bold mt-2" style={{ color: matchWinner === 'team1' ? '#111' : '#888' }}>
                  {match.team1SetsWon}
                </div>
              </div>
              <div className="text-center text-xs" style={{ color: '#888' }}>vs</div>
              <div className="text-left">
                <div className="font-medium" style={{ color: matchWinner === 'team2' ? '#111' : '#888' }}>
                  {match.team2}
                </div>
                <div className="text-3xl font-mono font-bold mt-2" style={{ color: matchWinner === 'team2' ? '#111' : '#888' }}>
                  {match.team2SetsWon}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-1.5 flex-wrap">
              {match.sets.map((s, i) => {
                return (
                  <span
                    key={`v11-set-${i}-${s.score1}-${s.score2}`}
                    className="px-3 py-1.5 rounded text-sm font-mono"
                    style={{
                      background: '#f5f5f5',
                      color: '#111'
                    }}
                  >
                    <span style={{ fontWeight: s.score1 > s.score2 ? 'bold' : 'normal' }}>{s.score1}</span>
                    <span style={{ color: '#ccc', margin: '0 2px' }}>-</span>
                    <span style={{ fontWeight: s.score2 > s.score1 ? 'bold' : 'normal' }}>{s.score2}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom note */}
        <div className="mt-8 p-4 rounded" style={{ background: '#f5f5f5', border: '1px solid #eee' }}>
          <p className="text-sm mb-2" style={{ color: '#666' }}>
            <strong>Match Context:</strong> {match.team1} wins 3-2 (sets 1, 3, 5) · {match.team2} wins sets 2, 4
          </p>
          <p className="text-sm" style={{ color: '#666' }}>
            <strong>Design approach:</strong> Green styling for match winner's sets · Red styling for match loser's sets · Bold emphasis on winning score within each set
          </p>
          <p className="text-sm mt-2" style={{ color: '#666' }}>
            Choose your favorite design and I'll apply it to all tournament matches!
          </p>
        </div>
      </div>
    </div>
  );
}
