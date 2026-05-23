import { describe, expect, it } from 'vitest';
import finalTheme, { MONO, SWISS } from '../landing/landingTheme';
import {
  fontStacks,
  landingTokenBridge,
  prioritySports,
  sportAccents,
  sportsCssVariables,
  sportsTokens,
} from './sportsTokens';

describe('sports design tokens', () => {
  it('keeps cricket and football first in the priority sports list', () => {
    expect(prioritySports.slice(0, 2)).toEqual(['cricket', 'football']);
    expect(prioritySports).toContain('volleyball');
  });

  it('defines distinct sport accents for the most important sports', () => {
    const priorityAccentColors = prioritySports.map((sport) => sportAccents[sport].primary);

    expect(new Set(priorityAccentColors).size).toBe(priorityAccentColors.length);
    expect(sportAccents.cricket.primary).toBe(sportsTokens.color.action);
    expect(sportAccents.football.field).toBe('#15803d');
  });

  it('bridges central tokens into the current landing theme contract', () => {
    expect(MONO).toBe(fontStacks.mono);
    expect(SWISS).toBe(fontStacks.sans);
    expect(finalTheme.blue).toBe(sportsTokens.color.action);
    expect(finalTheme.bg).toBe(sportsTokens.color.canvas);
    expect(finalTheme.border).toBe(sportsTokens.color.line);
    expect(finalTheme.cardShadow).toBe(sportsTokens.shadow.card);
    expect(finalTheme.featureIconHoverColor).toBe(landingTokenBridge.blue);
  });

  it('exposes app-wide css variable names for non-react surfaces', () => {
    expect(sportsCssVariables['--se-color-action']).toBe(sportsTokens.color.action);
    expect(sportsCssVariables['--se-color-canvas']).toBe(sportsTokens.color.canvas);
    expect(sportsCssVariables['--se-font-mono']).toBe(fontStacks.mono);
    expect(sportsCssVariables['--se-motion-standard']).toBe(sportsTokens.motion.standard);
  });
});
