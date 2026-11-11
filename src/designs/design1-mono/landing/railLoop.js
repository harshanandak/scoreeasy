/* The card rail on Home loops forever: after the last card comes the first, and before the first
   comes the last. The one rule, kept pure so it is unit-tested. */

/** A card number wrapped into 0..count-1 (also for negatives). */
export const wrapIndex = (index, count) => ((index % count) + count) % count;

export const MARQUEE_FADE_START = 200;
export const MARQUEE_FADE_END = 320;
export const marqueeCardOpacity = (left) => Math.max(0, Math.min(1,
  (left - MARQUEE_FADE_START) / (MARQUEE_FADE_END - MARQUEE_FADE_START)));
