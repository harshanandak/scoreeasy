export const meta = {
  name: 'cricket-blend-eval',
  description: 'Evaluator loop: extract HiFi DNA + audit brutalism fit, define a blend rubric (where brutalism works vs where HiFi softness is needed), then improve all 3 cricket mockups via generate->critic->refine, Fable synthesizes the final blend',
  phases: [
    { title: 'Extract', detail: 'HiFi source DNA + brutalism-fit audit of current mockups' },
    { title: 'Rubric', detail: 'Fable: the blend rubric — brutalist vs HiFi by element class' },
    { title: 'Refine', detail: 'per mockup: improve -> critic -> refine v2' },
    { title: 'Judge', detail: 'Fable: synthesize the final cricket blend direction' },
  ],
}

const DIR = 'C:/Users/harsha_befach/Downloads/Volleyball/docs/plans/2026-07-20-icp-games/cricket'
const HIFI = 'C:/Users/harsha_befach/Downloads/ScoreEasy App Flow HiFi.dc.html'
const DIRECTIONS = 'C:/Users/harsha_befach/Downloads/Volleyball/prototype/directions-cricket.html'
// HARD CONSTRAINT threaded through every phase: take STRUCTURE / LAYOUT / INTERACTION
// inspiration from the reference files, but NEVER their colors. The palette stays our
// current minimal-brutalist token set (src/index.css --se-* + --se-blend-*).
const PALETTE_RULE = 'PALETTE IS FIXED: use ONLY our current minimal-brutalist tokens (--se-* and --se-blend-* from src/index.css). Take structure, layout, hierarchy, spacing, component and interaction inspiration from the reference files, but NEVER adopt their colors, gradients or color mood. No raw hex. If a reference idea depends on its own colors, re-express it in our palette or drop it.'
const APP = 'C:/Users/harsha_befach/Downloads/Volleyball/src/designs/design1-mono'
const GOV = `${APP}/BLEND-GOVERNANCE.md`
const SPEC = `${DIR}/cricket-spec-v2.md`

const MOCKUPS = [
  { key: 'guided', file: `${DIR}/cricket-ux-guided.html`, role: 'DEFAULT surface (casual/gully scorer)' },
  { key: 'keypad', file: `${DIR}/cricket-ux-keypad.html`, role: 'POWER-mode toggle (fast expert scorer)' },
  { key: 'zones', file: `${DIR}/cricket-ux-zones.html`, role: 'reference-only (dropped as entry mode; wagon-capture idea salvaged)' },
]

phase('Extract')
const extract = await parallel([
  () => agent(
    `Extract the VISUAL + INTERACTION DNA of the ScoreEasy HiFi reference that we should take inspiration from for the CRICKET live/scoring screens.\n\nSource: ${HIFI} — a ~697KB single-file design canvas of ~90 labelled phone frames. It is too big to read whole: analyze it in the sandbox (grep/script) and deep-sample the CRICKET frames (live, spectator, how-out, new batter, toss) plus the general live/score frames.\n\nFor those frames extract CONCRETELY: layout structure + hierarchy, the exact palette/hex usage, type treatment, radii, shadow style, spacing rhythm, chip/pill/card patterns, the friendly micro-copy voice, iconography, motion cues, and what makes them feel APPROACHABLE. Then state, per element class (page chrome/frame, score hero, scoring controls, status chips, sheets/dialogs, feedback/celebration, data tables), what the HiFi does that our brutalist app does NOT. Return {frames:[names sampled], dna:[concrete findings], perElementClass:[{elementClass, hifiApproach, whatWeLack}], sources:[]}.`,
    { label: 'extract:hifi', phase: 'Extract', model: 'opus', effort: 'high', schema: { type: 'object', properties: { frames: { type: 'array', items: { type: 'string' } }, dna: { type: 'array', items: { type: 'string' } }, perElementClass: { type: 'array', items: { type: 'object', properties: { elementClass: { type: 'string' }, hifiApproach: { type: 'string' }, whatWeLack: { type: 'string' } }, required: ['elementClass', 'hifiApproach'] } } }, required: ['dna', 'perElementClass'] } }
  ),
  () => agent(
    `Audit WHERE BRUTALISM HELPS AND WHERE IT HURTS in our current cricket mockups. The user's brief: "I love the brutalism but it is not suitable everywhere — we need a balance of both, blended properly."\n\nRead our design system ${GOV} and the three mockups: ${MOCKUPS.map((m) => m.file).join(', ')}. Also read the real app's cricket scorer ${APP}/scoring/MonoCricketLiveScore.jsx for the shipped baseline.\n\nFor EACH element class (page chrome/frame, score hero + numerals, scoring controls/keypad, status + context chips, bottom sheets/dialogs, feedback + celebration moments, data tables/scorecard, empty/help states, spectator view): judge whether the hard brutalist treatment (pure-black hairlines, 3px 3px 0 offset shadow, tight 4-8px radii, uppercase mono) HELPS legibility/speed/identity, or HURTS (feels harsh, cramped, cold, unfriendly, hard to scan, intimidating for a casual gully scorer). Be specific and honest — cite what in the mockups reads badly. Return {perElementClass:[{elementClass, brutalismVerdict:'helps|hurts|mixed', evidence, recommendation}], worstOffenders:[], bestUses:[]}.`,
    { label: 'extract:fit', phase: 'Extract', model: 'opus', effort: 'high', schema: { type: 'object', properties: { perElementClass: { type: 'array', items: { type: 'object', properties: { elementClass: { type: 'string' }, brutalismVerdict: { type: 'string', enum: ['helps', 'hurts', 'mixed'] }, evidence: { type: 'string' }, recommendation: { type: 'string' } }, required: ['elementClass', 'brutalismVerdict', 'recommendation'] } }, worstOffenders: { type: 'array', items: { type: 'string' } }, bestUses: { type: 'array', items: { type: 'string' } } }, required: ['perElementClass', 'worstOffenders', 'bestUses'] } }
  ),
  () => agent(
    `Mine a second cricket design reference for STRUCTURE and INTERACTION ideas only.\n\nSource: ${DIRECTIONS} (a prototype "directions" page exploring cricket screen concepts).\n\n${PALETTE_RULE}\n\nExtract: the layout concepts, information hierarchy, component patterns, scoring-control arrangements, data-density choices, and any interaction ideas worth stealing for our cricket scorer/spectator. For each idea, state explicitly how to re-express it in OUR minimal-brutalist palette. Call out anything that is ONLY good because of its colors (and therefore should be dropped). Return {ideas:[{idea, whereItApplies, howToReexpressInOurPalette}], dropBecauseColorDependent:[]}.`,
    { label: 'extract:directions', phase: 'Extract', model: 'opus', effort: 'high', schema: { type: 'object', properties: { ideas: { type: 'array', items: { type: 'object', properties: { idea: { type: 'string' }, whereItApplies: { type: 'string' }, howToReexpressInOurPalette: { type: 'string' } }, required: ['idea', 'whereItApplies'] } }, dropBecauseColorDependent: { type: 'array', items: { type: 'string' } } }, required: ['ideas'] } }
  ),
])
const [hifiDna, fitAudit, directionsIdeas] = extract

