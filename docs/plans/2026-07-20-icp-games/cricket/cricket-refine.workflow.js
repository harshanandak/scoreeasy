export const meta = {
  name: 'cricket-refine',
  description: 'Cricket UX variability + edge-case rigor: design 3 distinct scorer/live UX options, adversarial edge-case audit, Fable judges/synthesizes the best + folds fixes into the locked spec',
  phases: [
    { title: 'UX options', detail: '3 distinct scorer+live interaction designs + mockups' },
    { title: 'Edge audit', detail: 'adversarial cricket edge-case cross-check' },
    { title: 'Judge', detail: 'Fable scores/compares, picks or synthesizes, folds fixes' },
  ],
}

const DIR = 'C:/Users/harsha_befach/Downloads/Volleyball/docs/plans/2026-07-20-icp-games/cricket'
const APP = 'C:/Users/harsha_befach/Downloads/Volleyball/src/designs/design1-mono'
const GOV = `${APP}/BLEND-GOVERNANCE.md`
const SPEC = `${DIR}/cricket-spec.md`
const DESIGN = `${DIR}/cricket-design.md`

// Scope: LIMITED-OVERS first (T20/ODI + gully/tennis-ball/box + house-rules). Test-match deferred.
const OPTIONS = [
  { key: 'keypad', title: 'Dense keypad (power-scorer)', brief: 'Always-visible run keypad 0-6 + persistent extras row + distinct wicket action, CricHeroes-style density. Optimized for a fast experienced scorer: minimal taps per ball, everything one thumb-reach away, this-over strip live. Trade learnability for speed.' },
  { key: 'guided', title: 'Guided tap-flow (casual/novice)', brief: 'The app asks one question per ball — "runs?" -> "extra?" -> "wicket?" — progressive disclosure, few buttons on screen at once, plain-language prompts. Optimized for a casual gully/school scorer who is not an expert; hard to mis-score. Trade raw speed for correctness + learnability.' },
  { key: 'zones', title: 'Tap-zones + gestures (thumb-speed)', brief: 'Large batsman-side tap zones + gestures: tap = dot/single by side, double-tap or swipe-out = boundary (4/6), long-press = wicket sheet, swipe = strike swap. Minimal chrome, maximal thumb speed, big targets. Trade discoverability for one-handed velocity.' },
]

const OPTION_SCHEMA = {
  type: 'object',
  properties: {
    option: { type: 'string' },
    philosophy: { type: 'string' },
    scorerFlow: { type: 'array', items: { type: 'string' }, description: 'step-by-step: how the user scores a normal ball, a boundary, an extra, a wicket' },
    tapsPerBall: { type: 'string', description: 'typical taps for a normal ball / boundary / wicket' },
    strengths: { type: 'array', items: { type: 'string' } },
    weaknesses: { type: 'array', items: { type: 'string' } },
    mockupPath: { type: 'string' },
    summary: { type: 'string' },
  },
  required: ['option', 'philosophy', 'scorerFlow', 'tapsPerBall', 'mockupPath'],
}

phase('UX options')
const options = await parallel(OPTIONS.map((O) => () =>
  agent(
    `Design ONE distinct UX APPROACH for the ScoreEasy cricket LIVE SCORER + spectator, then render a mockup. This is one of three competing options — commit fully to THIS philosophy so the three are genuinely different to compare.\n\nOPTION: ${O.title}\nPhilosophy: ${O.brief}\n\nGround truth: read the research/spec in ${SPEC} and ${DESIGN} (delivery-engine model, extras, strike rotation, signature moments, gully house-rules), and obey the design system ${GOV} (brutalist shell + --se-blend-* HiFi warmth, one gold/screen, capsules interactive-only, no raw hex, reduced-motion). Scope = LIMITED-OVERS + gully/tennis-ball/box (defer test-match).\n\nDeliver: a concrete design of the scorer board under THIS philosophy — describe step-by-step how the user scores a normal ball, a boundary, an extra (wide/no-ball/bye), and a wicket (taps per action), plus the live spectator view; strengths/weaknesses honest to this approach. Then WRITE a self-contained mobile (420px) HTML mockup to ${DIR}/cricket-ux-${O.key}.html using inline styles that mirror our tokens (brutalist x HiFi), showing the scorer board mid-over + the spectator view + one signature moment. Use the native Write tool. Return the structured design.`,
    { label: `option:${O.key}`, phase: 'UX options', schema: OPTION_SCHEMA, model: 'opus', effort: 'high' }
  )
))
const opts = (options || []).filter(Boolean)
log(`${opts.length} UX options designed`)

