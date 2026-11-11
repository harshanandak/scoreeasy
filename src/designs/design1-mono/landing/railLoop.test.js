import { describe, expect, it } from 'vitest';
import { wrapIndex } from './railLoop';

describe('card rail loop', () => {
  it('wraps a card number in both directions, so the last card is followed by the first and the first by the last', () => {
    expect([-6, -1, 0, 4, 5, 11].map((i) => wrapIndex(i, 5))).toEqual([4, 4, 0, 4, 0, 1]);
  });
});
