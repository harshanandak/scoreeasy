import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { getSportById } from '../../../models/sportRegistry';

export default function RouteRecoveryActions({
  eyebrow = 'Route recovery',
  title,
  message,
  sportId = null,
  primaryPath = null,
  primaryLabel = null,
}) {
  const navigate = useNavigate();
  const sport = sportId ? getSportById(sportId) : null;
  const quickPath = sport ? `/${sport.id}/quick` : null;
  const tournamentPath = sport ? `/${sport.id}/tournament` : null;
  const playPath = sport ? `/play?sport=${sport.id}` : '/play';
  const effectivePrimaryPath = primaryPath || tournamentPath || playPath;
  const effectivePrimaryLabel = primaryLabel || (sport ? `Back to ${sport.name} tournaments` : 'Play');

  const actions = [
    { label: effectivePrimaryLabel, path: effectivePrimaryPath, primary: true },
    sport ? { label: `Start ${sport.name} quick match`, path: quickPath, primary: false } : null,
    sport ? { label: 'Choose another sport', path: playPath, primary: false } : { label: 'Home', path: '/', primary: false },
  ].filter(Boolean);

  return (
    <div className="min-h-screen px-6 py-10 mono-transition mono-visible">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#888' }}>
          {eyebrow}
        </p>
        <h1 className="text-2xl font-bold font-mono mb-3" style={{ color: '#111' }}>
          {title}
        </h1>
        <p className="text-sm mb-6" style={{ color: '#666' }}>
          {message}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {actions.map((action) => (
            <button
              key={`${action.label}-${action.path}`}
              type="button"
              className={action.primary ? 'mono-btn-primary' : 'mono-btn'}
              style={{ minHeight: 44, padding: '10px 12px', fontSize: '0.875rem' }}
              onClick={() => navigate(action.path, { replace: true })}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

RouteRecoveryActions.propTypes = {
  eyebrow: PropTypes.string,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  sportId: PropTypes.string,
  primaryPath: PropTypes.string,
  primaryLabel: PropTypes.string,
};
