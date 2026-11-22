/* Only the three sets sports execute scoring. Other sports are labelled fixtures. */
const SPORTS = {
 vb:{name:'Volleyball',family:'sets',unit:'Set',names:RULES.vb.names},
 bd:{name:'Badminton',family:'sets',unit:'Game',names:RULES.bd.names},
 tt:{name:'Table tennis',family:'sets',unit:'Game',names:RULES.tt.names},
 tennis:{name:'Tennis',family:'tennis',names:['A. Sharma','R. Verma']},
 football:{name:'Football',family:'goals',names:['Chennai FC','Mumbai FC']},
 basketball:{name:'Basketball',family:'goals',names:['Chennai Hoops','Mumbai Hoops']},
 hockey:{name:'Hockey',family:'goals',names:['Chennai HC','Mumbai HC']},
 kabaddi:{name:'Kabaddi',family:'kabaddi',names:['Chennai Raiders','Mumbai Warriors']},
 cricket:{name:'Cricket',family:'cricket',names:['Chennai CC','Mumbai CC']}
};
const MAPS = {
 vb:['Team names and engine team colours','Current rally points. At full time, sets won.','Sets won and current set number. Completed scores in detail follow header left/right order.','Serving team; set or match point; end change replaces serve.','2 point keys + 2 utilities, 2 columns'],
 bd:['Singles players and engine team colours','Current rally points. At full time, games won.','Games won and current game number. Completed scores follow header left/right order.','Server and right/left court; 60 second interval or end change takes priority.','2 point keys + 2 utilities, 2 columns'],
 tt:['Singles players and engine team colours','Current rally points. At full time, games won.','Games won and current game number. Completed scores follow header left/right order.','Server and 1 of 2 / 2 of 2. Each point at deuce. End change takes priority.','2 point keys + 2 utilities, 2 columns'],
 tennis:['Singles players and engine team colours','Game points: 0 / 15 / 30 / 40 / Ad; tiebreak points. At full time, sets won.','Games in this set and sets won, in that order.','Serving player; deuce, tiebreak or end change. No serving cue at full time.','2 point keys + 2 utilities, 2 columns'],
 football:['Teams and engine team colours','Goals for each team','Current half and total halves, repeated on both sides.','One match clock with remaining-time label; running, pause or result.','2 goal keys + 2 utilities, 2 columns'],
 basketball:['Teams and engine team colours','Points for each team','Current quarter and total quarters, repeated on both sides.','Quarter clock remaining; running, pause or result.','6 score keys + 3 utilities, 3 columns'],
 hockey:['Teams and engine team colours','Goals for each team','Current quarter and total quarters, repeated on both sides.','Quarter clock remaining; running, break or result.','2 goal keys + 2 utilities, 2 columns'],
 kabaddi:['Teams and engine team colours','Committed team totals. Pending raid gain never added early.','Players on mat and half number. Pending mat changes in raid sheet.','Half clock + raid clock + raiding side; pause or full time replaces raid.','4 raid actions + 2 utilities, 2 columns. Defender sheet: 4 by 2.'],
 cricket:['Batting and bowling teams, each with engine colour','Runs/wickets for both innings. Unstarted innings says Yet to bat.','Overs for each side; innings ordinal. Test mode adds two innings entries in detail.','Chase runs and balls left; innings break; result at full time.','8 ball keys + 4 utilities, 4 columns']
};
const FIXTURES = {
 tennis:{mid:{score:['40','30'],secondary:['4 games · 1 set','3 games · 0 sets'],status:'Sharma serves · Set 2',detail:'Completed set: Sharma 6–4 Verma'},pause:{score:['0','0'],secondary:['4 games · 1 set','3 games · 0 sets'],status:'Change ends · Sharma serves next',detail:'7 games played in set 2. Verma won the last game.'},over:{score:['2','0'],secondary:['Sets won','Sets won'],status:'Sharma won 2–0',detail:'Completed sets: 6–4, 6–3'}},
 football:{mid:{score:['2','1'],secondary:['Half 2 of 2','Half 2 of 2'],status:'12:34 left · Clock running',detail:'2 × 45 minute halves'},pause:{score:['1','0'],secondary:['Half 1 complete','Half 1 complete'],status:'Half time · Clock stopped',detail:'Second half has not started'},over:{score:['2','1'],secondary:['2 halves complete','2 halves complete'],status:'Full time · Chennai FC won',detail:'90 minutes played · no added time in this example'}},
 basketball:{mid:{score:['54','49'],secondary:['Quarter 3 of 4','Quarter 3 of 4'],status:'04:32 left in Q3 · Clock running',detail:'FIBA example · 4 × 10 minute quarters'},pause:{score:['54','49'],secondary:['Quarter 3 of 4','Quarter 3 of 4'],status:'04:32 left in Q3 · Clock paused',detail:'Same score and clock. Scoring locked until resume.'},over:{score:['78','74'],secondary:['4 quarters complete','4 quarters complete'],status:'Full time · Chennai Hoops won',detail:'40 minutes played · no overtime required'}},
 hockey:{mid:{score:['2','1'],secondary:['Quarter 3 of 4','Quarter 3 of 4'],status:'08:12 left in Q3 · Clock running',detail:'Field hockey · 4 × 15 minute quarters'},pause:{score:['2','1'],secondary:['Quarter 3 complete','Quarter 3 complete'],status:'Quarter break · Clock stopped',detail:'Quarter 4 starts with the same score'},over:{score:['3','2'],secondary:['4 quarters complete','4 quarters complete'],status:'Full time · Chennai HC won',detail:'60 minutes played · no extended penalty corner pending'}},
 kabaddi:{mid:{half:2,clock:'08:42',score:['18','16'],secondary:['7 on mat · Half 2','7 on mat · Half 2'],status:'08:42 left · Chennai raid · 22s',detail:'New raid, no marks yet. Both teams have 7 on mat.'},pause:{half:1,clock:'00:00',score:['14','12'],secondary:['7 on mat · Half 1','7 on mat · Half 1'],status:'Half time · Both clocks stopped',detail:'Players return for half 2. Chennai raids first after the break in this fixture.'},over:{half:2,clock:'00:00',score:['32','29'],secondary:['Half 2 complete','Half 2 complete'],status:'Full time · Chennai Raiders won',detail:'No active raid and no pending points'}},
 cricket:{mid:{score:['145/6','120/3'],secondary:['20.0 overs · Innings 1','16.0 overs · Innings 2'],status:'Mumbai needs 26 from 24 balls',detail:'T20 · Mumbai batting · Target 146'},pause:{score:['145/6','Yet to bat'],secondary:['20.0 overs · Innings 1','Innings 2 next'],status:'Innings break · Mumbai target 146',detail:'Chennai completed 120 legal balls. Chase has not begun.'},over:{score:['145/6','146/4'],secondary:['20.0 overs · Innings 1','19.2 overs · Innings 2'],status:'Mumbai CC won by 6 wickets',detail:'146 reached after 116 legal balls · 4 balls unused'}}
};
const q = new URLSearchParams(location.search);
let sport = SPORTS[q.get('sport')] ? q.get('sport') : 'vb';
let scene = ['mid','pause','over','change','between','deuce','first','decider','interval'].includes(q.get('state')) ? q.get('state') : 'mid';
let sheet = null, note = '', st = null;
const root = document.getElementById('app');
const escapeHTML = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sideName = (id,t)=>SPORTS[id].names[t==='A'?0:1];
SCRIPTS.bd.interval = () => fill(reduce(newMatch('bd',3),{k:'first',who:'A'}),11,8,'A',21);
function loadState(){
 if(SPORTS[sport].family==='sets') st=SCRIPTS[sport][scene==='pause'?'between':scene]?.()||SCRIPTS[sport].mid();
 else st=null;
}
loadState();
function view(id=sport,state=scene,stateObject=st){
 const cfg=SPORTS[id];
 if(cfg.family!=='sets') return {...FIXTURES[id][state==='over'?'over':state==='mid'?'mid':'pause'],names:cfg.names,phase:state==='mid'?'play':state==='over'?'over':'pause',left:'A'};
 const s=stateObject||SCRIPTS[id][state==='pause'?'between':state]?.()||SCRIPTS[id].mid();
 const order=[s.left,opp(s.left)],over=s.phase==='over',u=cfg.unit.toLowerCase();
 let status='';
 if(over) status=`${sideName(id,s.winner)} won ${s.wins[s.winner]}–${s.wins[opp(s.winner)]}`;
 else if(s.phase==='between') status=`${cfg.unit} ${s.g+1} complete · ${cfg.unit} ${s.g+2} next`;
 else if(s.phase==='first') status='Choose the first server';
 else if(['change','interval'].includes(s.phase)) status=s.prompt.title;
 else {const sv=RULES[id].serve(s),flag=flagOf(s);status=`${sideName(id,sv.who)} serves${sv.sub?' · '+sv.sub.toLowerCase():''}${flag?' · '+flag.text.toLowerCase():''}`;}
 return {names:order.map(t=>sideName(id,t)),score:order.map(t=>over?s.wins[t]:t==='A'?s.a:s.b),secondary:order.map(t=>over?`${cfg.unit}s won`:`${s.wins[t]} ${u}${s.wins[t]===1?'':'s'} won · ${cfg.unit} ${s.g+1}`),status,detail:s.games.length?`Completed ${u}s: `+s.games.map((a,i)=>`${i+1}: ${a[s.left==='A'?0:1]}–${a[s.left==='A'?1:0]}`).join(' · '):RULES[id].ruleLine,phase:s.phase,left:s.left,engine:s};
}
function header(id,v){
 return `<section class="score-header" aria-label="Match score">${v.names.map((n,i)=>`<section class="kit-tchip is-team score-side" data-slot="side-${i?'right':'left'}" data-team="${(i===0?v.left:opp(v.left)).toLowerCase()}" aria-label="${escapeHTML(n)}"><h2 class="kit-tcard-name" data-slot="name">${escapeHTML(n)}</h2><strong class="k5-score" data-slot="main-score"${n&&String(v.score[i]).length>=6?' style="font-size:1.7rem"':''}>${escapeHTML(v.score[i])}</strong><div class="secondary" data-slot="secondary">${escapeHTML(v.secondary[i])}</div></section>`).join('')}<p class="kit-sub score-status" data-slot="status" role="status">${escapeHTML(v.status)}</p></section>`;
}
function key(label,act,sub='',disabled=false,extra=''){
 return `<button type="button" class="kit-rrow" data-act="${act}"${disabled?' disabled':''} ${extra}><span class="kit-rrow-summary">${label}</span>${sub?`<span class="kit-rrow-label">${sub}</span>`:''}</button>`;
}
function choice(label,act,sub,selected){
 return `<button type="button" class="kit-rrow choice-key" data-act="${act}" aria-pressed="${selected}"><span class="kit-rrow-summary">${escapeHTML(label)}</span>${selected?'<span class="kit-chip">Selected</span>':`<span class="kit-rrow-label">${escapeHTML(sub)}</span>`}</button>`;
}
function controls(id,v){
 const fam=SPORTS[id].family,off=v.phase!=='play',done=v.phase==='over';
 let keys='',cols=2,compact=false;
 if(done) return `<div class="control-area"><div class="control-grid">${key('Undo','undo','Last action',fam!=='sets')}<button class="se-ctl" data-act="finish">Finish match</button></div></div>`;
 if(fam==='sets'){
  const s=v.engine;
  if(s.phase==='first') keys=key(escapeHTML(v.names[0]),'first-A','Serves first')+key(escapeHTML(v.names[1]),'first-B','Serves first');
  else if(s.phase==='between'){
   const next=SPORTS[id].unit.toLowerCase();
   keys=choice('Swap ends','side-yes','Screen follows teams',s.between.swap===true)+choice('Keep screen','side-no','Teams still change ends',s.between.swap===false);
   if(!s.between.fixed) keys+=choice(v.names[0],'server-left','Serves first',s.between.srv===s.left)+choice(v.names[1],'server-right','Serves first',s.between.srv===opp(s.left));
   keys+=key('Undo','undo','Last action')+`<button class="se-go" data-act="start"${valid(s,{k:'start'})?'':' disabled'}>Start ${next} ${s.g+2}</button>`;
   return `<div class="control-area"><div class="control-grid">${keys}</div></div>`;
  } else if(s.phase==='change') return `<div class="control-area"><div class="control-grid">${key('Swap ends','change-yes','Flip the screen')+key('Keep screen','change-no','Teams change ends')+key('Undo','undo','Last action')+key('More','more','Match options')}</div></div>`;
  else if(s.phase==='interval') return `<div class="control-area"><div class="control-grid">${key('Resume','resume','Interval complete')+key('Scorecard','scorecard','Match detail')+key('Undo','undo','Last action')+key('More','more','Match options')}</div></div>`;
  else keys=key('+1','point-left','Point',off,`aria-label="Add point for ${escapeHTML(v.names[0])}"`)+key('+1','point-right','Point',off,`aria-label="Add point for ${escapeHTML(v.names[1])}"`);
 } else if(fam==='tennis') keys=key('+1','fixture','Point',off)+key('+1','fixture','Point',off);
 else if(id==='basketball'){
  cols=3;compact=true;
  keys=['Left +1','Left +2','Left +3','Right +1','Right +2','Right +3'].map(x=>key(x,'fixture','',off)).join('');
 } else if(fam==='goals') keys=key('+1','fixture','Goal',off)+key('+1','fixture','Goal',off);
 else if(fam==='kabaddi') keys=key('Start raid','raid','No points yet',off)+key('Raid result','raid','Mark players',off);
 else if(fam==='cricket'){
  cols=4;compact=true;
  keys=['0','1','2','3','4','6','Wicket','Extras'].map(x=>key(x,x==='Extras'?'extras':'fixture','',off)).join('');
 }
 keys+=key('Undo','undo',fam==='sets'&&undoInfo(v.engine)?'Last action':'',fam!=='sets');
 if(id==='basketball') keys+=key(off?'Resume':'Pause','fixture','Clock');
 if(id==='cricket') keys+=key('Strike','fixture','Swap')+key('Card','scorecard','Scorecard');
 keys+=key('More','more','Options');
 if(fam==='kabaddi') keys=key('Empty raid','raid','0 points',off)+key('Touch +1','raid','Review raid',off)+key('Tackled','raid','Review raid',off)+key('Touches','raid','Choose players',off)+key('Undo','undo','Last raid',true)+key('More','more','Match options');
 return `<div class="control-area"><div class="control-grid${compact?' compact':''}" data-cols="${cols}">${keys}</div></div>`;
}
function board(id=sport,state=scene,stateObject=st){
 const v=view(id,state,stateObject);
 return `<article class="sb concept" data-sport="${id}" data-phase="${v.phase}"><header class="sb-top"><div class="sb-title"><b>${SPORTS[id].name}</b><small>${v.phase==='over'?'Match over':SPORTS[id].family==='sets'?'Live scoring':'State example'}</small></div>${v.phase==='over'?'':`<button class="kit-linkbtn" data-act="finish">Finish</button>`}</header>${header(id,v)}<section class="sb-sheet-group history-slot" data-slot="detail"><p>${escapeHTML(v.detail)}</p>${note?`<p role="status">${escapeHTML(note)}</p>`:''}</section>${controls(id,v)}</article>`;
}
function overlay(){
 if(!sheet)return '';
 let title='Match options',body='';
 if(sheet==='finish'){
  title='Finish this match?';body=`<p class="sb-sheet-note">This concept does not save a match. Finish would save the current score and result in the app.</p><div class="control-grid">${key('Keep scoring','close')}<button class="se-ctl" data-act="close">Finish match</button></div>`;
 }else if(sheet==='raid'){
  title='Raid result';body=`<p class="sb-sheet-note">Fixture only. Mark touched defenders and bonus, then review Safe, Empty or Tackled. Points, revivals and all-out stay in the raid engine.</p><div class="control-grid compact" data-cols="4">${['1','2','3','4','5','6','7','Bonus'].map(x=>key(x,'fixture')).join('')}</div><div class="control-grid compact" data-cols="3">${['Safe','Empty','Tackled'].map(x=>key(x,'fixture')).join('')}</div>`;
 }else if(sheet==='extras'){
  title='Extras';body=`<div class="control-grid compact">${['Wide','No-ball','Bye','Leg-bye'].map(x=>key(x,'fixture')).join('')}</div><p class="sb-sheet-note">Fixture only. The shipped extra flow still asks for runs and dismissal details.</p>`;
 }else if(sheet==='scorecard'){
  title='Scorecard';body=`<p class="sb-sheet-note">${view().detail}</p><p class="sb-sheet-note">Batter, bowler, partnership, current over and Test innings details belong in this drill-down.</p>`;
 }else{
  const fam=SPORTS[sport].family;
  let rows=['Share match','Scorecard','Swap screen sides','Correct a score'];
  if(fam==='sets') rows.push(sport==='vb'?'Replay rally':'Let: replay rally');
  if(fam==='goals') rows.push('Pause clock','Period controls',sport==='basketball'?'Fouls':'Fouls and cards');
  if(fam==='kabaddi') rows.push('Pause clock','Technical points','Player status','Call half or full time');
  if(fam==='cricket') rows.push('Change bowler','Retire batter','Dead ball','Penalty runs','End innings');
  body=`<div class="sb-sheet-group">${rows.map(x=>`<button class="sb-row" data-act="${x==='Swap screen sides'?'swap':x==='Scorecard'?'scorecard':'fixture'}">${x}</button>`).join('')}</div><div class="sb-sheet-group"><button class="sb-row sb-row-danger" data-act="fixture">Discard match</button></div>`;
 }
 return `<div class="sb sb-sheet-layer"><button class="sb-scrim" data-act="close" aria-label="Close options"></button><section class="sb-sheet" role="dialog" aria-modal="true" aria-label="${title}"><header class="sb-sheet-head"><b>${title}</b><button class="kit-linkbtn" data-act="close">Done</button></header><div class="sheet-content">${body}</div></section></div>`;
}
function reviewControls(){return `<aside class="review-controls sb"><label class="kit-fieldrow"><span>Sport</span><select data-select="sport">${Object.entries(SPORTS).map(([k,s])=>`<option value="${k}"${sport===k?' selected':''}>${s.name}</option>`).join('')}</select></label><div class="control-grid compact" data-cols="3">${['mid','pause','over'].map((x,i)=>key(['Mid-match','Break','Match over'][i],'scene-'+x)).join('')}</div>${SPORTS[sport].family==='sets'?`<div class="control-grid compact" data-cols="3">${key('Deuce','scene-deuce')+key('End change','scene-change')+key('New match','scene-first')}</div>`:''}<p class="kit-sub">Design controls. ${SPORTS[sport].family==='sets'?'Point, serve, end change and undo run on the reused sets engine.':'These are hand-checked states. Ball, point, clock and raid actions are drawings.'}</p><a class="kit-linkbtn" href="scoring-system.html">Read the scoring system</a></aside>`;}
function today(id=sport,state=scene){
 const v=view(id,state,st),s=SPORTS[id],over=v.phase==='over';
 const oldScores=s.family==='tennis'&&over?['0','0']:s.family==='sets'&&over?[v.left,opp(v.left)].map(t=>t==='A'?v.engine.a:v.engine.b):v.score;
 const top=`<header class="sb-top"><div class="sb-title"><b>${s.names[0]} v ${s.names[1]}</b><small>${s.name}</small></div><button class="se-ctl sb-finish">Finish</button></header>`;
 const bar=`<div class="sb-bar"><button class="se-ctl sb-undo">Undo <span class="sb-undo-w">Last action</span></button><button class="se-ctl sb-more">···</button></div>`;
 let main='';
 if(s.family==='sets'||s.family==='tennis') main=`<p class="tsb-meta">${escapeHTML(v.secondary.join(' · '))}</p><p class="tsb-last">${escapeHTML(v.status)}</p><div class="tsb-keys">${v.names.map((n,i)=>`<button class="tsb-key tsb-key-${(i===0?v.left:opp(v.left)).toLowerCase()}"><span class="tsb-who">${n}</span><span class="tsb-big">${oldScores[i]}</span><span class="tsb-word">${s.family==='tennis'&&over?(i?'3 games':'6 games'):over?'Match over':s.family==='tennis'?v.secondary[i]:'Tap +1'}</span></button>`).join('')}</div>`;
 else if(s.family==='goals') main=`<div class="tgb-meta"><span class="kit-chip">${s.name}</span><span class="tgb-clock">${escapeHTML(v.status)}</span></div><p class="tgb-last">${escapeHTML(v.detail)}</p><div class="tgb-keys">${v.names.map((n,i)=>`<div class="tgb-team tgb-team-${i?'b':'a'}"><span class="tgb-name">${n}</span><span class="tgb-score">${v.score[i]}</span>${id==='basketball'?`<div class="tgb-actions">${[1,2,3].map(n=>`<button>+${n}</button>`).join('')}</div>`:'<span>Tap +1</span>'}</div>`).join('')}</div>`;
 else if(s.family==='kabaddi') main=`<div class="k5-strip">${v.names.map((n,i)=>`<section class="k5-team k5-team-${i?'b':'a'}"><span class="k5-name">${n}</span><b class="k5-score">${v.score[i]}</b><span class="k5-count">${v.secondary[i]}</span></section>`).join('')}<div class="k5-mid"><b class="k5-clock">${v.clock}</b><small>Half ${v.half}</small></div></div><div class="ko-pad"><p class="kl-hint">${v.status}</p><div class="kit-seg kl-mode"><button>Touched</button><button>Stepped out</button></div><div class="kl-tokens">${['1','2','3','4','5','6','7','Bonus'].map(x=>`<button class="se-ctl kl-token">${x}</button>`).join('')}</div><div class="kl-results">${['Safe','Empty','Tackled'].map(x=>`<button class="se-ctl kl-result">${x}</button>`).join('')}</div></div>`;
 else main=`<section class="cricket-hero"><div class="cricket-who">${v.phase==='pause'?'Innings break':s.names[1]+' batting'}</div><strong class="ck-hero-score">${v.score[1]}</strong><p class="ck-hero-ov">${v.secondary[1]}</p><p class="ck-hero-chase">${v.status}</p></section>${v.phase==='pause'?'':`<div class="ck-players"><div class="ck-player"><b>Striker</b><span>32 (24)</span></div><div class="ck-player"><b>Non-striker</b><span>18 (12)</span></div><div class="ck-player"><b>Bowler</b><span>2–24 (3)</span></div></div>`}<div class="big5">${['0','1','2','4','6','Wicket'].map(x=>`<button class="se-ctl">${x}</button>`).join('')}</div><div class="sec-pills">${['Wide','No-ball','Bye','Leg-bye'].map(x=>`<button class="se-ctl">${x}</button>`).join('')}</div>`;
 return `<article class="sb tsb ${s.family==='goals'?'tgb':s.family==='kabaddi'?'kb ko kl':s.family==='cricket'?'mono-scorer-screen cricket-board today-cricket':''} today-board" data-batting="b">${top}<p class="kit-sub source-label">Origin/master reference reconstruction</p>${main}${bar}</article>`;
}
function system(){
 return `<div class="sb docs"><header class="docs-section"><p class="kit-sub">Score Easy · 22 November 2026 · local concept</p><h1 class="kit-title">One scoring system.<br>9 sports.</h1><p class="kit-sub">The setup flow already has a steady rhythm. Carry its team cards, 48px targets and quiet rows into the match.</p></header><section class="docs-section"><h2>Header anatomy</h2><div class="kit-rules-panel"><table><thead><tr><th>Named slot</th><th>Contract</th></tr></thead><tbody><tr><td>Side left / right</td><td>Equal width. Team colour follows identity when sides swap.</td></tr><tr><td>Name</td><td>48px, up to 2 lines in these fixtures. Longer content expands both sides together.</td></tr><tr><td>Main score</td><td>80px, tabular numerals. Unit is declared in secondary. No duplicate score on keys.</td></tr><tr><td>Secondary</td><td>48px. Two short pieces maximum: sets/games, period, overs/innings or mat count.</td></tr><tr><td>Status</td><td>64px shared row. Result, required break, then serve/clock/target. One line of meaning, allowed to wrap.</td></tr><tr><td>Detail</td><td>Separate quiet row for completed scores or innings context. Completed scores follow header left/right order. Never carries a live score or serve cue.</td></tr></tbody></table></div><p class="kit-sub">Absent secondary values remove their text but keep the 48px track. Absent status keeps its 64px track, empty and hidden from assistive text. At full time the existing slots change meaning explicitly to sets won or final score. Both sides always share track sizes.</p></section><section class="docs-section"><h2>Flat controls. Lift for a match moment.</h2><div class="docs-columns"><div class="control-grid">${key('+1','none','Point')+key('Undo','none','Last action')}<button class="se-ctl">Finish match</button><button class="se-go">Start next set</button></div><div class="kit-rules-panel"><table><tr><th>Control</th><th>Shipped treatment</th></tr><tr><td>Score keys, Undo, More, clock, raid, extras</td><td>.kit-rrow from setupSteps.css. Hairline inset only.</td></tr><tr><td>Sheet actions</td><td>.sb-row. Done and top Finish entry use .kit-linkbtn.</td></tr><tr><td>Choices</td><td>.kit-rrow with .kit-chip Selected and aria-pressed. No offset shadow.</td></tr><tr><td>Finish match, end innings confirmation</td><td>.se-ctl, unchanged 2px edge and 3px offset.</td></tr><tr><td>Start next set/game/half/quarter/innings</td><td>.se-go, unchanged lift. Only after the transition is ready.</td></tr></table></div></div><p class="kit-sub">16px page gutter and 16px between every key. Two-column keys are 96px high; three- and four-column keys are 64px high. Utilities match scoring keys within each sport. No uneven last row.</p></section>${Object.entries(SPORTS).map(([id,s])=>`<section class="docs-section" id="${id}"><h2>${s.name}</h2><div class="docs-columns"><div class="docs-demo">${board(id,'mid',s.family==='sets'?SCRIPTS[id].mid():null)}</div><div class="kit-rules-panel"><table><tr><th>Slot</th><th>${s.name} data</th></tr>${['Sides','Main score','Secondary','Status','Controls'].map((label,i)=>`<tr><td>${label}</td><td>${MAPS[id][i]}</td></tr>`).join('')}</table><a class="kit-linkbtn" href="prototype.html?sport=${id}">Open clickable board</a></div></div></section>`).join('')}<section class="docs-section"><h2>What moved</h2><p class="kit-sub">Repeated names, repeated sport chips, serving badges on keys, decorative marks and independent metadata lines are removed. Undo keeps its place. Scorecard holds completed scores and detail. More holds corrections, sharing, fouls, clock and period controls. Cricket Extras and kabaddi player marking keep their own sheets.</p><p class="kit-sub">The reference comparisons are source reconstructions, not captures of the authenticated app. See README for rule checks and limitations.</p></section></div>`;
}
function render(){
 if(document.body.dataset.mode==='compare'){
  const ids=q.get('all')==='1'?Object.keys(SPORTS).slice(Number(q.get('start'))||0,(Number(q.get('start'))||0)+(Number(q.get('count'))||9)):[sport],h=Number(q.get('h'))||innerHeight;
  root.innerHTML=ids.map(id=>`<div class="comparison" data-compare-sport="${id}"><iframe title="Today's ${SPORTS[id].name} reference" style="height:${h}px" src="prototype.html?bare=1&today=1&sport=${id}&state=${scene}"></iframe><iframe title="Proposed ${SPORTS[id].name} board" style="height:${h}px" src="prototype.html?bare=1&sport=${id}&state=${scene}"></iframe></div>`).join('');return;
 }
 if(document.body.dataset.mode==='system'){root.innerHTML=system();return;}
 if(q.get('bare')==='1')document.body.classList.add('bare');
 root.innerHTML=reviewControls()+(q.get('today')==='1'?today():board())+overlay();
}
function dispatch(ev){if(st&&valid(st,ev)){st=reduce(st,ev);note='';render();return true;}return false;}
root.addEventListener('change',e=>{if(e.target.dataset.select==='sport'){sport=e.target.value;scene='mid';sheet=null;note='';loadState();render();}});
root.addEventListener('click',e=>{
 if(document.body.dataset.mode!=='prototype')return;
 const b=e.target.closest('[data-act]');if(!b||b.disabled)return;
 const a=b.dataset.act;
 if(a.startsWith('scene-')){scene=a.slice(6);note='';loadState();}
 else if(['more','finish','raid','extras','scorecard'].includes(a))sheet=a;
 else if(a==='close')sheet=null;
 else if(a==='point-left')return dispatch({k:'pt',who:st.left});
 else if(a==='point-right')return dispatch({k:'pt',who:opp(st.left)});
 else if(a==='first-A')return dispatch({k:'first',who:st.left});
 else if(a==='first-B')return dispatch({k:'first',who:opp(st.left)});
 else if(a==='side-yes')return dispatch({k:'side',swap:true});
 else if(a==='side-no')return dispatch({k:'side',swap:false});
 else if(a==='server-left')return dispatch({k:'srv',who:st.left});
 else if(a==='server-right')return dispatch({k:'srv',who:opp(st.left)});
 else if(a==='change-yes')return dispatch({k:'swap',swap:true});
 else if(a==='change-no')return dispatch({k:'swap',swap:false});
 else if(a==='resume')return dispatch({k:'resume'});
 else if(a==='start')return dispatch({k:'start'});
 else if(a==='swap'){sheet=null;if(st)return dispatch({k:'flip'});note='Fixture only. Team colour and all slots would move together.';}
 else if(a==='undo'&&st?.ev.length){st=replay(st.sport,st.bo,st.ev.slice(0,-1));note='';}
 else if(a==='fixture'){note='State example only. This control is a drawing; no score was changed.';}
 render();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheet){sheet=null;render();}});
window.concept={get sport(){return sport},get state(){return st},setSport(id,state='mid'){sport=id;scene=state;note='';sheet=null;loadState();render();},dispatch,view,render};
render();