const EDGE = [
  { key: 'scoring', brief: 'SCORING-CORRECTNESS edge cases the delivery engine + UI must handle: wide+byes (runs to team, ball re-bowled), no-ball + runs off bat vs free-hit run-out (only run-out dismisses), overthrows (4 + ran runs), byes/leg-byes credit ball-faced to batter but runs to team, penalty runs, strike rotation on odd runs off the LAST ball of an over (double swap), strike on wide with odd physical runs, run-out at which end + who is out + which batter is on strike after, retired hurt vs retired out, last-man-stands single-batter self-run, new batter on strike vs non-strike, end-of-over auto strike swap, over-quota reached mid-over, a wicket off a no-ball (illegal — revert).' },
  { key: 'flow', brief: 'UX-FLOW + FORMAT/RULES edge cases: undo/edit the last ball mid-over (must recompute strike + over + bowler figures), correct a mis-tap two balls back, bowler cannot bowl consecutive overs (enforce/warn), new batter selection sheet, super-over tie -> further super overs, DLS/rain par line, powerplay indicator, gully house-rule toggles (one-tip-one-hand out, no-LBW hides LBW, tennis-ball/box presets, boundary=house rule), joker/last-pair, innings break + chase target handoff, offline scoring then sync, spectator seeing a stale ball.' },
]
phase('Edge audit')
const edges = await parallel(EDGE.map((E) => () =>
  agent(
    `Adversarially CROSS-CHECK cricket ${E.key} edge cases for ScoreEasy (limited-overs + gully scope). Enumerate EACH edge case below as a checklist, and for each: does the spec (${SPEC}) + the delivery-engine model + the three UX options (${JSON.stringify(opts.map((o) => ({ option: o.option, flow: o.scorerFlow, taps: o.tapsPerBall })))}) correctly HANDLE it, or is it a GAP? Be concrete about the failure and the required rule/UI.\n\nEdge cases: ${E.brief}\n\nAlso surface any edge case NOT listed that a real scorer hits. Return {area, cases:[{case, handledBy:'spec|option|none', status:'ok|gap|ambiguous', requiredFix}], criticalGaps:[]}.`,
    { label: `edge:${E.key}`, phase: 'Edge audit', schema: {
      type: 'object',
      properties: {
        area: { type: 'string' },
        cases: { type: 'array', items: { type: 'object', properties: { case: { type: 'string' }, status: { type: 'string', enum: ['ok', 'gap', 'ambiguous'] }, requiredFix: { type: 'string' } }, required: ['case', 'status'] } },
        criticalGaps: { type: 'array', items: { type: 'string' } },
      },
      required: ['area', 'cases', 'criticalGaps'],
    }, model: 'opus', effort: 'high' }
  )
))
const edgeFindings = (edges || []).filter(Boolean)

phase('Judge')
const judge = await agent(
  `You are Fable. Compare the 3 cricket-scorer UX options and fold the edge-case audit into a refined, locked design. The user wants: (a) genuine variability compared + evaluated, (b) the EASIEST user path chosen, (c) edge cases cross-checked.\n\nUX options:\n${JSON.stringify(opts)}\n\nEdge-case audit:\n${JSON.stringify(edgeFindings)}\n\nDo: (1) SCORE each option in a table on Speed(expert), Learnability(casual/gully), Error-recovery, Market-bar(CricHeroes/Sofascore), Design-system fidelity, Edge-case robustness, One-handed use — 1-5 each with a one-line why; (2) RECOMMEND a winner OR a synthesis (e.g. guided-default with a power-scorer toggle) — justify from the ICP (casual school/gully scorers dominate, but power-scorers exist); (3) list the EDGE-CASE FIXES (from the audit) that must be in C1 engine + the scorer UI, especially any criticalGaps; (4) update the spec: write ${DIR}/cricket-spec-v2.md = the locked, post-comparison, post-edge-audit design (chosen UX + edge rules + which mockup to render as canonical) and note the delta vs cricket-spec.md. Return JSON {scoreTable:[{option, speed, learnability, errorRecovery, marketBar, fidelity, edgeRobustness, oneHanded, why}], recommendation, chosenMockup, criticalEdgeFixes:[], openDecisions:[], docPath, bottomLine}.`,
  { label: 'fable-judge', phase: 'Judge', model: 'fable', effort: 'high', schema: {
    type: 'object',
    properties: {
      scoreTable: { type: 'array', items: { type: 'object', properties: { option: { type: 'string' }, speed: { type: 'number' }, learnability: { type: 'number' }, errorRecovery: { type: 'number' }, marketBar: { type: 'number' }, fidelity: { type: 'number' }, edgeRobustness: { type: 'number' }, oneHanded: { type: 'number' }, why: { type: 'string' } }, required: ['option', 'why'] } },
      recommendation: { type: 'string' },
      chosenMockup: { type: 'string' },
      criticalEdgeFixes: { type: 'array', items: { type: 'string' } },
      openDecisions: { type: 'array', items: { type: 'string' } },
      docPath: { type: 'string' },
      bottomLine: { type: 'string' },
    },
    required: ['scoreTable', 'recommendation', 'criticalEdgeFixes', 'bottomLine'],
  } }
)

return { options: opts, edgeFindings, judge }
