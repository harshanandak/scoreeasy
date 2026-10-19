// Adds the remaining dependency edges from missing-edges.json (idempotent).
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const DIR = path.join("docs", "plans", "2026-07-19-hifi-live-app-upgrade");
const FORGE = "C:/Users/harsha_befach/Downloads/forge/bin/forge.js";
const edges = JSON.parse(fs.readFileSync(path.join(DIR, "missing-edges.json"), "utf8"));
let added = 0;
const failures = [];
for (const [xid, yid, xt, yt] of edges) {
  try {
    execFileSync("node", [FORGE, "issue", "dep", "add", xid, yid], { encoding: "utf8", stdio: "ignore" });
    added++;
  } catch (e) {
    failures.push({ from: xt, to: yt, err: (e.message || "").slice(-150) });
  }
}
console.log(JSON.stringify({ added, failures: failures.length, firstFailures: failures.slice(0, 5) }, null, 2));
