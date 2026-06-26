import { describe, it, expect } from "vitest";
import { canonicalize, containsProfanity } from "./profanity";

describe("profanity.canonicalize", () => {
  it("folds case, separators, and 3+ run-padding", () => {
    expect(canonicalize("F.U.C.K")).toBe("fuck");
    expect(canonicalize("S h i t")).toBe("shit");
    expect(canonicalize("fuuuuck")).toBe("fuck");
    // A SINGLE doubled letter is preserved (it is load-bearing — see the
    // "nigger" vs "Niger" note in profanity.ts).
    expect(canonicalize("Mumbai Indians")).toBe("mumbaiindians");
  });

  it("folds leet substitution and unicode width/accents", () => {
    expect(canonicalize("sh1t")).toBe("shit");
    expect(canonicalize("@ss")).toBe("ass");
    // Fullwidth glyphs NFKD-fold to ASCII.
    expect(canonicalize("ｓｈｉｔ")).toBe("shit"); // ｓｈｉｔ
    // Accents decompose + strip.
    expect(canonicalize("fùck")).toBe("fuck"); // fùck
  });
});

describe("profanity.containsProfanity", () => {
  it("flags blocked content through common evasion", () => {
    expect(containsProfanity("shit")).toBe(true);
    expect(containsProfanity("S H I T")).toBe(true);
    expect(containsProfanity("sh1t storm")).toBe(true);
    expect(containsProfanity("ｓｈｉｔ")).toBe(true);
  });

  it("passes clean team names", () => {
    for (const name of ["Falcons", "Hawks", "Real Madrid", "Team Blue", "Mumbai Indians", ""]) {
      expect(containsProfanity(name)).toBe(false);
    }
  });

  // REGRESSION (PR #93 adversarial review): a 2+ run-collapse shortened "nigger"
  // → "niger", which is a substring of the country/national-team name — flagging
  // Niger, Nigeria, Nigerian and Irish surnames. The doubled letter MUST be kept.
  it("does NOT flag legitimate names that merely contain a shortened-stem substring", () => {
    for (const name of ["Niger", "Nigeria", "Nigerian", "Team Nigeria", "Branigan", "Flanigan", "Finnigan"]) {
      expect(containsProfanity(name)).toBe(false);
    }
  });
});
