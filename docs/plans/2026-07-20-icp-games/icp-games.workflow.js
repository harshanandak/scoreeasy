export const meta = {
  name: 'icp-games',
  description: 'ICP-driven sport prioritization for ScoreEasy (India schools/colleges/ground play): research the game universe, gap-analyze vs the current 15 sports, Fable synthesizes priority tiers + plan reshape',
  phases: [
    { title: 'Research', detail: 'multi-angle research of Indian school/college/ground sports' },
    { title: 'Gap analysis', detail: 'current registry vs the ICP game universe' },
    { title: 'Synthesis', detail: 'Fable: priority tiers + add/fix/park + plan reshape' },
  ],
}

const DIR = 'C:/Users/harsha_befach/Downloads/Volleyball/docs/plans/2026-07-20-icp-games'

const CURRENT = `Current ScoreEasy sports (src/models/sportRegistry.js on master), by scoring engine:
- sets engine (win-by-2 to target, best-of sets): volleyball, badminton, tabletennis, tennis, pickleball, squash
- goals engine (increment counter + periods/timer): football, basketball, hockey, handball, futsal, KABADDI, rugby
- custom-cricket engine (ball-by-ball): cricket
Note: kabaddi is currently mapped to the generic 'goals' engine. Kho kho is NOT present.`

const RESEARCH_LENSES = [
  { key: 'schools', q: 'What sports do INDIAN SCHOOLS play/compete in — SGFI disciplines, CBSE/state school games, sports days, and notably girls\' sports (throwball, kho kho, langdi). Which are most widespread by participation, not prestige?' },
  { key: 'colleges', q: 'What sports do INDIAN COLLEGES / universities play — inter-college, university championships, Khelo India University Games, hostel/campus culture. Where do basketball, volleyball, football, cricket, kabaddi rank by real participation?' },
  { key: 'ground', q: 'What do ordinary Indians actually play CASUALLY on grounds/maidans/parks/streets — gully/box/tennis-ball cricket, and pick-up volleyball, badminton, football, kabaddi, kho kho. What informal scoring variants exist (box cricket rules, street formats)?' },
  { key: 'scoring', q: 'For each candidate Indian ground/school sport (esp. KHO KHO, KABADDI, THROWBALL, and any others found), describe its EXACT scoring/format model. Which need a bespoke engine vs fit a generic sets(win-by-2) / goals(counter) / cricket(ball-by-ball) engine? Kho kho = innings/turns, chasing vs defending, outs, dream run, time-based; kabaddi = raid/tackle points, all-out +2, 30s raid clock, empty/super raids, bonus.' },
]

const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    lens: { type: 'string' },
    games: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          segment: { type: 'string', description: 'schools | colleges | casual-ground | all' },
          participationNote: { type: 'string', description: 'how widespread, evidence' },
          scoringModel: { type: 'string' },
          engineFit: { type: 'string', description: 'sets | goals | cricket | NEEDS-BESPOKE | unknown' },
        },
        required: ['name', 'segment', 'engineFit'],
      },
    },
    sources: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['lens', 'games'],
}

phase('Research')
const research = await parallel(RESEARCH_LENSES.map((L) => () =>
  agent(
    `Research question (India-first, ScoreEasy is a sports-scoring app): ${L.q}\n\nUse web search (WebSearch and/or ctx_fetch_and_index) and CITE sources. Be evidence-based about PARTICIPATION/popularity, not just official status. Return a structured list of games with segment, a participation note, the scoring model, and whether each fits a generic engine (sets = racket/net win-by-2 to target; goals = increment counter with periods; cricket = ball-by-ball) or NEEDS-BESPOKE. Include lesser-known but widely-played school/ground games (throwball, kho kho, langdi, etc.) if the evidence supports them.`,
    { label: `research:${L.key}`, phase: 'Research', schema: RESEARCH_SCHEMA, model: 'opus', effort: 'high' }
  )
))

const found = (research || []).filter(Boolean)
log(`research done: ${found.length} lenses`)

