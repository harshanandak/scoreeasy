import { useState, useMemo, useRef, useEffect } from 'react';
import {
  makeFormat,
  createInnings,
  makeDelivery,
  applyDelivery,
  editDelivery,
  undo as undoInnings,
  changeStrike,
  applyRetire,
  retiredBatters,
  changeBowler,
  canBowl,
  deriveInnings,
  deriveChase,
  oversString,
  isLegalDelivery,
} from '../../../utils/cricketEngine.js';
import WicketSheet from './WicketSheet.jsx';
import PlayerPickerSheet from './PlayerPickerSheet.jsx';

// C3/C4 Guided cricket scorer. Pure component: the live innings is engine state
// held in React; EVERY stat is derived from deriveInnings/deriveChase — nothing is
// hand-counted. No routing / localStorage / Convex in this slice.

// Accept a player as a bare string id/name, or an object { id, name }.
function normPlayer(p) {
  if (p && typeof p === 'object') {
    const id = p.id ?? p.name;
    return { id, name: p.name ?? p.id ?? id };
  }
  return { id: p, name: p };
}

// Per-ball pip for the "this over" strip (color four/six/wicket per mockup).
function pipFor(d) {
  if (d.wicket) return { label: 'W', cls: 'mono-over-pip-wicket' };
  const extras = d.extras || [];
  const wide = extras.filter((e) => e.type === 'wide').reduce((s, e) => s + e.runs, 0);
  const nb = extras.filter((e) => e.type === 'no-ball').reduce((s, e) => s + e.runs, 0);
  if (wide) return { label: wide > 1 ? `${wide}wd` : 'wd', cls: '' };
  if (nb) return { label: nb > 1 ? `${nb}nb` : 'nb', cls: '' };
  if (d.batsmanRuns === 4) return { label: '4', cls: 'mono-over-pip-four' };
  if (d.batsmanRuns === 6) return { label: '6', cls: 'mono-over-pip-six' };
  const bye = extras
    .filter((e) => e.type === 'bye' || e.type === 'leg-bye')
    .reduce((s, e) => s + e.runs, 0);
  const suffix = extras.some((e) => e.type === 'leg-bye') ? 'lb' : 'b';
  const r = (d.batsmanRuns || 0) + bye;
  if (r === 0) return { label: '·', cls: '' };
  return { label: bye > 0 ? `${r}${suffix}` : String(r), cls: '' };
}

