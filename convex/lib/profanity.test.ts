import { describe, it, expect } from "vitest";
import { canonicalize, containsProfanity } from "./profanity";

describe("profanity.canonicalize", () => {
  it("folds case, separators, and run-padding", () => {
    expect(canonicalize("F.U.C.K")).toBe("fuck");
    expect(canonicalize("S h i t")).toBe("shit");
    expect(canonicalize("fuuuuck")).toBe("fuck");
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
});
