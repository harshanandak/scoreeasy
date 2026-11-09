import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { loadInProgressMatches } from '../../../utils/appEntry';
import { deleteInProgressMatch, discardMatchPrompt, inProgressSummary } from '../../../utils/inProgressMatch';
import { getSportById } from '../../../models/sportRegistry';
import { AppScoringConfirmDialog } from './AppScoringPrompt';
import { KitSection, SportBadge } from '../kit/KitParts';
import { relativeDay } from '../kit/dates';
import './inProgressMatches.css';

/* `onChange` lets a host screen (Home) recount after the list re-reads (a match finished or discarded
   on its board). A healthy row only resumes: Discard lives on the scoring board, behind its own confirm.
   A row that cannot open (see inProgressProblem) says so and offers Remove behind the same confirm. */
export default function InProgressMatches({ onChange = undefined }) {
  const navigate = useNavigate();
  const [matches, setMatches] = useState(loadInProgressMatches);
  const [removing, setRemoving] = useState(null);
  useEffect(() => {
    const refresh = () => { setMatches(loadInProgressMatches()); onChange?.(); };
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh); };
  }, [onChange]);
  const refresh = () => { setMatches(loadInProgressMatches()); onChange?.(); };
  const remove = () => {
    const target = removing;
    setRemoving(null);
    if (target) { deleteInProgressMatch(target); refresh(); }
  };
  if (!matches.length) return null;
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
            <span className="kit-row-sub">{sport} · {match.openProblem ? "Can't open this match" : summary.detail}</span>
            {lastPlayed && <span className="kit-row-sub">Last played {lastPlayed}</span>}
          </div>
          <div className="kept-match-trail">
            {summary.score && !summary.scoreParts && <span className="kit-row-score">{summary.score}</span>}
            {match.openProblem
              ? <button type="button" className="se-ctl" aria-label={`Remove ${sport}: ${summary.title}`} onClick={() => setRemoving(match)}>Remove</button>
              : <button type="button" className="se-ctl" data-resume-path={match.entryPath} aria-label={`Resume ${sport}: ${summary.title}`} onClick={() => navigate(match.entryPath)}>Resume</button>}
          </div>
        </article>;
      })}
    </div>
    {removing && <AppScoringConfirmDialog {...discardMatchPrompt(removing)} onCancel={() => setRemoving(null)} onConfirm={remove} />}
  </section>;
}
InProgressMatches.propTypes = { onChange: PropTypes.func };
