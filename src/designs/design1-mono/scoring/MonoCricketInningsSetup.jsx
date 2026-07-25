import { useState } from 'react';

// C6b opening-lineup / innings-break setup step. A FULL-SCREEN step (not a bottom
// sheet) that reuses the guided scorer's mono tokens so it reads as the same
// surface. Picks the opening striker, non-striker, and bowler for the upcoming
// innings. Squads are [{id,name}] (may be empty -> free-text entry like the
// PlayerPickerSheet). Confirm is disabled until striker != non-striker and a
// bowler is chosen.

// Accept a squad entry as { id, name } or a bare string; normalize to { id, name }.
function normOption(p) {
  if (p && typeof p === 'object') {
    const id = p.id ?? p.name;
    return { id, name: p.name ?? p.id ?? id };
  }
  return { id: p, name: p };
}

// One role field: squad options as selectable pills + a free-text fallback.
// `excludeId` disables the option already taken by the sibling batter.
function RoleField({ label, options, value, onChange, excludeId = null, testid }) {
  const inSquad = value && options.some((o) => o.id === value.id);
  return (
    <div className="mono-setup-field" data-testid={testid}>
      <span className="mono-setup-lbl">{label}</span>
      {options.length ? (
        <div className="mono-setup-opts">
          {options.map((o) => {
            const disabled = excludeId != null && o.id === excludeId;
            const on = value?.id === o.id;
            return (
              <button
                key={o.id}
                type="button"
                className={`mono-setup-pill${on ? ' on' : ''}`}
                aria-pressed={on}
                disabled={disabled}
                onClick={() => onChange({ id: o.id, name: o.name })}
              >
                {o.name}
              </button>
            );
          })}
        </div>
      ) : null}
      <input
        type="text"
        className="mono-setup-input"
        placeholder={options.length ? 'Or add a name' : 'Enter name'}
        aria-label={label}
        value={value && !inSquad ? value.name : ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v.trim() ? { id: v.trim(), name: v.trim() } : null);
        }}
      />
    </div>
  );
}

export default function MonoCricketInningsSetup({
  title,
  subtitle = null,
  battingSquad = [],
  bowlingSquad = [],
  onConfirm,
}) {
  const batOptions = (battingSquad || []).map(normOption);
  const bowlOptions = (bowlingSquad || []).map(normOption);

  const [striker, setStriker] = useState(null);
  const [nonStriker, setNonStriker] = useState(null);
  const [bowler, setBowler] = useState(null);

  const valid = !!(striker && nonStriker && bowler && striker.id !== nonStriker.id);

  const confirm = () => {
    if (!valid) return;
    onConfirm?.({ striker, nonStriker, bowler });
  };

  return (
    <div className="mono-setup-screen" data-testid="innings-setup">
      <style>{STYLES}</style>
      <div className="mono-setup-shell">
        <header className="mono-setup-head">
          <div className="mono-setup-eyebrow">Line-up</div>
          <h1 className="mono-setup-title">{title}</h1>
          {subtitle ? <p className="mono-setup-sub">{subtitle}</p> : null}
        </header>

        <RoleField
          label="Striker"
          testid="setup-striker"
          options={batOptions}
          value={striker}
          onChange={setStriker}
          excludeId={nonStriker?.id ?? null}
        />
        <RoleField
          label="Non-striker"
          testid="setup-nonstriker"
          options={batOptions}
          value={nonStriker}
          onChange={setNonStriker}
          excludeId={striker?.id ?? null}
        />
        <RoleField
          label="Opening bowler"
          testid="setup-bowler"
          options={bowlOptions}
          value={bowler}
          onChange={setBowler}
        />

        {striker && nonStriker && striker.id === nonStriker.id ? (
          <p className="mono-setup-warn" role="alert">
            Striker and non-striker must be different players.
          </p>
        ) : null}

        <button
          type="button"
          className="mono-setup-confirm"
          data-testid="setup-confirm"
          disabled={!valid}
          onClick={confirm}
        >
          Confirm line-up
        </button>
      </div>
    </div>
  );
}

// Mono tokens only (--se-*/--primary) — mirrors the guided scorer surface.
const STYLES = `
.mono-setup-screen { min-height: 100dvh; padding: 16px 14px calc(16px + env(safe-area-inset-bottom, 0px)); }
.mono-setup-shell { max-width: 390px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.mono-setup-head { display: flex; flex-direction: column; gap: 4px; }
.mono-setup-eyebrow { font-family: var(--se-font-mono); font-size: 0.625rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--se-color-ink-faint); }
.mono-setup-title { font-size: 1.375rem; font-weight: 800; line-height: 1.1; color: var(--se-color-ink); margin: 0; }
.mono-setup-sub { font-family: var(--se-font-mono); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em; color: var(--se-color-ink-muted); margin: 0; }

.mono-setup-field { display: flex; flex-direction: column; gap: 7px; border: 1px solid var(--se-color-line); border-radius: 14px; background: var(--se-color-surface); padding: 12px 13px; }
.mono-setup-lbl { font-family: var(--se-font-mono); font-size: 0.625rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--se-color-ink-faint); }
.mono-setup-opts { display: flex; flex-wrap: wrap; gap: 7px; }
.mono-setup-pill { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; border: 1px solid color-mix(in oklch, var(--se-color-line) 40%, transparent); background: var(--se-color-surface); color: var(--se-color-ink); border-radius: 999px; padding: 8px 15px; font-family: var(--se-font-sans); font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
.mono-setup-pill:active { background: var(--accent); }
.mono-setup-pill.on { background: var(--se-color-action); border-color: var(--se-color-action); color: var(--se-color-inverse); }
.mono-setup-pill:disabled { opacity: 0.4; cursor: not-allowed; }
.mono-setup-input { min-height: 42px; padding: 9px 12px; border: 1px solid var(--se-color-line); border-radius: 10px; background: var(--se-color-surface); color: var(--se-color-ink); font-family: var(--se-font-sans); font-size: 0.8125rem; }

.mono-setup-warn { font-family: var(--se-font-mono); font-size: 0.6875rem; font-weight: 700; color: var(--se-color-danger); margin: 0; }

.mono-setup-confirm { margin-top: 4px; min-height: 50px; border-radius: 12px; border: 1px solid var(--se-color-action); background: var(--se-color-action); color: var(--se-color-inverse); font-family: var(--se-font-sans); font-size: 0.9375rem; font-weight: 800; letter-spacing: 0.02em; cursor: pointer; }
.mono-setup-confirm:disabled { opacity: 0.45; cursor: not-allowed; border-color: var(--se-color-line); background: color-mix(in oklch, var(--se-color-line) 30%, var(--se-color-surface)); color: var(--se-color-ink-muted); }

@media (prefers-reduced-motion: reduce) {
  .mono-setup-pill:active { transform: none; }
}
`;
