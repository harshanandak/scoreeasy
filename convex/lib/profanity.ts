// Server-side profanity/slur filter for PUBLIC strings (team names) — issue q7k,
// design §7.1. Public-by-default means these strings are served to anyone, so the
// check MUST run in the mutation (never client-only — the mutation is directly
// callable). Pure, no deps, no network, O(name length).
//
// Strategy: canonicalize to defeat common evasion (case, unicode width, accents,
// zero-width joiners, leet substitution, separator/space padding, run padding),
// then substring-match a canonicalized blocklist. Substring matching has known
// false positives (the "Scunthorpe problem"); for the v1 FLOOR that is an
// accepted trade-off — a flagged match is held (operator can still score
// privately), not destroyed. Word-boundary/phonetic matching is §7.1 fast-follow.

// Leet / homoglyph folding applied during canonicalization.
const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "i",
  "+": "t",
};

// Canonicalized (already lowercased, separators removed, leet-folded) blocklist
// stems. Intentionally small + high-signal for the v1 floor; expand or swap for a
// maintained list as fast-follow. Stems match as substrings of the canonical form.
const BLOCKLIST: readonly string[] = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "asshole",
  "bastard",
  "dick",
  "pussy",
  "slut",
  "whore",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "rape",
  "nazi",
];

/**
 * Fold a user string to a comparison form that resists common evasion.
 * NFKD width-folds; combining marks + zero-width chars are stripped; everything
 * is lowercased; leet chars are mapped; all non-alphanumerics are dropped (so
 * "f u c k" / "f.u.c.k" collapse); runs of 3+ identical chars collapse to one
 * (so "fuuuuck"/"sssshit" still match the stem). Returns the canonical string.
 *
 * IMPORTANT — why 3+, not 2+: collapsing a SINGLE doubled letter would conflate
 * slurs with legitimate words that differ by exactly one double — e.g. "nigger"
 * → "niger", a substring of the COUNTRY "Niger"/"Nigeria" (a false positive on
 * national teams). The doubled letter is load-bearing, so it is preserved.
 * Catching one-letter padding ("fuuck") cleanly needs word-boundary/token
 * matching — the §7.1 fast-follow. Substring matching keeps the accepted
 * "Scunthorpe" trade-off for the v1 floor (a flagged name is held, not deleted).
 */
export function canonicalize(input: string): string {
  if (!input) return "";
  const folded = input
    .normalize("NFKD") // decompose accents + compatibility (width, ligatures)
    .toLowerCase();
  let out = "";
  for (const ch of folded) {
    if (ch >= "a" && ch <= "z") out += ch;
    else if (LEET[ch]) out += LEET[ch]; // leet digits/symbols → letters
    // combining marks (from NFKD), zero-width, separators, punct, emoji → dropped
  }
  // Collapse 3+ identical runs to one so run-padding ("fuuuuck", "sssshit")
  // still matches the base stem, WITHOUT shortening stems by a single double.
  return out.replace(/(.)\1{2,}/g, "$1");
}

/**
 * True when `name` contains blocked content after canonicalization.
 * @param {string} name user-supplied public string (e.g. a team name)
 */
export function containsProfanity(name: string): boolean {
  const c = canonicalize(name);
  if (!c) return false;
  return BLOCKLIST.some((stem) => c.includes(stem));
}
