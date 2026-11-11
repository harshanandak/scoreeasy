import { describe, expect, it } from 'vitest';
import { marqueeCardOpacity, wrapIndex } from './railLoop';

describe('card rail loop', () => {
  it('fades the entire desktop card out before it can leave letter or control fragments at the mask', () => {
    expect([0, 112, 200, 260, 320, 800].map(marqueeCardOpacity)).toEqual([0, 0, 0, 0.5, 1, 1]);
  });
  it('wraps a card number in both directions, so the last card is followed by the first and the first by the last', () => {
    expect([-6, -1, 0, 4, 5, 11].map((i) => wrapIndex(i, 5))).toEqual([4, 4, 0, 4, 0, 1]);
  });
});
