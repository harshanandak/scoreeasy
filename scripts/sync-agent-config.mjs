#!/usr/bin/env node
/**
 * sync-agent-config — project the canonical agent docs onto every harness.
 *
 *   bun run sync:agents            regenerate the harness files
 *   bun run sync:agents --check    verify only, no writes (exit 1 on drift)
 *
 * Canonical sources (edit these):
 *   AGENTS.md                     project intent, invariants, runbook
 *   CODING_STANDARDS.md           code rules, read before touching convex/
 *   docs/agents/forge-workflow.md the 7-stage TDD workflow
 *
 * Generated outputs (never hand-edit):
 *   .clinerules                       Cline
 *   .cursorrules                      Cursor (legacy single-file format)
 *   .roorules                         Roo Code
 *   .github/copilot-instructions.md   GitHub Copilot
 *   .cursor/rules/project.mdc         Cursor (modern rules format)
 *
 * The topic rules in .cursor/rules/ other than project.mdc are hand-authored
 * and are deliberately left alone.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_ONLY = process.argv.includes("--check");

const SOURCES = {
  agents: "AGENTS.md",
  standards: "CODING_STANDARDS.md",
  workflow: "docs/agents/forge-workflow.md"
};

/** Always compare and emit LF, so a CRLF checkout does not read as drift. */
const lf = (text) => text.replace(/\r\n/g, "\n");
const read = (rel) => lf(fs.readFileSync(path.join(ROOT, rel), "utf8"));

/** Strip a leading HTML comment line and any leading `# Title` heading. */
const body = (text) =>
  text
    .replace(/^<!--[\s\S]*?-->\s*/, "")
    .replace(/^#\s+.*\r?\n/, "")
    .trim();

const header = (comment) => {
  const lines = [
    "GENERATED — do not hand-edit; run scripts/sync-agent-config.mjs",
    `Sources: ${Object.values(SOURCES).join(", ")}`
  ];
  return comment === "html"
    ? `<!--\n${lines.join("\n")}\n-->`
    : lines.map((l) => `> ${l}`).join("\n");
};

function compose({ title, frontmatter, comment }) {
  const parts = [];
  if (frontmatter) parts.push(frontmatter);
  parts.push(header(comment));
  parts.push(`# ${title}`);
  parts.push(body(read(SOURCES.agents)));
  parts.push("---");
  parts.push("# Coding Standards");
  parts.push(body(read(SOURCES.standards)));
  parts.push("---");
  parts.push("# Forge Workflow");
  parts.push(body(read(SOURCES.workflow)));
  return `${parts.join("\n\n")}\n`;
}

const TARGETS = [
  { file: ".clinerules", title: "Score Easy — agent instructions", comment: "html" },
  { file: ".cursorrules", title: "Score Easy — agent instructions", comment: "html" },
  { file: ".roorules", title: "Score Easy — agent instructions", comment: "html" },
  {
    file: ".github/copilot-instructions.md",
    title: "Score Easy — agent instructions",
    comment: "quote"
  },
  {
    file: ".cursor/rules/project.mdc",
    title: "Score Easy — agent instructions",
    comment: "quote",
    frontmatter: [
      "---",
      'description: "Score Easy project instructions, coding standards and Forge workflow"',
      "alwaysApply: true",
      "---"
    ].join("\n")
  }
];

const drift = [];
const wrote = [];

for (const target of TARGETS) {
  const abs = path.join(ROOT, target.file);
  const next = compose(target);
  const current = fs.existsSync(abs) ? lf(fs.readFileSync(abs, "utf8")) : null;

  if (current === next) continue;

  if (CHECK_ONLY) {
    drift.push(target.file);
    continue;
  }

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, next);
  wrote.push(target.file);
}

if (CHECK_ONLY) {
  if (drift.length) {
    console.error(
      `sync-agent-config: ${drift.length} harness file(s) out of date:\n` +
        drift.map((f) => `  - ${f}`).join("\n") +
        "\nRun: bun run sync:agents"
    );
    process.exit(1);
  }
  console.log(`sync-agent-config: all ${TARGETS.length} harness files up to date.`);
  process.exit(0);
}

console.log(
  wrote.length
    ? `sync-agent-config: regenerated ${wrote.length}/${TARGETS.length}:\n` +
        wrote.map((f) => `  - ${f}`).join("\n")
    : `sync-agent-config: all ${TARGETS.length} harness files already current.`
);
