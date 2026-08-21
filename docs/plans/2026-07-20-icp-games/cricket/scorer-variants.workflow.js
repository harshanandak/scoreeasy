export const meta = {
  name: 'scorer-variants',
  description: 'Generate 3 distinct, more-efficient cricket-scorer interaction models on the clean baseline (real CSS, brutalist palette), each a separate mockup for comparison',
  phases: [{ title: 'Variants', detail: '3 efficient scorer concepts, each a mockup' }],
}

const DIR = 'C:/Users/harsha_befach/Downloads/Volleyball/docs/plans/2026-07-20-icp-games/cricket'
const BASE = `${DIR}/cricket-scorer-clean.html`

const VARIANTS = [
  { key: 'big5', title: 'Frequency-first (Big-5)', concept: 'Most balls are a dot, 1, 4, 6 or a wicket. Make THOSE five the big one-tap primary targets (a large row/grid), and tuck the rare outcomes (2, 3, 5, and the extras Wide/No-ball/Bye/LB) into ONE compact secondary strip below. The scorer hits the common ball in one tap on a big target with almost no visual scanning. Fewer prominent controls = faster + calmer.' },
  { key: 'rail', title: 'Runs rail + armed extras', concept: 'A single horizontal 0–1–2–3–4–5–6 RAIL of tappable pills (one row, thumb-swipeable), plus a small EXTRAS control that, when armed (tap Wide/No-ball/Bye/LB), shows an inline "＋ runs off it" and a live arithmetic confirm ("No-ball + 4 = 5"). One tap for a normal ball; extras never take a separate screen. Denser and fewer sections than the grid.' },
  { key: 'batsman', title: 'Batsman-centric tap', concept: 'The on-strike batsman is the hero tap-target. The two batsmen sit as big cards; tapping the striker reveals a compact run selector (0–6 + boundary emphasis) right under them, so scoring is anchored to WHO faced the ball (auto-credits runs + balls to the striker, makes strike rotation obvious). Wicket + extras as clear secondary actions. Optimises attribution + one-handed use.' },
]

phase('Variants')
const built = await parallel(VARIANTS.map((V) => () =>
  agent(
    `Build ONE cricket-scorer mockup that is a MORE-EFFICIENT alternative interaction to our current clean baseline. Output: ${DIR}/cricket-scorer-alt-${V.key}.html (native Write).\n\nCONCEPT — ${V.title}: ${V.concept}\n\nHARD RULES (this is why prior attempts were rejected — do NOT repeat them):\n1. Read the baseline ${BASE} and REUSE its entire <style> head VERBATIM (the real inlined src/index.css tokens + real mono.css classes) and its TOP structure unchanged: the top bar, the flat BLACK hero (score + chase bar + NEED/RRR), the 3-column players row, and the OVER strip. Only the SCORING-INTERACTION zone (keypad/extras/OUT/Strike/End) changes per the concept.\n2. Keep it CLEAN and SIMPLE — minimal-brutalist palette only (black ink, hard 3px shadow, JetBrains-mono numerals, green as the only accent, no raw hex, no second colour, no gradient). Match the baseline's density and sizing exactly — no noise, no dead space.\n3. Mobile 390px column (max-width:390px shell), self-contained, no external resources beyond the font @import already in the head, reduced-motion respected.\n4. Same demo state: Royals 147/4 (17.2) chasing 170 — NEED 23 OFF 16.\n\nMake the concept genuinely different from a plain 0–6 grid and genuinely faster for the common ball. Return {key:'${V.key}', title:'${V.title}', efficiency:'what makes it faster/easier', tapsPerBall:'normal / boundary / extra / wicket', path}.`,
    { label: `alt:${V.key}`, phase: 'Variants', model: 'opus', effort: 'high', schema: { type: 'object', properties: { key: { type: 'string' }, title: { type: 'string' }, efficiency: { type: 'string' }, tapsPerBall: { type: 'string' }, path: { type: 'string' } }, required: ['key', 'title', 'efficiency', 'path'] } }
  )
))
return { built: (built || []).filter(Boolean) }
