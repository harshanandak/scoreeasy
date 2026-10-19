export const meta = {
  name: 'flow-ia',
  description: 'Evaluate ScoreEasy end-to-end flow / IA / navigation seamlessness: trace core journeys, critique for lost-risk + simplicity, IA analysis, Fable synthesis',
  phases: [
    { title: 'Journeys', detail: 'trace each core journey end-to-end' },
    { title: 'Critique', detail: 'adversarial seamlessness / lost-risk / simplicity check' },
    { title: 'IA', detail: 'nav model, discoverability, clutter, naming' },
    { title: 'Synthesis', detail: 'Fable: navigation model + flow directives' },
  ],
}

const DIR = 'C:/Users/harsha_befach/Downloads/Volleyball/docs/plans/2026-07-19-hifi-live-app-upgrade'
const DISCOVERY = `${DIR}/discovery.json`
const EVAL_HIFI = `${DIR}/eval-hifi-reference.md`
const EVAL_APP = `${DIR}/eval-current-app.md`

// --- degenerate-output guard (Fable pre-build fix #2) ------------------------
// Throws loudly if an agent result is degenerate, so a future rerun cannot
// silently pass "placeholder" / "See above." / empty narrative downstream.
// Placeholder markers are rejected on ANY string; the <12-char check applies
// only to the passed narrativeKeys (so valid short enums like verdict:'broken' pass).
// Usage: wrap a result inside a .then(...), e.g.
//   .then((c) => { assertNotDegenerate(c, ['transitionGuidance']); return { ...} })
function assertNotDegenerate(result, narrativeKeys = ['transitionGuidance', 'goal', 'friction', 'notes']) {
  const bad = /placeholder|see above\.?/i
  const seen = new Set()
  const scan = (val, key) => {
    if (val == null) return
    if (typeof val === 'string') {
      const s = val.trim()
      if (bad.test(s)) throw new Error(`degenerate output: field "${key}" has a placeholder marker (${JSON.stringify(s.slice(0, 40))})`)
      if (narrativeKeys.includes(key) && s.length < 12) throw new Error(`degenerate output: narrative field "${key}" too short (${s.length} chars): ${JSON.stringify(s)}`)
      return
    }
    if (Array.isArray(val)) { val.forEach((v) => scan(v, key)); return }
    if (typeof val === 'object') {
      if (seen.has(val)) return
      seen.add(val)
      for (const k of Object.keys(val)) scan(val[k], k)
    }
  }
  scan(result, '(root)')
  return result
}

const JOURNEYS = [
  { key: 'activation', persona: 'first-time signed-out visitor', goal: 'understand the app and score a first match', anchor: 'Guest landing -> onboarding/auth -> Play -> Setup -> first Scorer' },
  { key: 'core-loop', persona: 'casual scorer', goal: 'quick-score a match start to finish then share/rematch', anchor: 'Play -> pick sport -> Setup/Customize -> Scorer -> Match-end (Result) -> Share / Rematch' },
  { key: 'in-match', persona: 'person scoring a live game', goal: 'score smoothly incl. attribution, undo, in-match menu, share-live mid-match', anchor: 'Scorer taps -> attribution sheets (who/how) -> Undo -> In-match menu -> Share live' },
  { key: 'spectator', persona: 'friend who receives a share link (no account)', goal: 'watch the live scoreboard then see the post-match scorecard', anchor: 'Share link -> Spectator (read-only live) -> Scorecard / graphs' },
  { key: 'returning-live', persona: 'returning signed-in user', goal: 'open the app, see what is live now, watch a friend live', anchor: 'Dashboard/Home -> Live-now band / Activity feed -> Spectator' },
  { key: 'social', persona: 'user growing their network', goal: 'find friends, follow, get notified, browse activity + public profiles', anchor: 'Find & invite -> Friends -> Notifications -> Activity feed -> Player profile (add friend)' },
  { key: 'tournament', persona: 'organiser', goal: 'create a tournament, run fixtures, score them, track standings/bracket', anchor: 'Play -> Tournament create -> Fixtures -> Tournament match score -> Standings / Bracket' },
  { key: 'records', persona: 'stats-minded user', goal: 'review past matches, match detail, player stats, leaderboard, milestones', anchor: 'History -> Match detail -> Statistics / Players leaderboard / Player profile' },
  { key: 'teams', persona: 'team manager', goal: 'create a team, add players, manage roster, view team stats', anchor: 'My teams -> Create team -> Add players -> Roster -> Team stats' },
  { key: 'settings', persona: 'user configuring defaults', goal: 'set scoring defaults, auto-share, appearance/dark, data export/clear', anchor: 'Profile/More -> Settings (scoring defaults, sharing, appearance, data)' },
]