phase('Rubric')
const rubric = await agent(
  `You are Fable. Define THE BLEND RUBRIC for ScoreEasy — the principled rule for WHERE the brutalist identity applies and WHERE HiFi softness takes over. The user loves brutalism but says it is not suitable everywhere and wants a proper balance, not a dilution.\n\nHiFi DNA to draw from:\n${JSON.stringify(hifiDna)}\n\nBrutalism fit audit (where it helps/hurts today):\n${JSON.stringify(fitAudit)}\n\nSecond reference (structure/interaction ideas, colors deliberately excluded):\n${JSON.stringify(directionsIdeas)}\n\n${PALETTE_RULE}\n\nCurrent governance: read ${GOV}.\n\nProduce a decisive rubric: for EACH element class, state BRUTALIST / HIFI-SOFT / HYBRID with the reasoning, and give the concrete treatment (borders, radii, shadow, type, color, motion). Anchor it on a memorable principle (e.g. "hard structure, soft interaction" / "brutalist bones, friendly flesh") that a build agent can apply without re-deciding. Include: what must NEVER lose brutalism (identity anchors), what must ALWAYS be soft (touch targets, feedback, guidance, empty states), and the tie-breaker when they conflict. Write it to ${DIR}/blend-rubric.md (native Write). Return {principle, perElementClass:[{elementClass, treatment:'brutalist|hifi-soft|hybrid', spec}], neverLoseBrutalism:[], alwaysSoft:[], tieBreaker, docPath}.`,
  { label: 'fable-rubric', phase: 'Rubric', model: 'fable', effort: 'high', schema: { type: 'object', properties: { principle: { type: 'string' }, perElementClass: { type: 'array', items: { type: 'object', properties: { elementClass: { type: 'string' }, treatment: { type: 'string', enum: ['brutalist', 'hifi-soft', 'hybrid'] }, spec: { type: 'string' } }, required: ['elementClass', 'treatment', 'spec'] } }, neverLoseBrutalism: { type: 'array', items: { type: 'string' } }, alwaysSoft: { type: 'array', items: { type: 'string' } }, tieBreaker: { type: 'string' }, docPath: { type: 'string' } }, required: ['principle', 'perElementClass', 'neverLoseBrutalism', 'alwaysSoft'] } }
)

