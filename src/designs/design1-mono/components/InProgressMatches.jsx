import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { loadInProgressMatches } from '../../../utils/appEntry';
import { deleteInProgressMatch, inProgressSummary } from '../../../utils/inProgressMatch';
import { getSportById } from '../../../models/sportRegistry';
import { AppScoringConfirmDialog } from './AppScoringPrompt';
import { KitSection, SportBadge } from '../kit/KitParts';
import { relativeDay } from '../kit/dates';
import './inProgressMatches.css';

/* `onChange` lets a host screen (Home) recount after the list re-reads or a row is deleted. */
export default function InProgressMatches({ onChange = undefined }) {
  const navigate = useNavigate();
  const [matches, setMatches] = useState(loadInProgressMatches);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const refresh = () => { setMatches(loadInProgressMatches()); onChange?.(); };
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh); };
  }, [onChange]);
  if (!matches.length) return null;
  const confirmDelete = () => {
    if (!deleteInProgressMatch(pending.match)) {
      setError('Could not delete this match. Please try again.');
      return;
    }
    setPending(null);
    setError('');
    setMatches(loadInProgressMatches());
    onChange?.();
  };
  return <section aria-labelledby="in-progress-matches-title">
    <KitSection id="in-progress-matches-title" title="In progress" />
    <div className="kit-list">
      {matches.map(match => {
        const summary = inProgressSummary(match);
        const sport = getSportById(match.sport)?.name || match.sport;
        const lastPlayed = summary.timestamp ? relativeDay(new Date(summary.timestamp).getTime()) : '';
        return <article className="kit-row kept-match" key={match.entryPath}>
          <SportBadge sportId={match.sport} />
          <div className="kit-row-text">
            {summary.scoreParts ? <span className="kit-row-title kept-cricket-score" aria-label={summary.score}>
              {summary.scoreParts.map((part, index) => <span className="kept-cricket-innings" key={index}>
                <span className="kept-cricket-team" title={part.team}>{part.team}</span>{' '}
                <span className="kept-cricket-value">{part.value}</span>
              </span>)}
            </span> : <span className="kit-row-title">{summary.title}</span>}
            <span className="kit-row-sub">{sport} · {summary.detail}</span>
            {lastPlayed && <span className="kit-row-sub">Last played {lastPlayed}</span>}
          </div>
          {summary.score && !summary.scoreParts && <span className="kit-row-score">{summary.score}</span>}
          <div className="kept-match-actions">
            <button type="button" className="se-ctl" data-resume-path={match.entryPath} aria-label={`Resume ${sport}: ${summary.title}`} onClick={() => navigate(match.entryPath)}>Resume</button>
            {match.kind !== 'tournament' && <button type="button" className="se-ctl kept-match-delete" aria-label={`Delete ${sport}: ${summary.title}`} onClick={() => setPending({ match, summary })}>Delete</button>}
          </div>
        </article>;
      })}
    </div>
    {error && <p role="alert">{error}</p>}
    {pending && <AppScoringConfirmDialog title="Delete match?" message={`Delete ${pending.summary.title}${pending.summary.score ? `, ${pending.summary.score}` : ''}? This can't be undone.`} confirmLabel="Delete" cancelLabel="Keep match" tone="danger" onCancel={() => setPending(null)} onConfirm={confirmDelete} />}
  </section>;
}
InProgressMatches.propTypes = { onChange: PropTypes.func };
