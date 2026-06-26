import { useState } from 'react';
import PropTypes from 'prop-types';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { getReporterId } from '../../../lib/live/reporterId';

// Signed-out report affordance for the public watch page (q7k / Apple 1.2).
// A spectator flags objectionable content by share token + reason; the backend
// dedups per reporter and auto-holds at a threshold. Report is best-effort — a
// failure is swallowed (never blocks the viewer) and the UI always confirms.

const REASONS = [
  { value: 'abuse', label: 'Abuse or harassment' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'sexual', label: 'Sexual content' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
];

export default function ReportMatch({ token }) {
  const reportMutation = useMutation(api.live.report);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (reason) => {
    setOpen(false);
    setDone(true);
    try {
      await reportMutation({ token, reason, reporterId: getReporterId() });
    } catch {
      // Best-effort: a failed report must never break the spectator view.
    }
  };

  if (done) {
    return (
      <p style={{ fontSize: '0.75rem', color: 'var(--se-color-ink-muted)', textAlign: 'center' }}>
        Thanks — this match has been reported for review.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mono-btn"
        style={{ fontSize: '0.75rem', color: 'var(--se-color-ink-muted)' }}
      >
        Report
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Report match"
          className="mono-sheet-backdrop"
          style={{
            position: 'fixed', inset: 0, zIndex: 60, display: 'flex',
            alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.45)',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            className="mono-card"
            style={{
              background: 'var(--background)', width: '100%', maxWidth: 440,
              borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--se-color-ink-muted)', marginBottom: 4 }}>
              Report this match
            </p>
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => submit(r.value)}
                className="mono-btn"
                style={{ width: '100%', textAlign: 'left' }}
              >
                {r.label}
              </button>
            ))}
            <button type="button" onClick={() => setOpen(false)} className="mono-btn" style={{ width: '100%' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

ReportMatch.propTypes = {
  token: PropTypes.string.isRequired,
};
