import { useState, useEffect } from 'react';
import MonoSheet from '../components/MonoSheet.jsx';

// C6 generic picker — reused for BOTH the new batter (after a wicket) and the new
// bowler (at over end). Options are pre-shaped by the scorer:
//   { id, name, disabled?, reason? }
// so the picker stays dumb: it renders the list, disables flagged rows (bowler
// over-quota / consecutive over), and offers free-text entry when allowCustom.
export default function PlayerPickerSheet({
  open,
  onClose,
  title,
  options = [],
  onPick,
  allowCustom = true,
}) {
  const [custom, setCustom] = useState('');

  useEffect(() => {
    if (open) setCustom('');
  }, [open]);

  const submitCustom = () => {
    const name = custom.trim();
    if (!name) return;
    onPick({ id: name, name });
  };

  return (
    <MonoSheet open={open} onClose={onClose} title={title} ariaLabel={title || 'Pick player'}>
      <div className="pick-sheet" data-testid="player-picker">
        {options.length ? (
          <div className="pick-list">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                className="pick-opt"
                data-testid="pick-opt"
                disabled={!!o.disabled}
                onClick={() => onPick({ id: o.id, name: o.name ?? o.id })}
              >
                <span className="pick-name">{o.name ?? o.id}</span>
                {o.disabled && o.reason ? <span className="pick-reason">{o.reason}</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        {allowCustom ? (
          <div className="pick-custom">
            <input
              type="text"
              className="pick-input"
              placeholder="Add name"
              aria-label="Add name"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitCustom();
                }
              }}
            />
            <button type="button" className="pill" onClick={submitCustom}>Add</button>
          </div>
        ) : null}
      </div>
    </MonoSheet>
  );
}
