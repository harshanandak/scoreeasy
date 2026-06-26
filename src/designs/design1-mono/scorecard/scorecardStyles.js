// Shared inline-style tokens for the generic scorecard suite.
//
// Colour and shape come exclusively from the Mono CSS variables (no hardcoded
// hex accents — the old #0066ff is dead). Numerics use tabular-nums so columns
// and running scores stay aligned.

/** Eyebrow / whisper label: mono 700, wide tracking, muted ink, uppercase. */
export const eyebrowStyle = {
  margin: 0,
  fontSize: '0.6875rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--muted-foreground)',
  fontVariantNumeric: 'tabular-nums',
};

/** Tabular numeric run, used for every score / count value. */
export const tabularNums = { fontVariantNumeric: 'tabular-nums' };

/** The 2px pure-black emphasis rule the stat header sits under. */
export const emphasisRule = '2px solid var(--foreground)';
