import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import { deriveIdentityColour, normaliseHex } from '../../lib/teamColour';
import './kit/setup.css';

// Kit colours a scorer is likely to need, plus a native custom picker. Any colour is safe: the
// colour engine normalises it for contrast before it reaches the board. The first QUICK_COUNT are
// the quick row; the rest and the custom colour sit behind "More colours".
export const TEAM_SWATCHES = Object.freeze([
  { name: 'Red', hex: '#d62828' },
  { name: 'Blue', hex: '#1d4ed8' },
  { name: 'Yellow', hex: '#facc15' },
  { name: 'Green', hex: '#16a34a' },
  { name: 'Black', hex: '#111111' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Purple', hex: '#6d28d9' },
  { name: 'Sky', hex: '#38bdf8' },
  { name: 'Navy', hex: '#1e2a5a' },
  { name: 'Maroon', hex: '#7a1020' },
]);

export const QUICK_COUNT = 5;

// A swatch shows what the board will paint: the engine's core for that kit colour, with the
// engine's on-colour for the check (gated >= 4.6:1 on deep fills, 6.5:1 on bright ones).
const engineCache = new Map();
function engineOf(hex) {
  if (!engineCache.has(hex)) engineCache.set(hex, deriveIdentityColour(hex));
  return engineCache.get(hex);
}

function swatchVars(hex) {
  const t = engineOf(hex);
  return { '--kit-sw': t.core, '--kit-sw-on': t.on };
}

function Check() {
  return (
    <svg className="kit-sw-check" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function Plus({ open }) {
  return (
    <svg className="kit-sw-plus" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {open ? <path d="M6 15l6-6 6 6" /> : <path d="M12 5v14M5 12h14" />}
    </svg>
  );
}
Plus.propTypes = { open: PropTypes.bool };

/**
 * Team colour choice: a group of toggle swatches (48px; the selected one carries a check, an ink
 * ring and aria-pressed, so colour is never the only signal). Selection is styled apart from focus:
 * every swatch is a plain button in the tab order and takes the app's global ink focus ring.
 * Only plain hex values ever reach onChange.
 */
export default function TeamColourPicker({ label, value, onChange }) {
  const current = normaliseHex(value);
  const checkedIndex = TEAM_SWATCHES.findIndex((s) => s.hex === current);
  const isCustom = checkedIndex === -1 && Boolean(current);
  const selectionInMore = checkedIndex >= QUICK_COUNT || isCustom;
  const [open, setOpen] = useState(selectionInMore);
  // The native colour input is invisible (opacity 0), so its focus is drawn on the control around it.
  const [customFocused, setCustomFocused] = useState(false);
  const panelId = useId();

  const onCustom = (event) => {
    const hex = normaliseHex(event.target.value);
    if (hex) onChange(hex);
  };

  const swatch = (s, i) => {
    const pressed = i === checkedIndex;
    return (
      <button
        key={s.hex}
        type="button"
        className="kit-sw"
        aria-pressed={pressed ? 'true' : 'false'}
        aria-label={s.name}
        title={s.name}
        onClick={() => onChange(s.hex)}
        style={swatchVars(s.hex)}
      >
        {pressed && <Check />}
      </button>
    );
  };

  const selectedName = isCustom ? 'custom colour' : TEAM_SWATCHES[checkedIndex]?.name;
  const moreLabel = selectionInMore && !open
    ? `More colours for ${label}, ${selectedName} selected`
    : `More colours for ${label}`;

  return (
    <div className="kit-picker" role="group" aria-label={label}>
      <div className="kit-sw-row">
        {TEAM_SWATCHES.slice(0, QUICK_COUNT).map((s, i) => swatch(s, i))}
        <button
          type="button"
          className={`kit-sw kit-sw-more${selectionInMore && !open ? ' is-holding' : ''}`}
          aria-expanded={open ? 'true' : 'false'}
          aria-controls={panelId}
          aria-label={moreLabel}
          title="More colours"
          onClick={() => setOpen((o) => !o)}
          style={selectionInMore && !open ? swatchVars(current) : undefined}
        >
          {selectionInMore && !open ? <Check /> : <Plus open={open} />}
        </button>
      </div>
      <div id={panelId} hidden={!open} className="kit-sw-more-panel">
        {open && (
          <>
            <div className="kit-sw-row">
              {TEAM_SWATCHES.slice(QUICK_COUNT).map((s, i) => swatch(s, i + QUICK_COUNT))}
            </div>
            <label className={`kit-sw-custom${customFocused ? ' is-focused' : ''}${isCustom ? ' is-selected' : ''}`}>
              <span
                className={`kit-sw kit-sw-dot${isCustom ? '' : ' kit-sw-more'}`}
                style={isCustom ? swatchVars(current) : undefined}
                aria-hidden="true"
              >
                {isCustom ? <Check /> : <Plus open={false} />}
              </span>
              <span className="kit-sw-custom-text">{isCustom ? 'Custom colour (selected)' : 'Custom colour'}</span>
              <input
                type="color"
                aria-label={isCustom ? `Custom colour for ${label} (selected)` : `Custom colour for ${label}`}
                value={current ?? TEAM_SWATCHES[0].hex}
                onChange={onCustom}
                onFocus={() => setCustomFocused(true)}
                onBlur={() => setCustomFocused(false)}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

TeamColourPicker.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};
