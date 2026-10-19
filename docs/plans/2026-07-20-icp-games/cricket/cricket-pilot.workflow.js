export const meta = {
  name: 'cricket-pilot',
  description: 'Cricket per-game bespoke experience (pilot of the per-game template): authentic + competitor live-screen research, bespoke board/live/spectator design vs market bar, critic, Fable spec + build issues',
  phases: [
    { title: 'Research', detail: 'authentic cricket + competitor live screens + our current state' },
    { title: 'Design', detail: 'bespoke cricket board/live/spectator + mockups' },
    { title: 'Critic', detail: 'benchmark vs market bar + design system + authenticity' },
    { title: 'Spec', detail: 'Fable: final experience spec + engine notes + build issues' },
  ],
}

const DIR = 'C:/Users/harsha_befach/Downloads/Volleyball/docs/plans/2026-07-20-icp-games/cricket'
const APP = 'C:/Users/harsha_befach/Downloads/Volleyball/src/designs/design1-mono'
const GOV = `${APP}/BLEND-GOVERNANCE.md`

const RESEARCH = [
  { key: 'authentic', q: 'The AUTHENTIC cricket scoring/live experience: how scoring actually flows ball-by-ball (runs, extras: wide/no-ball/bye/legbye, wickets + dismissal types, overs, strike rotation, powerplay, DLS, super over), across formats T20/ODI and the INDIAN street/school variants (tennis-ball, box/gully cricket, one-tip-one-hand, last-man rules). What are the 3-5 SIGNATURE MOMENTS a great cricket live screen must dramatize (boundary 4/6, wicket, milestone 50/100, hat-trick, last-over chase, super over)? What data does a scorer need at a glance vs a spectator?' },
  { key: 'competitor-cricket', q: 'Study the best CRICKET live-scoring apps in the market, especially CRICHEROES (the dominant India grassroots cricket scoring app) plus Cricbuzz and ESPNcricinfo live commentary screens. What makes their live/scorecard screens feel PROFESSIONAL and trustworthy? Analyze: information hierarchy on the live screen, ball-by-ball timeline, this-over strip, mini-scorecard, run-rate/RRR/projected, batter+bowler cards, wagon wheel/manhattan/worm graphs, commentary feed, share cards. Cite what specifically to emulate and what to avoid.' },
  { key: 'general-leaders', q: 'Study the general multi-sport live-score leaders SOFASCORE, FLASHSCORE, LIVESCORE, ESPN and modern sports apps for what makes a LIVE match screen feel premium/professional: real-time momentum visuals, event timelines, animated score changes, tension/urgency cues in close finishes, stat density vs clarity, spectator vs scorer modes, and micro-interactions. Extract transferable patterns we can adopt (translated to a brutalist x HiFi visual system, not copied).' },
  { key: 'ours', q: `Assess OUR CURRENT cricket screens on master to know the baseline + gaps. Read ${APP}/scoring/MonoCricketLiveScore.jsx and MonoCricketTestLiveScore.jsx and the cricket engine/util. What does our live scorer already do well, what data/interactions/signature-moments are MISSING vs the competitor bar, and what is the current visual treatment (mono-arena, tokens)? Be concrete with file:line.` },
]

const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    area: { type: 'string' },
    findings: { type: 'array', items: { type: 'string' } },
    emulate: { type: 'array', items: { type: 'string' }, description: 'specific patterns worth adopting' },
    avoid: { type: 'array', items: { type: 'string' } },
    signatureMoments: { type: 'array', items: { type: 'string' } },
    sources: { type: 'array', items: { type: 'string' } },
  },
  required: ['area', 'findings'],
}

phase('Research')
const research = await parallel(RESEARCH.map((R) => () =>
  agent(
    `ScoreEasy is an India-first cricket live-scoring app; we are designing a best-in-market bespoke cricket experience. Research task: ${R.q}\n\n${R.key === 'ours' ? 'Read the actual source files.' : 'Use WebSearch / ctx_fetch_and_index and CITE sources.'} Return concrete, adoptable findings (info hierarchy, components, interactions, signature-moment treatments), what to emulate, what to avoid, and the signature moments.`,
    { label: `research:${R.key}`, phase: 'Research', schema: RESEARCH_SCHEMA, model: 'opus', effort: 'high' }
  )
))
const R = (research || []).filter(Boolean)
log(`research: ${R.length} areas`)

