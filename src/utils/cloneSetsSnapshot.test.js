import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloneSetsSnapshot } from './cloneSetsSnapshot';

const originalStructuredClone = globalThis.structuredClone;

afterEach(() => {
  globalThis.structuredClone = originalStructuredClone;
  vi.restoreAllMocks();
});

describe('cloneSetsSnapshot', () => {
  it('uses structuredClone when available', () => {
    const structuredCloneMock = vi.fn((sets) => sets.map((set) => ({ ...set })));
    globalThis.structuredClone = structuredCloneMock;

    const sets = [{ score1: 1, score2: 0, completed: false }];
    const clone = cloneSetsSnapshot(sets);

    expect(structuredCloneMock).toHaveBeenCalledWith(sets);
    expect(clone).toEqual(sets);
    expect(clone).not.toBe(sets);
  });

  it('falls back to cloning set objects when structuredClone is unavailable', () => {
    globalThis.structuredClone = undefined;
    const sets = [{
      score1: 1,
      score2: 0,
      completed: false,
      audit: { events: [{ team: 1, point: 1 }] },
    }];

    const clone = cloneSetsSnapshot(sets);

    expect(clone).toEqual(sets);
    expect(clone).not.toBe(sets);
    expect(clone[0]).not.toBe(sets[0]);
    expect(clone[0].audit).not.toBe(sets[0].audit);
    expect(clone[0].audit.events).not.toBe(sets[0].audit.events);
    expect(clone[0].audit.events[0]).not.toBe(sets[0].audit.events[0]);
  });
});