const JOURNEY_SCHEMA = {
  type: 'object',
  properties: {
    journey: { type: 'string' },
    persona: { type: 'string' },
    goal: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          screen: { type: 'string' },
          action: { type: 'string' },
          transitionTo: { type: 'string' },
          friction: { type: 'string' },
        },
        required: ['screen', 'action'],
      },
    },
    totalTaps: { type: 'number' },
    seamlessness: { type: 'number', description: '1-10, how smooth the transitions are' },
    intuitiveness: { type: 'number', description: '1-10, how obvious the path is without instruction' },
    deadEnds: { type: 'array', items: { type: 'string' } },
    lostRisks: { type: 'array', items: { type: 'string' }, description: 'points where a user could get confused or lost' },
    dropOffRisks: { type: 'array', items: { type: 'string' } },
    fixes: { type: 'array', items: { type: 'string' } },
  },
  required: ['journey', 'steps', 'seamlessness', 'intuitiveness', 'lostRisks', 'fixes'],
}

const CRITIQUE_SCHEMA = {
  type: 'object',
  properties: {
    journey: { type: 'string' },
    tooManySteps: { type: 'boolean' },
    stepReductionIdeas: { type: 'array', items: { type: 'string' } },
    deadEndsConfirmed: { type: 'array', items: { type: 'string' } },
    lostRisksConfirmed: { type: 'array', items: { type: 'string' } },
    missingConnectiveScreens: { type: 'array', items: { type: 'string' }, description: 'screens/patterns that must exist to link the flow but are absent' },
    transitionGuidance: { type: 'string', description: 'how transitions/animations/back-stack should behave for this journey' },
    simplificationOpportunities: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string', enum: ['seamless', 'needs-work', 'broken'] },
  },
  required: ['journey', 'verdict', 'lostRisksConfirmed', 'simplificationOpportunities'],
}

const IA_SCHEMA = {
  type: 'object',
  properties: {
    focus: { type: 'string' },
    navModel: { type: 'string', description: 'recommended primary navigation model (tabs, hub, etc.) and why' },
    discoverabilityIssues: { type: 'array', items: { type: 'string' } },
    clutterOrHiddenUseful: { type: 'array', items: { type: 'string' }, description: 'useful screens buried, or clutter that should be demoted' },
    namingIssues: { type: 'array', items: { type: 'string' } },
    entryPointGaps: { type: 'array', items: { type: 'string' } },
    promoteScreens: { type: 'array', items: { type: 'string' } },
    demoteOrMergeScreens: { type: 'array', items: { type: 'string' } },
    simplicityRecommendations: { type: 'array', items: { type: 'string' } },
  },
  required: ['focus', 'navModel', 'discoverabilityIssues', 'simplicityRecommendations'],
}

const inputs = `Inputs to read as needed:\n- ${DISCOVERY} (the 60-screen map with groups, routes, currentState, hifiRef)\n- ${EVAL_HIFI} (HiFi reference incl. intended flow arrows like "-> Spectator")\n- ${EVAL_APP} (current app router + real routes + nav tabs)`