phase('Refine')
const refined = await pipeline(
  MOCKUPS,
  (m) => agent(
    `IMPROVE one cricket mockup by applying the blend rubric + HiFi inspiration. This is round 1 of a generate->critic->refine loop.\n\nMockup: ${m.file} (role: ${m.role})\nBlend rubric (authoritative): ${JSON.stringify(rubric)}\nHiFi DNA to draw inspiration from: ${JSON.stringify(hifiDna)}\nSecond reference ideas (structure/interaction only): ${JSON.stringify(directionsIdeas)}\nLocked cricket design: read ${SPEC}.\n\n${PALETTE_RULE}\n\nRewrite the mockup so brutalism is kept exactly where the rubric says (identity anchors) and HiFi softness takes over where the rubric says (touch targets, feedback, guidance, celebration, empty/help states). It must feel WARMER and more approachable without losing the brutalist bones. Keep the same content/state (the canonical demo match) and the same functional layout intent — this is a visual+interaction blend improvement, not a redesign of the flow. Write the improved file to ${DIR}/cricket-ux-${m.key}-v2.html (self-contained, mobile 420px, inline styles mirroring our tokens, no external resources, reduced-motion respected). Return {key:'${m.key}', changes:[what you changed and why, per element class], path}.`,
    { label: `improve:${m.key}`, phase: 'Refine', model: 'opus', effort: 'high', schema: { type: 'object', properties: { key: { type: 'string' }, changes: { type: 'array', items: { type: 'string' } }, path: { type: 'string' } }, required: ['key', 'changes', 'path'] } }
  ),
  (r, m) => agent(
    `CRITIC round: evaluate the improved cricket mockup ${DIR}/cricket-ux-${m.key}-v2.html against the blend rubric and the original ${m.file}.\n\nRubric: ${JSON.stringify(rubric)}\n\nJudge honestly: (1) BALANCE — is brutalism kept where it must be and softened where it must be, or did it drift generic/diluted OR stay too harsh? (2) WARMTH — would a casual Indian school/gully scorer find this approachable? (3) IDENTITY — is it still unmistakably ScoreEasy brutalist at the bones? (4) USABILITY — legibility, tap targets, scannability at arm's length in sunlight. (5) HiFi INSPIRATION — did it actually adopt the reference's approachability or just round some corners? Give ranked, concrete fixes. Return {key:'${m.key}', balance, warmth, identity, usability, rankedFixes:[], verdict}.`,
    { label: `critic:${m.key}`, phase: 'Refine', model: 'opus', effort: 'high', schema: { type: 'object', properties: { key: { type: 'string' }, balance: { type: 'string' }, warmth: { type: 'string' }, identity: { type: 'string' }, usability: { type: 'string' }, rankedFixes: { type: 'array', items: { type: 'string' } }, verdict: { type: 'string' } }, required: ['key', 'rankedFixes', 'verdict'] } }
  ),
  (c, m) => agent(
    `REFINE round: apply the critic's ranked fixes to ${DIR}/cricket-ux-${m.key}-v2.html, overwriting it in place (native Write/Edit).\n\nCritic: ${JSON.stringify(c)}\nRubric: ${JSON.stringify(rubric)}\n\nApply every ranked fix that is valid; if a fix would break the rubric or the locked spec, skip it and say why. Keep the file self-contained, mobile 420px, no external resources, reduced-motion respected. Return {key:'${m.key}', applied:[], skipped:[], path}.`,
    { label: `refine:${m.key}`, phase: 'Refine', model: 'opus', effort: 'high', schema: { type: 'object', properties: { key: { type: 'string' }, applied: { type: 'array', items: { type: 'string' } }, skipped: { type: 'array', items: { type: 'string' } }, path: { type: 'string' } }, required: ['key', 'applied', 'path'] } }
  )
)

phase('Judge')
const judge = await agent(
  `You are Fable. The three cricket mockups have been improved through a generate->critic->refine loop against the blend rubric. Synthesize the FINAL cricket blend direction.\n\nRubric: ${JSON.stringify(rubric)}\nRefine results: ${JSON.stringify((refined || []).filter(Boolean))}\n\nRead the refined files ${DIR}/cricket-ux-guided-v2.html and ${DIR}/cricket-ux-keypad-v2.html (the shipping pair; zones-v2 is reference-only).\n\nDeliver: (1) a verdict on whether the blend is now RIGHT — brutalist bones + friendly flesh, balanced, warm enough for a gully scorer, still unmistakably ours; (2) any remaining gaps; (3) the FINAL locked cricket visual direction (what Guided and Power each look like, how they share the system); (4) how this rubric propagates to the OTHER Tier-0 games (kabaddi, volleyball, badminton, football, basketball, throwball, kho-kho) so every per-game workflow inherits it rather than re-deciding; (5) any updates needed to ${GOV} and ${SPEC}. Write to ${DIR}/cricket-blend-final.md (native Write). Return {verdict, remainingGaps:[], finalDirection, propagation:[], govUpdates:[], docPath, bottomLine}.`,
  { label: 'fable-judge', phase: 'Judge', model: 'fable', effort: 'high', schema: { type: 'object', properties: { verdict: { type: 'string' }, remainingGaps: { type: 'array', items: { type: 'string' } }, finalDirection: { type: 'string' }, propagation: { type: 'array', items: { type: 'string' } }, govUpdates: { type: 'array', items: { type: 'string' } }, docPath: { type: 'string' }, bottomLine: { type: 'string' } }, required: ['verdict', 'finalDirection', 'propagation', 'bottomLine'] } }
)

return { hifiDna, fitAudit, rubric, refined: (refined || []).filter(Boolean), judge }
