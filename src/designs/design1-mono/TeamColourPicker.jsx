import { useRef } from 'react';
import PropTypes from 'prop-types';
import { normaliseHex } from '../../lib/teamColour';

// Kit colours a scorer is likely to need, plus a native custom picker. Any colour is safe:
// the colour engine normalises it for contrast before it reaches the board.
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

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown']);
const PREV_KEYS = new Set(['ArrowLeft', 'ArrowUp']);

const swatchStyle = (hex, checked) => ({
  minWidth: '44px',
  minHeight: '44px',
  width: 44,
  height: 44,
  padding: 0,
  borderRadius: '50%',
  border: '1.5px solid var(--se-color-ink)',
  background: hex,
  outline: checked ? '3px solid var(--se-color-ink)' : 'none',
  outlineOffset: 2,
  cursor: 'pointer',
  touchAction: 'manipulation',
});

/**
 * Team colour choice: a radiogroup of kit swatches (arrow keys move and select) plus a custom
 * colour input. Only plain hex values ever reach onChange.
 */
export default function TeamColourPicker({ label, value, onChange }) {
  const current = normaliseHex(value);
  const checkedIndex = TEAM_SWATCHES.findIndex((s) => s.hex === current);
  const refs = useRef([]);

  const select = (index) => {
    const n = TEAM_SWATCHES.length;
    const i = ((index % n) + n) % n;
    onChange(TEAM_SWATCHES[i].hex);
    refs.current[i]?.focus();
  };

  const onKeyDown = (event) => {
    const from = checkedIndex === -1 ? 0 : checkedIndex;
    if (NEXT_KEYS.has(event.key)) {
      event.preventDefault();
      select(from + 1);
    } else if (PREV_KEYS.has(event.key)) {
      event.preventDefault();
      select(from - 1);
    }
  };

  const onCustom = (event) => {
    const hex = normaliseHex(event.target.value);
    if (hex) onChange(hex);
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
      <div role="radiogroup" aria-label={label} style={{ display: 'contents' }}>
        {TEAM_SWATCHES.map((s, i) => {
          const checked = i === checkedIndex;
          const focusable = checked || (checkedIndex === -1 && i === 0);
          return (
            <button
              key={s.hex}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked ? 'true' : 'false'}
              aria-label={s.name}
              title={s.name}
              tabIndex={focusable ? 0 : -1}
              onClick={() => onChange(s.hex)}
              onKeyDown={onKeyDown}
              style={swatchStyle(s.hex, checked)}
            />
          );
        })}
      </div>
      <label
        title="Custom colour"
        style={{
          ...swatchStyle(checkedIndex === -1 && current ? current : 'var(--se-color-surface)', checkedIndex === -1 && !!current),
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          fontFamily: 'var(--se-font-mono)',
          fontWeight: 800,
          color: 'var(--se-color-ink)',
        }}
      >
        {checkedIndex === -1 && current ? '' : '+'}
        <input
          type="color"
          aria-label={`Custom colour for ${label}`}
          value={current ?? '#000000'}
          onChange={onCustom}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
        />
      </label>
    </div>
  );
}

TeamColourPicker.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};
