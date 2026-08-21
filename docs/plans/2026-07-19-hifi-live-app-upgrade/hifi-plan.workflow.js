export const meta = {
  name: 'hifi-plan',
  description: 'Plan the brutalist x HiFi blend upgrade of the ScoreEasy live app: per-screen blend designs, adversarial verify, epic/PR decomposition',
  phases: [
    { title: 'Discover', detail: 'consolidate eval docs into a screen list + identity' },
    { title: 'Screen designs', detail: 'one blend design per screen (brutalist x HiFi)' },
    { title: 'Verify', detail: 'adversarial check per screen design' },
    { title: 'Decompose', detail: 'epics + issues + PR order' },
  ],
}

const EVAL_HIFI = 'C:/Users/harsha_befach/Downloads/Volleyball/docs/plans/2026-07-19-hifi-live-app-upgrade/eval-hifi-reference.md'
const EVAL_APP = 'C:/Users/harsha_befach/Downloads/Volleyball/docs/plans/2026-07-19-hifi-live-app-upgrade/eval-current-app.md'

// --- degenerate-output guard (Fable pre-build fix #2) ------------------------
// Throws loudly if an agent result is degenerate, so a future rerun cannot
// silently re-file "placeholder" / "See above." / empty narrative into the plan.
// Placeholder markers are rejected on ANY string; the <12-char check applies
// only to the passed narrativeKeys (so valid short enums like effort:'S' pass).
// Usage: wrap a result before it flows downstream, e.g. inside a .then(...):
//   .then((v) => { assertNotDegenerate({ ...design, verdict: v }, ['blendDesign']); return { ...design, verdict: v } })
function assertNotDegenerate(result, narrativeKeys = ['blendDesign', 'description', 'goal', 'rationale', 'critique', 'risks', 'notes']) {
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

const DISCOVERY_SCHEMA = {
  type: 'object',
  properties: {
    brutalistIdentity: { type: 'string', description: 'Concise: the brutalist identity that MUST be preserved (tokens, borders, mono type, hard edges).' },
    hifiTraits: { type: 'string', description: 'Concise: the friendly HiFi UX traits to adopt (rounded/circular scoring, feedback, simplified flows).' },
    screens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          group: { type: 'string', description: 'flow group: onboarding/home, pick, setup, scorer, spectator, result, history-stats, tournament-schedule, settings-account, other' },
          route: { type: 'string' },
          currentState: { type: 'string', enum: ['built', 'partial', 'stub', 'missing'] },
          sourceFiles: { type: 'array', items: { type: 'string' } },
          hifiRef: { type: 'string', description: 'matching HiFi reference screen name' },
          notes: { type: 'string' },
        },
        required: ['name', 'group', 'currentState'],
      },
    },
    gaps: { type: 'array', items: { type: 'string' }, description: 'cross-cutting gaps / foundation work' },
  },
  required: ['brutalistIdentity', 'hifiTraits', 'screens'],
}

const SCREEN_DESIGN_SCHEMA = {
  type: 'object',
  properties: {
    screen: { type: 'string' },
    blendDesign: { type: 'string', description: 'the concrete brutalist x HiFi design for this screen' },
    keepsBrutalist: { type: 'array', items: { type: 'string' } },
    adoptsHifi: { type: 'array', items: { type: 'string' } },
    circularFriendlyElements: { type: 'string' },
    filesToChange: { type: 'array', items: { type: 'string' } },
    newFilesOrComponents: { type: 'array', items: { type: 'string' } },
    effort: { type: 'string', enum: ['S', 'M', 'L'] },
    dependencies: { type: 'array', items: { type: 'string' } },
    risks: { type: 'string' },
  },
  required: ['screen', 'blendDesign', 'effort'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    preservesBrutalistIdentity: { type: 'boolean' },
    capturesHifiUxWin: { type: 'boolean' },
    buildableAsOnePr: { type: 'boolean' },
    scopeVerdict: { type: 'string', enum: ['ok', 'too-big', 'too-small'] },
    issues: { type: 'array', items: { type: 'string' } },
    revisedEffort: { type: 'string', enum: ['S', 'M', 'L'] },
  },
  required: ['preservesBrutalistIdentity', 'capturesHifiUxWin', 'buildableAsOnePr', 'scopeVerdict'],
}

const DECOMPOSE_SCHEMA = {
  type: 'object',
  properties: {
    epics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          goal: { type: 'string' },
          rationale: { type: 'string' },
          screens: { type: 'array', items: { type: 'string' } },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                type: { type: 'string', enum: ['feature', 'bug', 'task', 'chore'] },
                priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
                description: { type: 'string' },
                prBoundary: { type: 'string', description: 'what this single PR delivers' },
                dependsOn: { type: 'array', items: { type: 'string' } },
                effort: { type: 'string', enum: ['S', 'M', 'L'] },
              },
              required: ['title', 'type', 'priority', 'description'],
            },
          },
        },
        required: ['title', 'goal', 'issues'],
      },
    },
    prOrder: { type: 'array', items: { type: 'string' } },
    crossCutting: { type: 'array', items: { type: 'string' } },
  },
  required: ['epics', 'prOrder'],
}

