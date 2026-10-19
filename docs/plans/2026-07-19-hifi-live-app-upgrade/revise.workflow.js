export const meta = {
  name: 'hifi-revise',
  description: 'Revise the ScoreEasy upgrade plan: fix the 4 degenerate screens, reconcile kernel debt, recompose the decomposition folding Fable 10 revisions + 13 flow/IA directives, write master plan, Fable final vet',
  phases: [
    { title: 'Fixes', detail: 're-verify 4 screens + kernel-debt reconciliation' },
    { title: 'Recompose', detail: 'merge both evaluations into decomposition.v2' },
    { title: 'Master plan', detail: 'human-readable final plan' },
    { title: 'Vet', detail: 'Fable final coherence + go/no-go' },
  ],
}

const DIR = 'C:/Users/harsha_befach/Downloads/Volleyball/docs/plans/2026-07-19-hifi-live-app-upgrade'
const DECOMP = `${DIR}/decomposition.json`
const SCREENS = `${DIR}/screen-designs.json`
const FABLE = `${DIR}/fable-evaluation.md`
const FLOW = `${DIR}/flow-ia-evaluation.md`
const DISCOVERY = `${DIR}/discovery.json`

// --- degenerate-output guard (Fable pre-build fix #2) ------------------------
// This workflow exists to REPLACE degenerate ("placeholder"/"See above.") screen
// outputs; this guard throws loudly if a redo is STILL degenerate, so a rerun
// cannot silently re-file junk. Placeholder markers are rejected on ANY string;
// the <12-char check applies only to the passed narrativeKeys (valid short enums
// like scopeVerdict:'ok' pass). Usage: assertNotDegenerate(fix, ['blendDesign']).
function assertNotDegenerate(result, narrativeKeys = ['blendDesign', 'residual', 'validation', 'goal']) {
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

const SCREEN_FIX_SCHEMA = {
  type: 'object',
  properties: {
    screen: { type: 'string' },
    blendDesign: { type: 'string' },
    keepsBrutalist: { type: 'array', items: { type: 'string' } },
    adoptsHifi: { type: 'array', items: { type: 'string' } },
    verdict: {
      type: 'object',
      properties: {
        preservesBrutalistIdentity: { type: 'boolean' },
        capturesHifiUxWin: { type: 'boolean' },
        buildableAsOnePr: { type: 'boolean' },
        scopeVerdict: { type: 'string', enum: ['ok', 'too-big', 'too-small'] },
        issues: { type: 'array', items: { type: 'string' } },
        revisedEffort: { type: 'string', enum: ['S', 'M', 'L'] },
      },
      required: ['preservesBrutalistIdentity', 'capturesHifiUxWin', 'buildableAsOnePr', 'scopeVerdict', 'issues'],
    },
  },
  required: ['screen', 'blendDesign', 'verdict'],
}

const TO_FIX = [
  { screen: 'Goals scorer (football/basketball/hockey/handball/futsal/kabaddi/rugby)', why: 'verdict.issues was ["placeholder"] and its too-big flag is unbacked — needs a real adversarial verdict; this is the flagship 7-sport scorer.' },
  { screen: 'Generic live game view', why: 'design keepsBrutalist/adoptsHifi AND verdict were all "placeholder" — needs a real design + verdict; clarify its routing role vs the engine scorers.' },
  { screen: 'Your profile (account)', why: 'verdict.issues was ["placeholder"] and too-big flag unbacked — needs a real adversarial verdict.' },
  { screen: 'Tournament match score', why: 'blendDesign was literally "See above." — author the real design narrative; its 7 verdict issues are already valid.' },
]

phase('Fixes')
const fixes = await parallel([
  ...TO_FIX.map((f) => () => agent(
    `Re-do the per-screen blend design + adversarial verify for ONE ScoreEasy screen that the earlier workflow produced a DEGENERATE (placeholder) output for. Do real, file:line-grounded work — reject any placeholder.\n\nScreen: ${f.screen}\nWhy it needs redo: ${f.why}\n\nRead the screen's current entry in ${SCREENS} (find the object whose "screen" matches) and the relevant source under C:/Users/harsha_befach/Downloads/design1-mono — actually C:/Users/harsha_befach/Downloads/Volleyball/src/designs/design1-mono/. The app BLENDS its brutalist identity (pure-black ink+borders, hard 3px 3px 0-blur offset shadow, tight 4-8px radii, Inter + JetBrains Mono, uppercase mono micro-labels) with friendlier HiFi UX (rounded/circular scoring controls, plain-language prompts, soft green warmth) — preserve brutalism, do not dilute it; circular/soft elements are welcome inside scoring. Produce a concrete blendDesign narrative + keepsBrutalist + adoptsHifi + a real adversarial verdict (preservesBrutalistIdentity, capturesHifiUxWin, buildableAsOnePr, scopeVerdict, issues with file:line where possible, revisedEffort). If too-big, say concretely how to split.`,
    { label: `fix:${f.screen.split(' ')[0].toLowerCase()}`, phase: 'Fixes', schema: SCREEN_FIX_SCHEMA, model: 'opus', effort: 'high' }
  )),
  () => agent(
    `Kernel design-debt reconciliation for the ScoreEasy upgrade (Fable revision #5). The design-debt issues I-013/I-044/I-047/I-049/I-051/I-052/I-053/I-066/I-068/I-086 were migrated into the FORGE KERNEL (not beads — bd is empty). Several already have fix-comments shipped in code.\n\nDo this: (1) list the kernel issues via \`node C:/Users/harsha_befach/Downloads/forge/bin/forge.js issue list\` (and \`forge issue show <id>\` as needed) to find each I-xxx's current status; (2) grep the source under C:/Users/harsha_befach/Downloads/Volleyball/src/designs/design1-mono/ for fix-comments / evidence each is already resolved; (3) classify each I-xxx as ALREADY-FIXED (close/annotate, do not refile), PARTIAL (residual work only), or OPEN (needs full work). Also decide keep-vs-remove for I-068 (the green 4/6 cricket run-button accent). Write findings to ${DIR}/debt-reconciliation.md via the native Write tool.\n\nReturn a JSON summary object: {alreadyFixed:[ids], partial:[{id,residual}], open:[ids], i068Decision:string, docPath:string}.`,
    { label: 'debt-audit', phase: 'Fixes', model: 'opus', effort: 'high', schema: {
      type: 'object',
      properties: {
        alreadyFixed: { type: 'array', items: { type: 'string' } },
        partial: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, residual: { type: 'string' } }, required: ['id', 'residual'] } },
        open: { type: 'array', items: { type: 'string' } },
        i068Decision: { type: 'string' },
        docPath: { type: 'string' },
      },
      required: ['alreadyFixed', 'partial', 'open', 'i068Decision'],
    } }
  ),
])

