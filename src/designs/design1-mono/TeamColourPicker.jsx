import PropTypes from 'prop-types';
import { deriveIdentityColour, normaliseHex } from '../../lib/teamColour';
import './kit/teamSheet.css';

// Kit colours a scorer is likely to need, plus a native custom picker. Any colour is safe: the
// colour engine normalises it for contrast before it reaches the board.
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

/** The kit name of a hex, or "Custom" for anything else. */
export function colourNameOf(hex) {
  const h = normaliseHex(hex);
  return TEAM_SWATCHES.find((s) => s.hex === h)?.name ?? 'Custom';
}

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

function Slash() {
  return (
    <svg className="kit-sw-check" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 19L19 5" />
    </svg>
  );
}

/**
 * Team colour choice: every kit colour as a large (56px) named swatch in one grid, then a custom
 * colour. The chosen swatch carries a check, an ink ring and aria-pressed, so colour is never the
 * only signal. The other team's colour is blocked (disabled, slashed and named), so two teams can
 * never be given the same colour. Only plain hex values ever reach onChange.
 */
export default function TeamColourPicker({ label, value, onChange, blockedHex, blockedLabel }) {
  const current = normaliseHex(value);
  const blocked = normaliseHex(blockedHex);
  const isCustom = Boolean(current) && !TEAM_SWATCHES.some((s) => s.hex === current);

  const onCustom = (event) => {
    const hex = normaliseHex(event.target.value);
    if (hex && hex !== blocked) onChange(hex);
  };

  return (
    <div className="kit-picker" role="group" aria-label={label}>
      <div className="kit-sw-grid">
        {TEAM_SWATCHES.map((s) => {
          const pressed = s.hex === current;
          const isBlocked = Boolean(blocked) && s.hex === blocked;
          return (
            <button
              key={s.hex}
              type="button"
              className="kit-sw"
              aria-pressed={pressed ? 'true' : 'false'}
              aria-label={isBlocked ? `${s.name}, used by ${blockedLabel}` : s.name}
              aria-disabled={isBlocked ? 'true' : undefined}
              disabled={isBlocked}
              onClick={() => onChange(s.hex)}
              style={swatchVars(s.hex)}
            >
              <span className="kit-sw-face">{isBlocked ? <Slash /> : pressed && <Check />}</span>
              <span className="kit-sw-name" aria-hidden="true">{isBlocked ? blockedLabel : s.name}</span>
            </button>
          );
        })}
        <label className={`kit-sw kit-sw-custom${isCustom ? ' is-selected' : ''}`} style={isCustom ? swatchVars(current) : undefined}>
          <span className="kit-sw-face kit-sw-face-custom">{isCustom ? <Check /> : <span className="kit-sw-plus" aria-hidden="true">+</span>}</span>
          <span className="kit-sw-name">{isCustom ? 'Custom (chosen)' : 'Custom'}</span>
          <input
            type="color"
            aria-label={isCustom ? `Custom colour for ${label} (selected)` : `Custom colour for ${label}`}
            value={current ?? TEAM_SWATCHES[0].hex}
            onChange={onCustom}
          />
        </label>
      </div>
    </div>
  );
}

TeamColourPicker.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  blockedHex: PropTypes.string,
  blockedLabel: PropTypes.string,
};
