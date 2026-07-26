import { useState, useEffect } from 'react';
import MonoSheet from '../components/MonoSheet.jsx';

// C6 how-out sheet. Steps by dismissal, then hands back a bare wicket object
// { type, out, end?, completedRuns?, crossed? } — the scorer appends bowler +
// incoming + onFreeHit and applies it. Illegal dismissals are gated here (LBW
// under noLBW hidden; free hit exposes run-out only) rather than by the throw.

const BASE = [
  { type: 'bowled', label: 'Bowled' },
  { type: 'caught', label: 'Caught' },
  { type: 'lbw', label: 'LBW' },
  { type: 'run-out', label: 'Run out' },
  { type: 'stumped', label: 'Stumped' },
];

export default function WicketSheet({ open, onClose, inn, format, onConfirm }) {
  const [step, setStep] = useState('how'); // 'how' | 'cross' | 'runout'
  const [showMore, setShowMore] = useState(false);
  const [outEnd, setOutEnd] = useState('striker'); // run-out: which end is out
  const [completedRuns, setCompletedRuns] = useState(0);

  // Reset the flow every time the sheet opens.
  useEffect(() => {
    if (open) {
      setStep('how');
      setShowMore(false);
      setOutEnd('striker');
      setCompletedRuns(0);
    }
  }, [open]);

  const hr = format.houseRules || {};
  const freeHit = !!inn.freeHit;

  const how = freeHit
    ? [{ type: 'run-out', label: 'Run out' }]
    : BASE.filter((h) => !(h.type === 'lbw' && hr.noLBW));

  const pick = (type) => {
    if (type === 'caught') return setStep('cross');
    if (type === 'run-out') return setStep('runout');
    onConfirm({ type, out: inn.striker });
  };

  const confirmCaught = (crossed) => onConfirm({ type: 'caught', out: inn.striker, crossed });
  const confirmRunOut = () =>
    onConfirm({
      type: 'run-out',
      out: outEnd === 'striker' ? inn.striker : inn.nonStriker,
      end: outEnd === 'striker' ? 'striker' : 'non-striker',
      completedRuns,
    });

  return (
    <MonoSheet open={open} onClose={onClose} title="How out?" ariaLabel="Wicket">
      <div className="wk-sheet" data-testid="howout">
        {freeHit ? (
          <p className="wk-note" data-testid="freehit-note">FREE HIT — run out only</p>
        ) : null}

        {step === 'how' ? (
          <div className="wk-pills">
            {how.map((h) => (
              <button key={h.type} type="button" className="ho-pill" onClick={() => pick(h.type)}>
                {h.label}
              </button>
            ))}
            {!freeHit ? (
              showMore ? (
                <button type="button" className="ho-pill" onClick={() => pick('hit-wicket')}>
                  Hit-wicket
                </button>
              ) : (
                <button type="button" className="ho-pill wk-more" onClick={() => setShowMore(true)}>
                  More…
                </button>
              )
            ) : null}
          </div>
        ) : null}

        {step === 'cross' ? (
          <div className="wk-step" data-testid="wk-cross">
            <span className="wk-q">Did the batsmen cross?</span>
            <div className="wk-pills">
              <button type="button" className="ho-pill" onClick={() => confirmCaught(true)}>Yes</button>
              <button type="button" className="ho-pill" onClick={() => confirmCaught(false)}>No</button>
            </div>
          </div>
        ) : null}

        {step === 'runout' ? (
          <div className="wk-step" data-testid="wk-runout">
            <span className="wk-q">Who is out?</span>
            <div className="wk-pills">
              <button
                type="button"
                className={`ho-pill${outEnd === 'striker' ? ' on' : ''}`}
                aria-pressed={outEnd === 'striker'}
                onClick={() => setOutEnd('striker')}
              >
                Striker
              </button>
              <button
                type="button"
                className={`ho-pill${outEnd === 'non-striker' ? ' on' : ''}`}
                aria-pressed={outEnd === 'non-striker'}
                onClick={() => setOutEnd('non-striker')}
                disabled={inn.nonStriker == null}
              >
                Non-striker
              </button>
            </div>
            <span className="wk-q">Runs completed</span>
            <div className="wk-pills">
              {[0, 1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`ho-pill${completedRuns === n ? ' on' : ''}`}
                  aria-pressed={completedRuns === n}
                  onClick={() => setCompletedRuns(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <button type="button" className="pill wk-confirm" onClick={confirmRunOut}>
              Confirm run out
            </button>
          </div>
        ) : null}
      </div>
    </MonoSheet>
  );
}