// reject any redo that is STILL degenerate before it re-enters the plan
const screenFixes = fixes.filter(Boolean).filter((x) => x && x.screen).map((x) => assertNotDegenerate(x, ['blendDesign']))
const debt = fixes.filter(Boolean).find((x) => x && !x.screen) || {}
log(`fixed ${screenFixes.length} screens; debt: ${(debt.alreadyFixed || []).length} already-fixed, ${(debt.open || []).length} open`)

phase('Recompose')
const recompose = await agent(
  `You are recomposing the FINAL build plan for the ScoreEasy brutalist x HiFi live-app upgrade. Merge TWO evaluations plus screen fixes into one coherent decomposition. Opus subagents will build from this, one PR per issue.\n\nREAD FULLY:\n- ${DECOMP} — current decomposition (14 epics, 82 issues, prOrder, crossCutting).\n- ${FABLE} — senior design eval with 10 numbered revisions (apply ALL): fix placeholder screens (done, see below), add the dropped In-match menu issue, fix the prOrder violation (fixture ribbon pos35 depends on shell-extraction pos49), split the 6 self-admitted multi-PR issues, kernel-debt-verify-first, blend-governance contract in Foundation tokens issue, split BottomTabNav, declare milestones + a11y gate + worktree decision, fix findings nits.\n- ${FLOW} — flow/IA eval with 13 directives (apply ALL): 4-tab nav model (Home·[Play]·History+Stats·Profile/More) landing BEFORE social/live/teams; ship Result/FULL-TIME screen (D1, high priority); scorer safety consolidation (D2); live/spectator as ONE vertical-slice epic (D4); collapse start funnel to ~2 taps + break up MonoQuickMatch (D5); promote/demote/merge/CUT screens per IA; add missing connective screens; global back-stack/transition rules as a standing convention.\n- ${DISCOVERY} — the 60-screen map.\n\nScreen fixes (use these to replace the degenerate entries' effect on their issues):\n${JSON.stringify(screenFixes)}\n\nKernel-debt reconciliation: ${JSON.stringify(debt)} — do NOT create issues for alreadyFixed items; fold only 'open'/'partial' residuals into their screen issues.\n\nRECONCILE THE CONTRADICTION: flow/IA says delete NewUserFlow; the design eval says NewUserFlow is NOT an orphan (do-not-delete). Resolve conservatively — verify against code intent; default to KEEP-and-reconcile or gate, never blind-delete; state the decision.\n\nProduce decomposition.v2 as JSON and WRITE it to ${DIR}/decomposition.v2.json (native Write). Structure: { milestones:[{id:'M1'|'M2'|'M3', goal, epics:[titles]}], epics:[{title, goal, milestone, screens:[], issues:[{title,type,priority,description,prBoundary,dependsOn,effort,a11y}]}], prOrder:[issue titles in dependency-valid build order], crossCutting:[], navModel:string, backStackRules:[], blendGovernance:[], cutOrMergedScreens:[{screen,decision,rationale}], openQuestionsForUser:[] }. Ensure: every dependsOn appears earlier in prOrder; each issue = ONE PR; the six multi-PR issues are split; In-match menu issue exists before Share-QR; nav restructure epic precedes social/live/teams; Result screen is early (M1). Self-validate the graph before writing.\n\nReturn a JSON summary: {epics:number, issues:number, milestones:[{id,issues:number}], splitCount:number, cutCount:number, openQuestions:[strings], validation:string}.`,
  { label: 'recompose', phase: 'Recompose', model: 'opus', effort: 'high', schema: {
    type: 'object',
    properties: {
      epics: { type: 'number' },
      issues: { type: 'number' },
      milestones: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, issues: { type: 'number' } }, required: ['id', 'issues'] } },
      splitCount: { type: 'number' },
      cutCount: { type: 'number' },
      openQuestions: { type: 'array', items: { type: 'string' } },
      validation: { type: 'string' },
    },
    required: ['epics', 'issues', 'milestones', 'openQuestions', 'validation'],
  } }
)

