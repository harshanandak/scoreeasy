import { describe, it, expect } from "vitest";
import { canonicalize, containsProfanity } from "./profanity";

describe("profanity.canonicalize", () => {
  it("folds case, separators, and run-padding of ANY length", () => {
    expect(canonicalize("F.U.C.K")).toBe("fuck");
    expect(canonicalize("S h i t")).toBe("shit");
    expect(canonicalize("fuuuuck")).toBe("fuck");
    // A SINGLE doubled letter must also collapse (regression for the "fuuck"
    // evasion that the old 3+-only run-collapse let through).
    expect(canonicalize("fuuck")).toBe("fuck");
    // Every identical run collapses, including across word junctions.
    expect(canonicalize("Mumbai Indians")).toBe("mumbaindians");
  });

  it("folds leet substitution and unicode width/accents", () => {
    expect(canonicalize("sh1t")).toBe("shit");
    // "@ss" → leet @→a, then the "ss" run collapses to one.
    expect(canonicalize("@ss")).toBe("as");
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
    // Doubled-letter padding (the evasion this fix closes).
    expect(containsProfanity("fuuck")).toBe(true);
    // Stems that themselves carry doubles must still match after the input
    // collapses — proves the blocklist is canonicalized the same way.
    expect(containsProfanity("pusssy")).toBe(true);
    expect(containsProfanity("a$$hole")).toBe(true);
  });

  it("passes clean team names", () => {
    for (const name of ["Falcons", "Hawks", "Real Madrid", "Team Blue", "Mumbai Indians", ""]) {
      expect(containsProfanity(name)).toBe(false);
    }
  });
});
