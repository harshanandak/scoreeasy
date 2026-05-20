import { describe, expect, it } from 'vitest';
import { getPriorityStartActions, getSportStartLabel } from './startActions';

describe('start action labels', () => {
  it('uses sport names instead of generic match copy', () => {
    expect(getSportStartLabel('volleyball')).toBe('Start Volleyball');
    expect(getSportStartLabel('cricket')).toBe('Start Cricket');
    expect(getSportStartLabel('football')).toBe('Start Football');
    expect(getSportStartLabel('missing-sport')).toBe('Start Match');
  });

  it('keeps cricket and football ahead of volleyball in priority starts', () => {
    expect(getPriorityStartActions()).toEqual([
      { label: 'Start Cricket', primary: true, sportId: 'cricket' },
      { label: 'Start Football', primary: false, sportId: 'football' },
      { label: 'Start Volleyball', primary: false, sportId: 'volleyball' },
    ]);
  });
});
