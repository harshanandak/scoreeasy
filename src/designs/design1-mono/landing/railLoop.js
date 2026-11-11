/* The card rail on Home loops forever: after the last card comes the first, and before the first
   comes the last. The one rule, kept pure so it is unit-tested. */

/** A card number wrapped into 0..count-1 (also for negatives). */
export const wrapIndex = (index, count) => ((index % count) + count) % count;