export default function MonoCricketGuidedScorer({
  format,
  striker,
  nonStriker,
  bowler,
  target = null,
  initialInnings = null,
  squad = null,
  onStateChange,
  onComplete,
}) {
  const fmt = useMemo(() => makeFormat(format || {}), [format]);
  const bpo = fmt.ballsPerOver || 6;

  const s0 = useMemo(() => normPlayer(striker), [striker]);
  const ns0 = useMemo(() => normPlayer(nonStriker), [nonStriker]);
  const b0 = useMemo(() => normPlayer(bowler), [bowler]);

  // Rehydrate a saved innings when provided (route persistence bridge); otherwise
  // start a fresh innings from the seeded openers/format.
  const [innings, setInnings] = useState(() =>
    initialInnings ??
    createInnings({
      striker: s0.id,
      nonStriker: ns0.id,
      bowler: b0.id,
      target: target ?? null,
      playersPerSide: fmt.playersPerSide,
    })
  );

  const [mode, setMode] = useState('guided'); // 'guided' | 'power'
  const [sheetOpen, setSheetOpen] = useState(false);

  // C6 sheet state.
  const [wicketOpen, setWicketOpen] = useState(false);
  // batterPicker: { ctx:'wicket'|'mankad'|'retire', index?, batter?, mode? } | null
  const [batterPicker, setBatterPicker] = useState(null);
  const [bowlerOpen, setBowlerOpen] = useState(false);
  const [retireCfg, setRetireCfg] = useState(null); // { end, mode } | null
  const [penaltyN, setPenaltyN] = useState(5);
  const [toast, setToast] = useState('');
  // Names learned from picks (incoming batters / new bowlers) so the UI can label
  // ids that were never in the seeded trio.
  const [extraNames, setExtraNames] = useState({});
  // Highest completed-over index we've already prompted a bowler change for.
  const overPrompted = useRef(0);

  // Name lookup for the three seeded pointers + anyone picked later.
  const nameMap = useMemo(
    () => ({ [s0.id]: s0.name, [ns0.id]: ns0.name, [b0.id]: b0.name }),
    [s0, ns0, b0]
  );
  const nameOf = (id) => nameMap[id] ?? extraNames[id] ?? id ?? '—';
  const learnName = (p) => setExtraNames((m) => ({ ...m, [p.id]: p.name ?? p.id }));

  const der = useMemo(() => deriveInnings(innings, fmt), [innings, fmt]);
  const chase = useMemo(() => deriveChase(innings, fmt), [innings, fmt]);

  // Fire onStateChange after each committed ball (skip the initial mount).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    onStateChange?.(innings);
  }, [innings]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire onComplete once when the innings ends (all out / overs done / chased).
  const completed = useRef(false);
  useEffect(() => {
    if (completed.current) return;
    const allOut = der.wkts >= (innings.playersPerSide || 11) - 1;
    const oversDone = der.legalBalls >= (fmt.oversPerInnings || 0) * bpo && (fmt.oversPerInnings || 0) > 0;
    const chased = innings.target != null && der.runs >= innings.target;
    if (allOut || oversDone || chased) {
      completed.current = true;
      onComplete?.({ innings, ...der, reason: chased ? 'chased' : allOut ? 'allout' : 'overs' });
    }
  }, [der.wkts, der.legalBalls, der.runs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss the inline toast.
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- engine actions ----
  // Open the quota-aware bowler picker when a legal ball has just closed an over.
  const maybePromptBowler = (nextInn) => {
    const lb = deriveInnings(nextInn, fmt).legalBalls;
    const co = Math.floor(lb / bpo);
    if (lb > 0 && lb % bpo === 0 && overPrompted.current < co && !completed.current) {
      overPrompted.current = co;
      setBowlerOpen(true);
    }
  };

  // Commit a normal delivery from the live innings; surface a rejection as a toast
  // (the engine THROWS on illegal dismissals) instead of only console.warn.
  const apply = (delivery, { overPrompt = true } = {}) => {
    let next;
    try {
      next = applyDelivery(innings, delivery, fmt);
    } catch (e) {
      setToast(e.message);
      return null;
    }
    setInnings(next);
    if (overPrompt) maybePromptBowler(next);
    return next;
  };

  const scoreRuns = (n) => apply(makeDelivery({ batsmanRuns: n }));
  const scoreExtra = (type, runs = 1) => apply(makeDelivery({ extras: [{ type, runs }] }));

  const playersPerSide = innings.playersPerSide || 11;

  // Batter-picker options: squad batters not already batting / out; retire also
  // offers resumable (retired-hurt/rotate) batters up top.
  const batterOptions = (ctx) => {
    const onField = new Set([innings.striker, innings.nonStriker].filter(Boolean));
    const outIds = new Set(
      Object.entries(der.batters).filter(([, b]) => b.out).map(([id]) => id)
    );
    const base = (squad?.batting || [])
      .map(normPlayer)
      .filter((p) => !onField.has(p.id) && !outIds.has(p.id));
    if (ctx === 'retire') {
      const resume = retiredBatters(innings).map((r) => ({
        id: r.batter,
        name: `Resume ${nameOf(r.batter)}`,
      }));
      return [...resume, ...base.filter((p) => !resume.some((r) => r.id === p.id))];
    }
    return base;
  };

  // Bowler-picker options: squad bowlers (or those already seen), each flagged with
  // canBowl — over-quota shows "quota", consecutive-over shows "consec.".
  const bowlerOptions = () => {
    const seen = new Set(Object.keys(der.bowlers));
    seen.add(b0.id);
    const list = squad?.bowling?.length
      ? squad.bowling.map(normPlayer)
      : [...seen].map((id) => ({ id, name: nameOf(id) }));
    return list.map((p) => {
      const ok = canBowl(innings, p.id, fmt);
      let reason = '';
      if (!ok) {
        const balls = innings.deliveries.reduce(
          (n, d) => n + (isLegalDelivery(d) && d.bowler === p.id ? 1 : 0), 0);
        const overs = Math.floor(balls / bpo);
        reason = fmt.maxOversPerBowler != null && overs >= fmt.maxOversPerBowler
          ? 'quota' : 'consec.';
      }
      return { id: p.id, name: p.name, disabled: !ok, reason };
    });
  };

  // Wicket: apply immediately with incoming=null (so the wkt lands now), then open
  // the new-batter picker unless the innings is all out; the pick is injected back
  // into the just-applied delivery via editDelivery.
  const onWicketConfirm = (w) => {
    setWicketOpen(false);
    const wicket = { ...w, bowler: innings.bowler, incoming: null, onFreeHit: innings.freeHit };
    let next;
    try {
      next = applyDelivery(innings, makeDelivery({ wicket }), fmt);
    } catch (e) {
      setToast(e.message);
      return;
    }
    setInnings(next);
    const idx = next.deliveries.length - 1;
    const wkts = deriveInnings(next, fmt).wkts;
    if (wkts < playersPerSide - 1) {
      setBatterPicker({ ctx: 'wicket', index: idx });
    } else {
      maybePromptBowler(next); // last wkt could still close an over
    }
  };

  // Mankad: run out the non-striker before the ball; same apply-then-inject flow.
  const doMankad = () => {
    setSheetOpen(false);
    const wicket = { type: 'mankad', out: innings.nonStriker, bowler: innings.bowler, incoming: null };
    let next;
    try {
      next = applyDelivery(innings, makeDelivery({ wicket }), fmt);
    } catch (e) {
      setToast(e.message);
      return;
    }
    setInnings(next);
    const idx = next.deliveries.length - 1;
    if (deriveInnings(next, fmt).wkts < playersPerSide - 1) {
      setBatterPicker({ ctx: 'mankad', index: idx });
    }
  };

  const onBatterPick = (player) => {
    const ctx = batterPicker;
    setBatterPicker(null);
    learnName(player);
    if (!ctx) return;
    if (ctx.ctx === 'retire') {
      try {
        setInnings(applyRetire(innings, { batter: ctx.batter, mode: ctx.mode, incoming: player.id }, fmt));
      } catch (e) {
        setToast(e.message);
      }
      return;
    }
    // wicket / mankad: inject the incoming batter into the stored delivery + replay.
    const orig = innings.deliveries[ctx.index];
    try {
      const { diff, ...ni } = editDelivery(
        innings, ctx.index, { wicket: { ...orig.wicket, incoming: player.id } }, fmt
      );
      setInnings(ni);
      maybePromptBowler(ni);
    } catch (e) {
      setToast(e.message);
    }
  };

  const onBowlerPick = (player) => {
    setBowlerOpen(false);
    if (!canBowl(innings, player.id, fmt)) {
      setToast('Bowler not eligible (quota / consecutive over)');
      return;
    }
    setInnings(changeBowler(innings, player.id));
    learnName(player);
  };

  const doUndo = () => {
    completed.current = false;
    const next = undoInnings(innings);
    setInnings(next);
    const co = Math.floor(deriveInnings(next, fmt).legalBalls / bpo);
    if (co < overPrompted.current) overPrompted.current = co;
    setWicketOpen(false);
  };

  // SWAP: engine-authoritative ball-free strike change (a correction, not a ball).
  const swapStrike = () => setInnings((prev) => changeStrike(prev));

  // ⋯More sheet actions
  const doDeadBall = () => {
    setSheetOpen(false);
    apply(makeDelivery({ deadBall: true }), { overPrompt: false });
  };
  const doPenalty = (n = penaltyN) => {
    setSheetOpen(false);
    apply(makeDelivery({ extras: [{ type: 'penalty', runs: Number(n) || 0 }] }));
  };
  const startRetirePick = () => {
    const end = retireCfg?.end || 'striker';
    const batter = end === 'striker' ? innings.striker : innings.nonStriker;
    const mode = retireCfg?.mode || 'hurt';
    setRetireCfg(null);
    setSheetOpen(false);
    setBatterPicker({ ctx: 'retire', batter, mode });
  };
  const openBowlerPicker = () => {
    setSheetOpen(false);
    setBowlerOpen(true);
  };
  const endInnings = () => {
    setSheetOpen(false);
    onComplete?.({ innings, ...der, reason: 'manual-innings' });
  };
  const endMatch = () => {
    setSheetOpen(false);
    onComplete?.({ innings, ...der, reason: 'manual-match' });
  };

  // ---- derived view data ----
  const currentOverNo = Math.floor(der.legalBalls / bpo) + 1;
  const overDeliveries = innings.deliveries.filter(
    (d) => d.overNo === currentOverNo && !d.deadBall && !d.retire
  );
  const legalInOver = overDeliveries.filter(isLegalDelivery).length;
  const emptySlots = Math.max(0, bpo - legalInOver);

  const sBat = der.batters[innings.striker] || { R: 0, B: 0 };
  const nsBat = der.batters[innings.nonStriker] || { R: 0, B: 0 };
  const bowlFig = der.bowlers[innings.bowler] || { O: '0', M: 0, R: 0, W: 0 };

  const hasTarget = innings.target != null;
  const progressPct = hasTarget
    ? Math.min(100, (der.runs / Math.max(1, innings.target)) * 100)
    : Math.min(100, ((fmt.oversPerInnings || 0) * bpo ? der.legalBalls / ((fmt.oversPerInnings || 0) * bpo) : 0) * 100);

  return (
    <div className="mono-scorer-screen">
      <style>{STYLES}</style>
      <div className="mono-scorer-shell">
        <h1 className="sr-only">Cricket match scorer</h1>

        {/* Top bar: back · title/sub · Guided⇄Power toggle · live */}
        <div className="mono-scorer-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span className="ck-icon" aria-hidden="true">{'‹'}</span>
            <div style={{ minWidth: 0 }}>
              <div className="ck-topbar-title">{fmt.name ? fmt.name.toUpperCase() : 'Match'}</div>
              <div className="ck-topbar-sub">
                Over {oversString(der.legalBalls, bpo)}
                {hasTarget ? ` · Chasing ${innings.target}` : ''}
              </div>
            </div>
          </div>
          <div className="mono-scorer-topbar-actions">
            <div className="ck-mode" role="group" aria-label="Scorer mode">
              <button
                type="button"
                className={`ck-mode-btn${mode === 'guided' ? ' on' : ''}`}
                aria-pressed={mode === 'guided'}
                onClick={() => setMode('guided')}
              >
                Guided
              </button>
              <button
                type="button"
                className={`ck-mode-btn${mode === 'power' ? ' on' : ''}`}
                aria-pressed={mode === 'power'}
                onClick={() => setMode('power')}
              >
                Power
              </button>
            </div>
            <span className="mono-badge mono-badge-live">Live</span>
          </div>
        </div>

        {/* HERO — flat black, score + overs/CRR, chase bar, NEED/RRR */}
        <div className="ck-hero">
          <div className="ck-hero-top">
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span className="ck-hero-score mono-score" data-testid="hero-score">
                {der.runs}
                <span className="wk">/{der.wkts}</span>
              </span>
              <span className="ck-hero-ov">({der.overs})</span>
            </div>
            <span className="ck-hero-crr">
              {innings.freeHit ? (
                <span className="ck-freehit" data-testid="freehit-badge">FREE HIT</span>
              ) : null}
              CRR {chase.CRR.toFixed(2)}
            </span>
          </div>
          <div className="ck-hero-bar"><i style={{ width: `${progressPct}%` }} /></div>
          {hasTarget ? (
            <div className="ck-hero-chase" data-testid="chase-need">
              <span>
                NEED <b className="need">{chase.runsNeeded}</b> OFF <b>{chase.ballsLeft}</b>
              </span>
              <span>RRR <b>{chase.RRR.toFixed(2)}</b></span>
            </div>
          ) : null}
        </div>

        {mode === 'power' ? (
          <div className="ck-power-ph" data-testid="power-placeholder">
            Power mode — coming next
          </div>
        ) : (
          <>
            {/* PLAYERS — striker | non-striker | bowler */}
            <div className="ck-players">
              <div className="ck-player">
                <div className="ck-player-name" data-testid="striker-name">
                  <span className="dot">{'●'}</span>{nameOf(innings.striker)}
                </div>
                <div className="ck-player-fig">{sBat.R} ({sBat.B})</div>
              </div>
              <div className="ck-player">
                <div className="ck-player-name sub" data-testid="nonstriker-name">
                  {nameOf(innings.nonStriker)}
                </div>
                <div className="ck-player-fig">{nsBat.R} ({nsBat.B})</div>
              </div>
              <div className="ck-player">
                <div className="ck-player-name sub">{nameOf(innings.bowler)} {'◢'}</div>
                <div className="ck-player-fig">
                  {bowlFig.O}-{bowlFig.M}-{bowlFig.R}-{bowlFig.W}
                </div>
              </div>
            </div>

            {/* THIS OVER — pip per ball + dashed slots for the rest */}
            <div className="ck-over-row">
              <div className="mono-over-strip">
                <span className="mono-over-label">Over {currentOverNo}</span>
                {overDeliveries.map((d, i) => {
                  const p = pipFor(d);
                  return (
                    <span
                      key={i}
                      className={`mono-over-pip ${p.cls}`}
                      data-testid="over-pip"
                    >
                      {p.label}
                    </span>
                  );
                })}
                {Array.from({ length: emptySlots }).map((_, i) => (
                  <span key={`e${i}`} className="mono-over-pip mono-over-pip-empty">{' '}</span>
                ))}
              </div>
            </div>

            {/* ======= BIG-5 SCORING ZONE ======= */}
            <div className="big5">
              <div className="big5-caption">
                <span className="lbl">Score this ball</span>
              </div>
              <div className="big5-grid">
                <button type="button" className="big5-key" aria-label="Dot" onClick={() => scoreRuns(0)}>
                  {'·'}<small>DOT</small>
                </button>
                <button type="button" className="big5-key" aria-label="Single" onClick={() => scoreRuns(1)}>
                  1<small>SINGLE</small>
                </button>
                <button type="button" className="big5-key big5-key-four" aria-label="Four" onClick={() => scoreRuns(4)}>
                  4<small>FOUR</small>
                </button>
                <button type="button" className="big5-key big5-key-six" aria-label="Six" onClick={() => scoreRuns(6)}>
                  6<small>SIX</small>
                </button>
                <button
                  type="button"
                  className="big5-key big5-key-wicket"
                  aria-label="Wicket"
                  aria-expanded={wicketOpen}
                  onClick={() => setWicketOpen(true)}
                >
                  W<small>WICKET</small>
                </button>
              </div>
            </div>

            {/* Extras */}
            <div className="sec sec-extras">
              <span className="sec-lbl">Extras</span>
              <div className="sec-pills fill">
                <button type="button" className="pill" aria-label="Wide" onClick={() => scoreExtra('wide', 1)}>Wide</button>
                <button type="button" className="pill" aria-label="No-ball" onClick={() => scoreExtra('no-ball', 1)}>No-ball</button>
                <button type="button" className="pill" aria-label="Bye" onClick={() => scoreExtra('bye', 1)}>Bye</button>
                <button type="button" className="pill" aria-label="Leg-bye" onClick={() => scoreExtra('leg-bye', 1)}>Leg-bye</button>
              </div>
            </div>

            {/* Other runs */}
            <div className="sec sec-otherruns">
              <span className="sec-lbl">Other runs</span>
              <div className="sec-pills fill">
                {[2, 3, 5, 7].map((n) => (
                  <button key={n} type="button" className="pill num" aria-label={`Run ${n}`} onClick={() => scoreRuns(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Controls: Undo · Swap strike · ⋯ More */}
            <div className="ctrls">
              <button type="button" className="mono-btn ck-undo" aria-label="Undo last ball" onClick={doUndo}>
                {'↩'}
              </button>
              <button type="button" className="mono-btn ck-strike" aria-label="Swap strike" onClick={swapStrike}>
                {'⇆'} Swap strike
              </button>
              <div className="more-menu">
                <button type="button" className="mono-btn ck-more" aria-label="More options" onClick={() => setSheetOpen(true)}>
                  {'⋯'} More
                </button>
              </div>
            </div>

            <div className="ck-footer">
              <span className="left">Full scorecard {'›'}</span>
              <span className="right">Share live <span className="go">{'↗'}</span></span>
            </div>
          </>
        )}
      </div>

      {/* ⋯More bottom-sheet */}
      {sheetOpen ? (
        <>
          <div className="sheet-backdrop open" onClick={() => setSheetOpen(false)} aria-hidden="true" />
          <div className="menu-panel open" role="menu" data-testid="more-sheet">
            <div className="sheet-grab" />
            <div className="sheet-head">
              <span className="sheet-title">Match options</span>
              <button
                type="button"
                className="sheet-x"
                aria-label="Close"
                onClick={() => { setRetireCfg(null); setSheetOpen(false); }}
              >
                {'✕'}
              </button>
            </div>

            {retireCfg ? (
              <div className="menu-retire" data-testid="retire-config">
                <span className="sec-lbl">Retire — who?</span>
                <div className="menu-row">
                  {['striker', 'non-striker'].map((end) => (
                    <button
                      key={end}
                      type="button"
                      className={`pill${retireCfg.end === end ? ' on' : ''}`}
                      aria-pressed={retireCfg.end === end}
                      onClick={() => setRetireCfg((c) => ({ ...c, end }))}
                      disabled={end === 'non-striker' && innings.nonStriker == null}
                    >
                      {end === 'striker' ? nameOf(innings.striker) : nameOf(innings.nonStriker)}
                    </button>
                  ))}
                </div>
                <span className="sec-lbl">Mode</span>
                <div className="menu-row">
                  {[
                    ['hurt', 'Retired hurt'],
                    ['out', 'Retired out'],
                    ['rotate', 'Rotate'],
                  ].map(([m, lbl]) => (
                    <button
                      key={m}
                      type="button"
                      className={`pill${retireCfg.mode === m ? ' on' : ''}`}
                      aria-pressed={retireCfg.mode === m}
                      onClick={() => setRetireCfg((c) => ({ ...c, mode: m }))}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
                <div className="menu-actions">
                  <button type="button" className="menu-end" onClick={startRetirePick}>
                    Continue
                  </button>
                  <button type="button" className="menu-end danger" onClick={() => setRetireCfg(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="menu-row">
                  <button type="button" className="pill" onClick={doDeadBall}>Dead ball</button>
                  <button type="button" className="pill" onClick={doMankad}>Mankad</button>
                  <button type="button" className="pill" onClick={() => doPenalty(5)}>Penalty +5</button>
                  <button type="button" className="pill" onClick={openBowlerPicker}>Change bowler</button>
                  <button
                    type="button"
                    className="pill"
                    onClick={() => setRetireCfg({ end: 'striker', mode: 'hurt' })}
                  >
                    Retire
                  </button>
                  <button type="button" className="pill" onClick={doUndo}>Correct last ball</button>
                </div>
                <div className="menu-penalty">
                  <label className="sec-lbl" htmlFor="ck-penalty-n">Penalty runs</label>
                  <div className="pick-custom">
                    <input
                      id="ck-penalty-n"
                      type="number"
                      min="1"
                      className="pick-input"
                      aria-label="Penalty runs"
                      value={penaltyN}
                      onChange={(e) => setPenaltyN(e.target.value)}
                    />
                    <button type="button" className="pill" onClick={() => doPenalty(penaltyN)}>
                      Add penalty
                    </button>
                  </div>
                </div>
                <div className="menu-actions">
                  <button type="button" className="menu-end" onClick={endInnings}>End innings</button>
                  <button type="button" className="menu-end danger" onClick={endMatch}>End match</button>
                </div>
              </>
            )}
          </div>
        </>
      ) : null}

      {/* C6 how-out sheet — replaces the inline flow */}
      <WicketSheet
        open={wicketOpen}
        onClose={() => setWicketOpen(false)}
        inn={innings}
        format={fmt}
        onConfirm={onWicketConfirm}
      />

      {/* New-batter picker (wicket / mankad / retire incoming) */}
      <PlayerPickerSheet
        open={!!batterPicker}
        onClose={() => setBatterPicker(null)}
        title="New batter"
        options={batterPicker ? batterOptions(batterPicker.ctx) : []}
        onPick={onBatterPick}
        allowCustom
      />

      {/* Quota-aware bowler picker (over end / manual change) */}
      <PlayerPickerSheet
        open={bowlerOpen}
        onClose={() => setBowlerOpen(false)}
        title="New bowler"
        options={bowlerOptions()}
        onPick={onBowlerPick}
        allowCustom
      />

      {toast ? (
        <div className="ck-toast" role="alert" data-testid="scorer-toast" onClick={() => setToast('')}>
          {toast}
        </div>
      ) : null}
    </div>
  );
}

// Ported from the approved Big-5 mockup (composed blocks + thumb-zone keypad).
// Real --se-*/--primary tokens only — no raw hex, green as the sole accent.
const STYLES = `
.mono-scorer-screen { min-height: 100dvh; padding: 14px 14px calc(14px + env(safe-area-inset-bottom, 0px)); }
.mono-scorer-shell { max-width: 390px; margin: 0 auto; display: flex; flex-direction: column; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.mono-score { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; line-height: 1; }

/* thumb-zone order: rare/management on top, most-tapped Big-5 at the bottom */
.ctrls { order: 4; }
.sec-extras { order: 5; }
.sec-otherruns { order: 6; }
.big5 { order: 7; }
.ck-footer { order: 8; }
.mono-scorer-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.mono-scorer-topbar-actions { display: flex; align-items: center; gap: 8px; }
.ck-topbar-title { font-size: 0.8125rem; font-weight: 700; color: var(--se-color-ink); line-height: 1.15; }
.ck-topbar-sub { font-family: var(--se-font-mono); font-size: 0.625rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--se-color-ink-muted); margin-top: 2px; }
.ck-icon { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 1px solid var(--se-color-line); border-radius: 10px; background: var(--se-color-surface); font-size: 1rem; flex: none; }
.mono-badge { display: inline-flex; align-items: center; padding: 2px 10px; font-size: 0.6875rem; font-family: var(--se-font-mono); border-radius: var(--radius); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
.mono-badge-live { background: var(--se-color-action-soft); color: var(--se-color-action); }

.ck-mode { display: inline-flex; border: 1px solid var(--se-color-line); border-radius: 999px; overflow: hidden; }
.ck-mode-btn { border: none; background: transparent; font-family: var(--se-font-mono); font-size: 0.625rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--se-color-ink-muted); padding: 5px 10px; cursor: pointer; }
.ck-mode-btn.on { background: var(--se-color-ink); color: var(--primary-foreground); }

.ck-hero { background: var(--se-color-ink); color: var(--se-color-inverse); border: 1px solid var(--se-color-line); border-radius: 14px; padding: 13px 15px; }
.ck-hero-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.ck-hero-score { font-family: var(--se-font-mono); font-size: 2.6rem; font-weight: 800; line-height: 0.9; font-variant-numeric: tabular-nums; }
.ck-hero-score .wk { font-size: 1.5rem; font-weight: 600; color: color-mix(in oklch, var(--se-color-inverse) 55%, transparent); }
.ck-hero-ov { font-family: var(--se-font-mono); font-size: 0.75rem; color: color-mix(in oklch, var(--se-color-inverse) 62%, transparent); margin-left: 8px; }
.ck-hero-crr { font-family: var(--se-font-mono); font-size: 0.6875rem; color: color-mix(in oklch, var(--se-color-inverse) 62%, transparent); }
.ck-hero-bar { height: 4px; border-radius: 99px; background: color-mix(in oklch, var(--se-color-inverse) 22%, transparent); margin: 10px 0; overflow: hidden; }
.ck-hero-bar > i { display: block; height: 100%; border-radius: inherit; background: var(--primary); }
.ck-hero-chase { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font-family: var(--se-font-mono); font-size: 0.6875rem; color: color-mix(in oklch, var(--se-color-inverse) 60%, transparent); }
.ck-hero-chase b { color: var(--se-color-inverse); font-weight: 700; }
.ck-hero-chase .need { color: var(--primary); font-weight: 800; }

.ck-power-ph { margin-top: 10px; padding: 40px 16px; text-align: center; border: 1px dashed color-mix(in oklch, var(--se-color-line) 40%, transparent); border-radius: 14px; font-family: var(--se-font-mono); font-size: 0.8125rem; font-weight: 700; color: var(--se-color-ink-muted); }

.ck-players { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 8px; border: 1px solid var(--se-color-line); border-radius: 14px; background: var(--se-color-surface); overflow: hidden; }
.ck-player { padding: 7px 10px; min-width: 0; }
.ck-player + .ck-player { border-left: 1px solid color-mix(in oklch, var(--se-color-line) 22%, var(--se-color-surface)); }
.ck-player-name { font-family: var(--se-font-mono); font-size: 0.6875rem; font-weight: 700; color: var(--se-color-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ck-player-name.sub { color: var(--se-color-ink-muted); }
.ck-player-name .dot { color: var(--primary); margin-right: 3px; }
.ck-player-fig { font-family: var(--se-font-mono); font-size: 0.6875rem; color: var(--se-color-ink-muted); margin-top: 2px; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.ck-over-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.mono-over-strip { display: flex; align-items: center; justify-content: flex-start; flex-wrap: wrap; gap: 6px; }
.mono-over-label { font-family: var(--se-font-mono); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--se-color-ink-faint); margin-right: 2px; }
.mono-over-pip { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 26px; padding: 0 6px; border-radius: 999px; border: 1px solid color-mix(in oklch, var(--se-color-line) 28%, transparent); background: var(--se-color-surface); color: var(--se-color-ink); font-family: var(--se-font-mono); font-size: 0.75rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.mono-over-pip-four { background: var(--accent); border-color: var(--primary); color: var(--primary); }
.mono-over-pip-six { background: var(--primary); border-color: var(--primary); color: var(--se-color-inverse); }
.mono-over-pip-wicket { background: var(--destructive); border-color: var(--destructive); color: var(--se-color-inverse); }
.mono-over-pip-empty { background: transparent; border-style: dashed; border-color: color-mix(in oklch, var(--se-color-line) 34%, transparent); }

.mono-btn { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 8px 16px; border: 1px solid var(--se-color-line); border-radius: 10px; background: transparent; color: var(--se-color-ink); font-size: 0.875rem; font-family: var(--se-font-sans); cursor: pointer; transition: background 250ms ease; }
.mono-btn:hover { background: var(--se-color-action-soft); }

.big5 { margin-top: 8px; }
.big5-caption { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
.big5-caption .lbl { font-family: var(--se-font-mono); font-size: 0.625rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--se-color-ink-faint); }
.big5-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.big5-key { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; min-height: clamp(48px, 7.5vh, 60px); border: 1px solid var(--se-color-line); border-radius: 12px; background: var(--se-color-surface); color: var(--se-color-ink); font-family: var(--se-font-mono); font-size: 2rem; font-weight: 800; line-height: 0.9; font-variant-numeric: tabular-nums; cursor: pointer; transition: background 120ms ease; }
.big5-key small { font-size: 0.625rem; font-weight: 700; letter-spacing: 0.12em; color: var(--se-color-ink-faint); }
.big5-key:active { transform: translateY(1px); background: var(--accent); }
.big5-key-four, .big5-key-six { color: var(--primary); border-color: var(--primary); }
.big5-key-four small, .big5-key-six small { color: inherit; opacity: 0.85; }
.big5-key-wicket { grid-column: 1 / -1; flex-direction: row; gap: 10px; min-height: 46px; font-size: 1.25rem; letter-spacing: 0.1em; text-transform: uppercase; border-color: var(--se-color-danger); background: color-mix(in oklch, var(--se-color-danger-soft) 40%, var(--se-color-surface)); color: var(--se-color-danger); }
.big5-key-wicket small { color: inherit; opacity: 0.8; letter-spacing: 0.12em; }
.big5-key-wicket:active { background: var(--se-color-danger); color: var(--se-color-inverse); }

.howout { grid-column: 1 / -1; border: 1px solid var(--se-color-danger); border-top: none; border-radius: 0 0 12px 12px; background: color-mix(in oklch, var(--se-color-danger-soft) 22%, var(--se-color-surface)); padding: 10px 12px 11px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.howout-lbl { font-family: var(--se-font-mono); font-size: 0.625rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--se-color-danger); width: 100%; margin-bottom: 3px; }
.ho-pill { border: 1px solid color-mix(in oklch, var(--se-color-danger) 38%, var(--se-color-line)); background: var(--se-color-surface); color: var(--se-color-ink); border-radius: 999px; padding: 7px 13px; font-family: var(--se-font-sans); font-size: 0.75rem; font-weight: 600; cursor: pointer; }

.sec { margin-top: 9px; }
.sec-lbl { display: block; font-family: var(--se-font-mono); font-size: 0.625rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--se-color-ink-faint); margin-bottom: 5px; }
.sec-pills { display: flex; flex-wrap: wrap; gap: 7px; }
.sec-pills.fill { display: flex; gap: 7px; }
.sec-pills.fill > .pill { flex: 1 1 0; }
.pill { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; border: 1px solid color-mix(in oklch, var(--se-color-line) 40%, transparent); background: var(--se-color-surface); color: var(--se-color-ink); border-radius: 999px; padding: 8px 15px; font-family: var(--se-font-sans); font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
.pill:active { background: var(--accent); }
.pill.num { font-family: var(--se-font-mono); font-weight: 700; min-width: 44px; padding: 8px 10px; }

.ctrls { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 7px; }
.ctrls .ck-undo { flex: 0 0 52px; min-height: 46px; font-size: 1.05rem; }
.ctrls .ck-strike { flex: 1; min-height: 46px; font-size: 0.8125rem; font-weight: 600; }
.more-menu { flex: 0 0 auto; position: relative; }
.ck-more { display: inline-flex; align-items: center; justify-content: center; min-height: 46px; padding: 8px 16px; }

.ck-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 9px; padding-top: 2px; font-family: var(--se-font-mono); font-size: 0.6875rem; }
.ck-footer .left { color: var(--primary); font-weight: 700; cursor: pointer; }
.ck-footer .right { color: var(--se-color-ink-muted); font-weight: 600; }
.ck-footer .right .go { color: var(--primary); }

.sheet-backdrop.open { display: block; position: fixed; inset: 0; z-index: 40; background: color-mix(in oklch, black 45%, transparent); }
.menu-panel.open { display: flex; flex-direction: column; gap: 10px; position: fixed; left: 50%; transform: translateX(-50%); bottom: 0; width: 100%; max-width: 420px; z-index: 50; padding: 8px 14px calc(16px + env(safe-area-inset-bottom, 0px)); background: var(--se-color-surface); border: 1px solid var(--se-color-line); border-bottom: none; border-radius: 16px 16px 0 0; max-height: 74vh; overflow-y: auto; }
.sheet-grab { width: 36px; height: 4px; border-radius: 99px; background: color-mix(in oklch, var(--se-color-line) 30%, transparent); margin: 2px auto 4px; }
.sheet-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
.sheet-title { font-size: 0.9375rem; font-weight: 700; }
.sheet-x { width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; border: none; background: transparent; border-radius: 8px; color: var(--se-color-ink-muted); cursor: pointer; }
.menu-row { display: flex; flex-wrap: wrap; gap: 6px; }
.menu-row .pill { min-height: 34px; padding: 6px 12px; font-size: 0.75rem; color: var(--se-color-ink-soft); }
.menu-actions { display: flex; gap: 8px; margin-top: 2px; }
.menu-end { flex: 1; min-height: 42px; border-radius: 10px; border: 1px solid var(--se-color-action); background: var(--se-color-action); color: var(--se-color-inverse); font-family: var(--se-font-sans); font-size: 0.8125rem; font-weight: 700; cursor: pointer; }
.menu-end.danger { border-color: var(--se-color-danger); background: transparent; color: var(--se-color-danger); }

.ck-freehit { display: inline-flex; align-items: center; padding: 1px 7px; margin-right: 8px; border-radius: 999px; background: var(--primary); color: var(--se-color-inverse); font-family: var(--se-font-mono); font-size: 0.5625rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }

/* Shared sheet content (rendered into MonoSheet portals; global styles apply) */
.wk-sheet, .pick-sheet { display: flex; flex-direction: column; gap: 10px; }
.wk-pills { display: flex; flex-wrap: wrap; gap: 7px; }
.wk-note { font-family: var(--se-font-mono); font-size: 0.6875rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--se-color-danger); margin: 0; }
.wk-step { display: flex; flex-direction: column; gap: 8px; }
.wk-q { font-family: var(--se-font-mono); font-size: 0.625rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--se-color-ink-faint); }
.ho-pill.on { background: var(--se-color-action); border-color: var(--se-color-action); color: var(--se-color-inverse); }
.wk-more { color: var(--se-color-ink-muted); }
.wk-confirm { align-self: flex-start; margin-top: 2px; }

.pick-list { display: flex; flex-direction: column; gap: 6px; }
.pick-opt { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; padding: 8px 14px; border: 1px solid color-mix(in oklch, var(--se-color-line) 40%, transparent); background: var(--se-color-surface); color: var(--se-color-ink); border-radius: 10px; font-family: var(--se-font-sans); font-size: 0.8125rem; font-weight: 600; cursor: pointer; text-align: left; }
.pick-opt:active { background: var(--accent); }
.pick-opt:disabled { opacity: 0.45; cursor: not-allowed; }
.pick-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pick-reason { flex: none; font-family: var(--se-font-mono); font-size: 0.5625rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--se-color-danger); }
.pick-custom { display: flex; gap: 7px; }
.pick-input { flex: 1; min-width: 0; min-height: 40px; padding: 8px 12px; border: 1px solid var(--se-color-line); border-radius: 10px; background: var(--se-color-surface); color: var(--se-color-ink); font-family: var(--se-font-sans); font-size: 0.8125rem; }
.pick-custom .pill { flex: none; }

.menu-retire, .menu-penalty { display: flex; flex-direction: column; gap: 6px; }
.menu-penalty { margin-top: 2px; }
.menu-row .pill.on { background: var(--se-color-action); border-color: var(--se-color-action); color: var(--se-color-inverse); }

.ck-toast { position: fixed; left: 50%; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 60; max-width: 360px; padding: 10px 16px; border-radius: 10px; background: var(--se-color-ink); color: var(--se-color-inverse); font-family: var(--se-font-sans); font-size: 0.8125rem; font-weight: 600; box-shadow: 0 6px 20px color-mix(in oklch, black 30%, transparent); cursor: pointer; }

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; }
  .big5-key:active, .mono-btn:active { transform: none; }
}
`;
