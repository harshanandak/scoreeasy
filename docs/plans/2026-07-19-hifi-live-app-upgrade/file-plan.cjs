// Files decomposition.v2.json into the Forge kernel issue store.
// Run from repo root: node docs/plans/2026-07-19-hifi-live-app-upgrade/file-plan.js
const { execFileSync } = require("child_process");
const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");

const DIR = path.join("docs", "plans", "2026-07-19-hifi-live-app-upgrade");
const PLAN = path.join(DIR, "decomposition.v2.json");
const IDMAP = path.join(DIR, "filing-idmap.json");
const FORGE = "C:/Users/harsha_befach/Downloads/forge/bin/forge.js";

const d = JSON.parse(fs.readFileSync(PLAN, "utf8"));

function forge(args) {
  // returns {ok, out}. Uses execFileSync so args are passed literally (no shell quoting).
  try {
    const out = execFileSync("node", [FORGE, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || "") + (e.message || "") };
  }
}

const epicMap = {};   // epic title -> uuid
const issueMap = {};  // issue title -> uuid
const failures = [];
const skippedDeps = [];

// 1. Create epics
let epicsCreated = 0;
for (const e of d.epics) {
  const id = randomUUID();
  epicMap[e.title] = id;
  const r = forge([
    "issue", "create",
    "--title", e.title,
    "--type", "epic",
    "--priority", "P1",
    "--description", e.goal || e.title,
    "--label", `milestone:${e.milestone}`,
    "--id", id,
  ]);
  if (r.ok) epicsCreated++;
  else failures.push({ kind: "epic", title: e.title, err: r.out.slice(-300) });
}

// 2. Create issues
let issuesCreated = 0;
for (const e of d.epics) {
  const parent = epicMap[e.title];
  for (const is of e.issues) {
    const id = randomUUID();
    issueMap[is.title] = id;
    const body = `${is.description}\n\nPR: ${is.prBoundary}\na11y: ${is.a11y}\neffort: ${is.effort}`;
    const r = forge([
      "issue", "create",
      "--title", is.title,
      "--type", is.type,
      "--priority", is.priority,
      "--parent", parent,
      "--description", body,
      "--label", `milestone:${e.milestone},effort:${is.effort}`,
      "--id", id,
    ]);
    if (r.ok) issuesCreated++;
    else failures.push({ kind: "issue", title: is.title, err: r.out.slice(-300) });
  }
}

// 3. Dependencies: for issue X with dependsOn=[Y], Y blocks X => `dep add X Y`.
let depsAdded = 0;
for (const e of d.epics) {
  for (const is of e.issues) {
    const xid = issueMap[is.title];
    for (const yTitle of is.dependsOn || []) {
      const yid = issueMap[yTitle];
      if (!yid) { skippedDeps.push({ from: is.title, missing: yTitle }); continue; }
      const r = forge(["issue", "dep", "add", xid, yid]);
      if (r.ok) depsAdded++;
      else failures.push({ kind: "dep", from: is.title, to: yTitle, err: r.out.slice(-200) });
    }
  }
}

// 4. Write idmap
fs.writeFileSync(IDMAP, JSON.stringify({ epics: epicMap, issues: issueMap }, null, 2));

console.log(JSON.stringify({
  epicsCreated, issuesCreated, depsAdded,
  failures: failures.length, skippedDeps: skippedDeps.length,
  firstFailures: failures.slice(0, 5),
  firstSkipped: skippedDeps.slice(0, 5),
}, null, 2));