phase('Master plan')
const master = await agent(
  `Write the human-readable MASTER PLAN for the ScoreEasy brutalist x HiFi live-app upgrade. Read ${DIR}/decomposition.v2.json and ${DISCOVERY}. Produce a clear markdown doc a person can read top-to-bottom in a terminal: (1) one-paragraph vision (best-of-both-worlds: brutalist identity + HiFi UX, simple + intuitive, seamless flows); (2) the navigation model + back-stack rules; (3) the blend-governance contract; (4) the milestones M1/M2/M3 with what ships in each and why; (5) per-epic: goal + the ordered issues (title · type · priority · effort · one-line prBoundary); (6) the full prOrder as a numbered build sequence; (7) screens cut/merged with rationale; (8) OPEN QUESTIONS FOR THE USER (product decisions: nav 6th-tab timing, any cuts, milestone scope). Write to ${DIR}/master-plan.md via native Write. Return {docPath, openQuestionCount}.`,
  { label: 'master-plan', phase: 'Master plan', model: 'opus', effort: 'high', schema: { type: 'object', properties: { docPath: { type: 'string' }, openQuestionCount: { type: 'number' } }, required: ['docPath'] } }
)

phase('Vet')
const vet = await agent(
  `You are Fable, senior design/orchestration director doing a FINAL coherence vet before this plan is filed into the kernel and built. Read ${DIR}/decomposition.v2.json and ${DIR}/master-plan.md. Check: did the recompose actually apply all 10 Fable revisions + all 13 flow/IA directives? Is the prOrder dependency-valid (every dependsOn earlier)? Are all six multi-PR issues split? Does the nav-restructure precede social/live/teams? Is Result/FULL-TIME in M1? Is the NewUserFlow contradiction resolved sanely? Any issue still >1 PR? Any dropped coverage? Give a final verdict READY-TO-FILE or NEEDS-ONE-MORE-PASS with a short numbered list of any residual fixes. Return {verdict, residualFixes:[strings], appliedFableRevisions:number, appliedFlowDirectives:number}.`,
  { label: 'fable-vet', phase: 'Vet', model: 'fable', effort: 'high', schema: {
    type: 'object',
    properties: {
      verdict: { type: 'string', enum: ['READY-TO-FILE', 'NEEDS-ONE-MORE-PASS'] },
      residualFixes: { type: 'array', items: { type: 'string' } },
      appliedFableRevisions: { type: 'number' },
      appliedFlowDirectives: { type: 'number' },
    },
    required: ['verdict', 'residualFixes'],
  } }
)

return { screenFixes, debt, recompose, master, vet }