phase('Discover')
const disco = await agent(
  `Read these two evaluation docs FULLY:\n- ${EVAL_HIFI} (HiFi design reference inventory)\n- ${EVAL_APP} (current live app inventory + brutalist identity + design debt)\n\nConsolidate them into one discovery object. Give: the brutalist identity to PRESERVE (concise), the key HiFi UX traits to ADOPT (concise), and a flat list of EVERY screen we should plan for (union of current app screens + HiFi reference screens + missing/undeveloped screens). For each screen: name, flow group, route if known, currentState (built|partial|stub|missing), sourceFiles, matching HiFi reference screen, and notes. Also list cross-cutting gaps / foundation work (e.g. a shared token+component layer). Be concrete and exhaustive on the screen list.`,
  { label: 'discover', phase: 'Discover', schema: DISCOVERY_SCHEMA, model: 'opus', effort: 'high' }
)

const screens = (disco && disco.screens) ? disco.screens : []
log(`Discovered ${screens.length} screens to plan`)

phase('Screen designs')
const planned = await pipeline(
  screens,
  (s) => agent(
    `You are designing the UPGRADED version of ONE screen of the ScoreEasy sports-scoring app. The app keeps its existing BRUTALIST visual identity; we BLEND it with the friendlier HiFi flow to get best-of-both-worlds. Do NOT replace brutalism. Softer / rounded / circular elements are welcome INSIDE game scoring and live gameplay.\n\nBrutalist identity to preserve: ${disco.brutalistIdentity}\nHiFi UX traits to adopt: ${disco.hifiTraits}\n\nSCREEN: ${JSON.stringify(s)}\n\nRead the relevant current source files (under C:/Users/harsha_befach/Downloads/Volleyball/src/designs/design1-mono/) and consult the HiFi reference eval doc (${EVAL_HIFI}) as needed. Produce a CONCRETE blend design for this screen: what it keeps from brutalism, what HiFi UX it adopts, where circular/friendly elements go, the exact files/components to change or create, effort (S|M|L), dependencies on other screens or cross-cutting work, and risks.`,
    { label: `design:${s.name}`, phase: 'Screen designs', schema: SCREEN_DESIGN_SCHEMA, model: 'opus', effort: 'high' }
  ),
  (design, s) => agent(
    `Adversarially verify this per-screen design for the ScoreEasy brutalist x HiFi blend. Screen: ${s.name}.\nDesign: ${JSON.stringify(design)}\n\nCheck skeptically: (1) does it genuinely PRESERVE the brutalist identity, not dilute it into generic friendly UI? (2) does it capture a REAL HiFi UX win, not change for its own sake? (3) is it buildable as ONE focused PR? Flag over-scope (split it) or under-scope (merge it). If uncertain, default to skeptical. Return the verdict, concrete issues, and a revised effort.`,
    { label: `verify:${s.name}`, phase: 'Verify', schema: VERDICT_SCHEMA, model: 'opus', effort: 'high' }
  ).then((v) => {
    // reject a degenerate design/verdict before it enters the decomposition
    assertNotDegenerate({ ...design, verdict: v }, ['blendDesign'])
    return { ...design, screen: s.name, group: s.group, currentState: s.currentState, verdict: v }
  })
)

const good = planned.filter(Boolean)
log(`${good.length} screen designs planned + verified`)

phase('Decompose')
const decomposition = await agent(
  `Decompose these verified per-screen designs into EPICS, ISSUES and a PR order for the ScoreEasy brutalist x HiFi live-app upgrade.\n\nRules:\n- Put cross-cutting FOUNDATION work first (shared design tokens + component layer that blends brutalist identity with HiFi friendliness) so screens build on it.\n- Respect dependencies. Each issue = ONE focused PR.\n- Suggested priority arc: foundation -> high-traffic screens (home/pick/setup/scorers) -> spectator/live -> history/stats -> tournament/schedule -> settings.\n- Fold the known design-debt bugs into the relevant screen issues.\n- Include MISSING/stub screens as build issues.\n\nVerified screen designs:\n${JSON.stringify(good)}\n\nCross-cutting gaps: ${JSON.stringify((disco && disco.gaps) || [])}\n\nReturn epics (each: title, goal, rationale, member screens, issues[{title,type,priority,description,prBoundary,dependsOn,effort}]), a global prOrder (issue titles in build order), and a crossCutting list.`,
  { label: 'decompose', phase: 'Decompose', schema: DECOMPOSE_SCHEMA, model: 'opus', effort: 'high' }
)

return { discovery: disco, screenDesigns: good, decomposition }