phase('Gap analysis')
const gap = await agent(
  `Do a coverage GAP ANALYSIS for ScoreEasy against the India-first ICP (schools + colleges + casual ground play).\n\n${CURRENT}\n\nResearch findings (all lenses):\n${JSON.stringify(found)}\n\nProduce: (1) a consolidated ICP GAME UNIVERSE (dedup the researched games), each tagged with ICP relevance (high/med/low for this ICP) + segment; (2) for each, its CURRENT STATUS in ScoreEasy: SUPPORTED-WELL / MIS-SERVED (present but wrong engine — e.g. kabaddi on goals) / MISSING / OVER-INVESTED-FOR-ICP (present but low ICP relevance, e.g. possibly rugby/futsal/handball/squash/pickleball); (3) the ENGINE need per missing/mis-served game (fits existing engine vs needs bespoke, with the scoring model). Be concrete and evidence-anchored. Return JSON.`,
  { label: 'gap', phase: 'Gap analysis', model: 'opus', effort: 'high', schema: {
    type: 'object',
    properties: {
      universe: { type: 'array', items: { type: 'object', properties: {
        game: { type: 'string' }, icpRelevance: { type: 'string', enum: ['high', 'medium', 'low'] },
        segment: { type: 'string' },
        status: { type: 'string', enum: ['supported-well', 'mis-served', 'missing', 'over-invested-for-icp'] },
        engineNeed: { type: 'string' },
      }, required: ['game', 'icpRelevance', 'status'] } },
      missing: { type: 'array', items: { type: 'string' } },
      misServed: { type: 'array', items: { type: 'string' } },
      overInvested: { type: 'array', items: { type: 'string' } },
    },
    required: ['universe', 'missing', 'misServed', 'overInvested'],
  } }
)

phase('Synthesis')
const synthesis = await agent(
  `You are Fable, senior product strategist. Decide ScoreEasy's SPORT PRIORITY for an India-first ICP: Indian schools, colleges, and people who play on grounds/maidans. ScoreEasy customizes each sport's scoring experience, so priority determines where build effort goes.\n\n${CURRENT}\n\nGap analysis:\n${JSON.stringify(gap)}\n\nResearch (for grounding):\n${JSON.stringify(found)}\n\nDeliver a markdown strategy doc to ${DIR}/icp-game-strategy.md with: (1) a crisp ICP statement + the core "who plays what" picture; (2) SPORT PRIORITY TIERS — Tier-0 core (must be first-class, e.g. cricket/kabaddi/volleyball/badminton/football + basketball for colleges), Tier-1, and PARK/deprioritize (low-ICP niche); justify each from participation evidence; (3) GAMES TO ADD (esp. kho kho — with its bespoke engine sketch: innings/turns, chase vs defend, outs, dream run, time), and whether throwball/langdi/others make the cut; (4) GAMES TO FIX — kabaddi off the generic goals engine onto a proper raid/tackle engine (raid points, tackle points, all-out +2, 30s raid clock, empty/super raid, bonus) — engine sketch; (5) GAMES TO PARK — which niche sports to freeze polish on (and whether to keep them listed or hide); (6) PER-GAME CUSTOMIZATION needs for the Tier-0 set; (7) HOW THIS RESHAPES THE PLAN — concrete kernel actions: new epics/issues (kho-kho engine, kabaddi engine), reprioritize/park the niche scorer-residual issues, and where in M1/M2/M3 this lands. Be decisive and evidence-anchored; this changes build priority.\n\nReturn JSON: {icpOneLine, tier0:[games], add:[games], fix:[games], park:[games], kernelActions:[strings], docPath}.`,
  { label: 'fable-strategy', phase: 'Synthesis', model: 'fable', effort: 'high', schema: {
    type: 'object',
    properties: {
      icpOneLine: { type: 'string' },
      tier0: { type: 'array', items: { type: 'string' } },
      add: { type: 'array', items: { type: 'string' } },
      fix: { type: 'array', items: { type: 'string' } },
      park: { type: 'array', items: { type: 'string' } },
      kernelActions: { type: 'array', items: { type: 'string' } },
      docPath: { type: 'string' },
    },
    required: ['icpOneLine', 'tier0', 'add', 'fix', 'park', 'kernelActions'],
  } }
)

return { research: found, gap, synthesis }
