import { describe, expect, it } from 'vitest';
import { RAIL_COPIES, homeCard, nearestCard, settleCard, wrapIndex } from './railLoop';

describe('board rail loop helpers', () => {
  it('wraps a board number in both directions', () => {
    expect([-6, -1, 0, 4, 5, 11].map((i) => wrapIndex(i, 5))).toEqual([4, 4, 0, 4, 0, 1]);
  });

  it('finds the card a scroll position rests on, inside the three copies', () => {
    expect(nearestCard(0, 300, 5)).toBe(0);
    expect(nearestCard(1480, 300, 5)).toBe(5);
    expect(nearestCard(99999, 300, 5)).toBe(5 * RAIL_COPIES - 1);
    expect(nearestCard(-40, 300, 5)).toBe(0);
    expect(nearestCard(900, 0, 5)).toBe(0);
  });

  it('moves a resting card from the first or third copy into the middle copy, and leaves the middle alone', () => {
    // Past the last board (card 10 is the first board in the third copy) comes back to card 5.
    expect(settleCard(10, 5)).toBe(5);
    // Before the first board (card 4 is the last board in the first copy) comes to card 9.
    expect(settleCard(4, 5)).toBe(9);
    expect(settleCard(0, 5)).toBe(5);
    expect(settleCard(14, 5)).toBe(9);
    for (let card = 5; card < 10; card += 1) expect(settleCard(card, 5)).toBe(card);
  });

  it('keeps the same board when it moves a card, so the jump cannot be seen', () => {
    for (let card = 0; card < 15; card += 1) {
      expect(wrapIndex(settleCard(card, 5), 5)).toBe(wrapIndex(card, 5));
    }
  });

  it('puts a board in the middle copy', () => {
    expect(homeCard(0, 5)).toBe(5);
    expect(homeCard(4, 5)).toBe(9);
    expect(homeCard(7, 5)).toBe(7);
  });
});