phase('Journeys')
const traced = await pipeline(
  JOURNEYS,
  (j) => agent(
    `Trace ONE core user journey through the ScoreEasy app end-to-end and judge how seamless + intuitive it is.\n\nJourney: ${j.key}\nPersona: ${j.persona}\nGoal: ${j.goal}\nRough anchor path (verify/refine against real screens): ${j.anchor}\n\n${inputs}\n\nWalk the ACTUAL screens a user touches to accomplish the goal. For each step give screen, action, and where it transitions. Then score seamlessness (1-10) and intuitiveness (1-10), count total taps, and list dead-ends, points where a user could get LOST/confused, drop-off risks, and concrete fixes. Be specific to real screens/routes. Note where a screen is currentState=missing so the journey has a hole today.`,
    { label: `journey:${j.key}`, phase: 'Journeys', schema: JOURNEY_SCHEMA, model: 'opus', effort: 'high' }
  ),
  (t, j) => agent(
    `Adversarially critique this traced user journey for the ScoreEasy app. The product goal: make the experience SIMPLE and INTUITIVE, surface the USEFUL screens, and never let users get lost.\n\nJourney: ${j.key}\nTrace: ${JSON.stringify(t)}\n\nBe skeptical. Is it too many steps? Where exactly could a user get lost or hit a dead-end? What connective screens/patterns are MISSING to make transitions seamless? How should transitions / animations / back-stack behave here? What can be simplified or removed? Give a verdict.`,
    { label: `critique:${j.key}`, phase: 'Critique', schema: CRITIQUE_SCHEMA, model: 'opus', effort: 'high' }
  ).then((c) => {
    // reject a degenerate critique before it enters the synthesis
    assertNotDegenerate(c, ['transitionGuidance'])
    return { journey: j.key, persona: j.persona, trace: t, critique: c }
  })
)

const journeys = traced.filter(Boolean)
log(`${journeys.length} journeys traced + critiqued`)

phase('IA')
const IA_LENSES = [
  { focus: 'primary navigation + bottom-tab IA', hint: 'the tab model, what belongs in tabs vs hub vs profile; label clarity (I-066); how many tabs; the Home/Play/History/Friends/More question' },
  { focus: 'discoverability + surfacing useful screens', hint: 'are the high-value surfaces (Play, Live-now, Share-live, Watch) easy to reach? what useful features are buried? what clutter/dev/legacy should be demoted or removed?' },
  { focus: 'simplicity + cognitive load + first-run clarity', hint: 'progressive disclosure, defaults, empty-state guidance, reducing choices, making the next action obvious; where the app overwhelms' },
]
const ia = await parallel(IA_LENSES.map((L) => () =>
  agent(
    `Analyze the ScoreEasy app's information architecture through ONE lens: ${L.focus}.\nConsider: ${L.hint}.\n\n${inputs}\n\nRecommend a concrete navigation/IA model and list discoverability issues, buried-useful vs clutter, naming issues, entry-point gaps, which screens to PROMOTE and which to DEMOTE/MERGE, and simplicity recommendations. Ground it in the real screen list.`,
    { label: `ia:${L.focus.split(' ')[0]}`, phase: 'IA', schema: IA_SCHEMA, model: 'opus', effort: 'high' }
  )
))

phase('Synthesis')
const synthesis = await agent(
  `You are Fable, senior UX/IA director. Synthesize a FLOW + INFORMATION-ARCHITECTURE evaluation for the ScoreEasy app from the traced journeys and IA analyses below. The goal the user set: make the app SIMPLE and INTUITIVE, seamless transitions, surface the USEFUL screens, never let people get lost.\n\nTraced+critiqued journeys:\n${JSON.stringify(journeys)}\n\nIA analyses:\n${JSON.stringify((ia || []).filter(Boolean))}\n\nProduce a markdown evaluation with: (1) a recommended end-to-end NAVIGATION MODEL (primary nav, key hubs, cross-links, back-stack/deep-link rules); (2) the top seamlessness + lost-risk problems ranked, each with the fix; (3) which screens to PROMOTE / DEMOTE / MERGE / CUT to reduce clutter and surface useful ones; (4) MISSING connective screens/patterns that must be added as issues; (5) transition/motion guidance consistent with the brutalist x HiFi blend; (6) a PRIORITIZED list of flow/IA DIRECTIVES (actionable for Opus) that should merge into the build plan + how they change epic sequencing. Write to ${DIR}/flow-ia-evaluation.md using the native Write tool.\n\nAt the end return a JSON object summarizing: the recommended nav model in one line, the count of directives, and the top 5 directives.`,
  { label: 'fable-synthesis', phase: 'Synthesis', model: 'fable', effort: 'high', schema: {
    type: 'object',
    properties: {
      navModelOneLine: { type: 'string' },
      directiveCount: { type: 'number' },
      top5Directives: { type: 'array', items: { type: 'string' } },
      docPath: { type: 'string' },
    },
    required: ['navModelOneLine', 'top5Directives'],
  } }
)

return { journeys, ia: (ia || []).filter(Boolean), synthesis }