phase('Design')
const design = await agent(
  `Design ScoreEasy's BESPOKE CRICKET live experience, benchmarked to be as professional/worthy as the best market apps (CricHeroes/Sofascore) but expressed in OUR design system.\n\nDesign system: obey ${GOV} (blend-governance: brutalist shell — pure-black ink/borders, hard 3px 3px 0 shadow, tight radii, Inter+JetBrains Mono, uppercase mono microlabels — with HiFi warmth: --se-blend-* soft radii/washes/gold/glow, ONE gold accent per screen, capsules interactive-only, live pulse reduced-motion-gated). Reuse shared primitives (MonoSheet, chips, match-end Result/Scorecard/Share) — build cricket-specific on top, do not restyle the system.\n\nResearch to ground the design:\n${JSON.stringify(R)}\n\nProduce: (1) a design doc ${DIR}/cricket-design.md covering the SCORER live board (layout, ball-by-ball input, this-over strip, batter/bowler cards, run-rate/RRR/target, quick-buttons incl extras+wicket flow), the SPECTATOR live screen (read-only, momentum/worm, commentary feed, share), the 3-5 SIGNATURE-MOMENT treatments (4/6, wicket, 50/100, last-over) as micro-animation specs, and the data touchpoints; (2) a self-contained HTML mockup ${DIR}/cricket-live-mockup.html rendering the scorer board + spectator + one signature moment, using inline styles that mirror our tokens (approximate the brutalist x HiFi look; mobile 420px column). Use the native Write tool for both files. Return {docPath, mockupPath, summary}.`,
  { label: 'design', phase: 'Design', model: 'opus', effort: 'high', schema: { type: 'object', properties: { docPath: { type: 'string' }, mockupPath: { type: 'string' }, summary: { type: 'string' } }, required: ['docPath', 'mockupPath'] } }
)

phase('Critic')
const critic = await agent(
  `Adversarially critique the proposed bespoke CRICKET experience. Read ${DIR}/cricket-design.md and ${DIR}/cricket-live-mockup.html.\n\nJudge on THREE axes: (1) MARKET BAR — is this as professional/trustworthy/information-rich as CricHeroes/Cricbuzz/Sofascore live screens? What's missing or amateurish? (2) DESIGN-SYSTEM FIDELITY — does it honor ${GOV} (brutalist shell preserved, blend rules, one gold accent, capsules interactive-only, reduced-motion) or drift/dilute? (3) GAME AUTHENTICITY — does it correctly handle real cricket (extras, dismissal types, strike rotation, chase math, formats incl. tennis-ball/box) and dramatize the signature moments? Give concrete, ranked fixes. Return JSON {marketGaps:[], systemDrift:[], authenticityGaps:[], rankedFixes:[], verdict}.`,
  { label: 'critic', phase: 'Critic', model: 'opus', effort: 'high', schema: { type: 'object', properties: { marketGaps: { type: 'array', items: { type: 'string' } }, systemDrift: { type: 'array', items: { type: 'string' } }, authenticityGaps: { type: 'array', items: { type: 'string' } }, rankedFixes: { type: 'array', items: { type: 'string' } }, verdict: { type: 'string' } }, required: ['rankedFixes', 'verdict'] } }
)

phase('Spec')
const spec = await agent(
  `You are Fable. Produce the FINAL cricket bespoke-experience SPEC + build plan, folding the critic's ranked fixes into the design. Read ${DIR}/cricket-design.md, the critic findings below, and ${GOV}.\n\nCritic: ${JSON.stringify(critic)}\n\nWrite ${DIR}/cricket-spec.md: the locked scorer + spectator + signature-moment design (post-critic), the cricket engine/state notes (extras, dismissals, strike, chase, formats + tennis-ball/box config), the data touchpoints, and a SEQUENCED list of BUILD ISSUES (each a single PR on top of the shared primitives + match-end infra; note which shared primitives each needs so they're gated correctly). Flag anything that needs a product decision. Return JSON {docPath, buildIssues:[{title, prBoundary, dependsOnShared:[], effort}], openDecisions:[], bottomLine}.`,
  { label: 'fable-spec', phase: 'Spec', model: 'fable', effort: 'high', schema: { type: 'object', properties: { docPath: { type: 'string' }, buildIssues: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, prBoundary: { type: 'string' }, dependsOnShared: { type: 'array', items: { type: 'string' } }, effort: { type: 'string' } }, required: ['title'] } }, openDecisions: { type: 'array', items: { type: 'string' } }, bottomLine: { type: 'string' } }, required: ['buildIssues', 'bottomLine'] } }
)

return { research: R, design, critic, spec }
