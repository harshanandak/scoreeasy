/* The card rail on Home loops forever by rendering its cards three times in a row
   [copy 0][copy 1][copy 2] and keeping the scroll position inside copy 1. When a swipe or an
   auto-advance comes to rest in copy 0 or copy 2, the rail jumps one copy sideways. The copies are
   identical, so the jump cannot be seen. Pure helpers, so the wrap rules are unit-tested. */

export const RAIL_COPIES = 3;

/** A card number wrapped into 0..count-1 (also for negatives). */
export const wrapIndex = (index, count) => ((index % count) + count) % count;

/** The card the rail is resting on, from its scroll position; one card is `pitch` px wide with its gap. */
export function nearestCard(scrollLeft, pitch, count) {
  if (!(pitch > 0)) return 0;
  return Math.min(Math.max(Math.round(scrollLeft / pitch), 0), count * RAIL_COPIES - 1);
}

/** Where a resting card index is moved to: copy 0 goes up one copy, copy 2 comes down one, copy 1 stays. */
export function settleCard(card, count) {
  if (card < count) return card + count;
  if (card >= count * 2) return card - count;
  return card;
}

/** The card index of card `board` in the middle (real) copy. */
export const homeCard = (board, count) => count + wrapIndex(board, count);
