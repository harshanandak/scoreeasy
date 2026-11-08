import { describe, expect, it } from 'vitest';
import { applyDelivery, applyRetire, createInnings, deriveInnings, makeDelivery, makeFormat } from './cricketEngine';

const format = makeFormat({ playersPerSide: 2, houseRules: { lastManStands: true } });
const loneInnings = () => applyDelivery(
  createInnings({ striker: 'a', nonStriker: 'b', playersPerSide: 2 }),
  makeDelivery({ wicket: { type: 'bowled', out: 'a', incoming: null } }), format,
);

describe('dismissal requires a present batter', () => {
  it.each(['mankad', 'run-out', 'bowled', 'retired-out'].flatMap(type =>
    [null, undefined, 'absent'].map(out => [type, out]),
  ))('rejects %s of absent batter %s without adding a wicket', (type, out) => {
    const innings = loneInnings();
    const before = structuredClone(innings);
    expect(() => applyDelivery(innings, makeDelivery({ wicket: { type, out, incoming: null } }), format))
      .toThrow(/batter.*not.*batting/i);
    expect(innings).toEqual(before);
    expect(deriveInnings(innings, format).wkts).toBe(1);
  });

  it.each([null, undefined, 'absent'])('rejects retiring absent batter %s as out', batter => {
    const innings = loneInnings();
    expect(() => applyRetire(innings, { batter, mode: 'out' }, format)).toThrow(/batter.*not.*batting/i);
    expect(deriveInnings(innings, format).wkts).toBe(1);
  });

  it('still permits a real final dismissal of the lone striker', () => {
    const innings = loneInnings();
    const finished = applyDelivery(innings, makeDelivery({ wicket: { type: 'run-out', out: 'b' } }), format);
    expect(deriveInnings(finished, format).wkts).toBe(2);
  });
});
