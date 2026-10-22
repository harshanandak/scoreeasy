import { describe, expect, it } from 'vitest';
import { liveStatus, updateAge } from './liveStatus';
describe('live status matches the spectator boundary', () => {
  it.each([[89000, 'Live'], [90000, 'Live'], [91000, 'Paused']])('%i ms is %s', (age, label) => {
    expect(liveStatus(100000 - age, 100000)).toBe(label);
  });
  it('formats seconds, minutes, and clock skew without negative ages', () => {
    expect(updateAge(88000, 100000)).toBe('12s ago');
    expect(updateAge(0, 180000)).toBe('3 min ago');
    expect(updateAge(200000, 100000)).toBe('0s ago');
  });
});
