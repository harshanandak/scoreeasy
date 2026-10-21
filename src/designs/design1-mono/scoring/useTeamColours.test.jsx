import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TEAM_COLOURS, deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import { motifMaskUrl } from '../../../lib/courtMotifs';
import { sportMarkMaskUrl } from '../../../lib/sportMarks';
import { useTeamColours } from './useTeamColours';

const defaults = teamColourVars(deriveTeamColours(DEFAULT_TEAM_COLOURS.a, DEFAULT_TEAM_COLOURS.b));

describe('useTeamColours', () => {
  it('uses the default pair when no colours are given', () => {
    const { result } = renderHook(() => useTeamColours(undefined, undefined, 'volleyball'));
    expect(result.current['--team-a-core']).toBe(defaults['--team-a-core']);
    expect(result.current['--team-b-core']).toBe(defaults['--team-b-core']);
  });

  it('returns the same object for the same inputs (memoised)', () => {
    const { result, rerender } = renderHook(({ a, b }) => useTeamColours(a, b, 'football'), {
      initialProps: { a: '#facc15', b: '#1d4ed8' },
    });
    const first = result.current;
    rerender({ a: '#facc15', b: '#1d4ed8' });
    expect(result.current).toBe(first);
    rerender({ a: '#16a34a', b: '#1d4ed8' });
    expect(result.current).not.toBe(first);
  });

  it('falls back per team on an invalid colour', () => {
    const { result } = renderHook(() => useTeamColours('url(//x)', '#facc15', 'volleyball'));
    expect(result.current['--team-a-core']).toBe(defaults['--team-a-core']);
    expect(result.current['--team-b-core']).toBe(deriveTeamColours('#d62828', '#facc15').B.core);
  });

  it('adds the court drawing for each team half', () => {
    const { result } = renderHook(() => useTeamColours('#d62828', '#1d4ed8', 'football'));
    expect(result.current['--sport-motif-a']).toBe(motifMaskUrl('football', 'a'));
    expect(result.current['--sport-motif-b']).toBe(motifMaskUrl('football', 'b'));
  });

  it('omits the drawing for a sport without one', () => {
    const { result } = renderHook(() => useTeamColours('#d62828', '#1d4ed8', 'cricket'));
    expect(result.current).not.toHaveProperty('--sport-motif-a');
    expect(result.current).not.toHaveProperty('--sport-motif-b');
    expect(result.current).not.toHaveProperty('--sport-mark');
  });

  it('adds the sport mark (the "show the game" silhouette) when the sport has one', () => {
    const { result } = renderHook(() => useTeamColours('#d62828', '#1d4ed8', 'volleyball'));
    expect(result.current['--sport-mark']).toBe(sportMarkMaskUrl('volleyball'));
  });
});
