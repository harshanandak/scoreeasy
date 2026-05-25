import { describe, expect, it } from 'vitest';
import finalTheme, { MONO, SWISS } from '../landing/landingTheme';
import {
  fontStacks,
  getReadableTextColor,
  getSportAccent,
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

  it('uses a restrained field-green and pitch-brown palette for the priority sports', () => {
    const priorityAccentColors = prioritySports.map((sport) => sportAccents[sport].primary);
    const priorityFieldColors = prioritySports.map((sport) => sportAccents[sport].field);

    expect(new Set(priorityAccentColors)).toEqual(new Set(['oklch(0.6230 0.1688 149.1777)']));
    expect(new Set(priorityFieldColors)).toEqual(new Set(['oklch(0.6082 0.1213 58.2537)']));
    expect(sportAccents.cricket.primary).toBe(sportsTokens.color.action);
    expect(sportAccents.football.soft).toBe(sportsTokens.color.actionSoft);
    expect(sportAccents.volleyball.field).toBe(sportAccents.cricket.field);
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
    expect(sportsCssVariables['--se-color-action-strong']).toBe(sportsTokens.color.actionStrong);
    expect(sportsCssVariables['--se-color-canvas']).toBe(sportsTokens.color.canvas);
    expect(sportsCssVariables['--se-color-inverse']).toBe(sportsTokens.color.inverse);
    expect(sportsCssVariables['--se-font-mono']).toBe(fontStacks.mono);
    expect(sportsCssVariables['--se-motion-standard']).toBe(sportsTokens.motion.standard);
  });

  it('returns named sport accents and a stable fallback accent', () => {
    expect(getSportAccent('football')).toBe(sportAccents.football);
    expect(getSportAccent('unknown')).toMatchObject({
      name: 'Sport',
      primary: sportsTokens.color.action,
      soft: sportsTokens.color.actionSoft,
    });
  });

  it('chooses readable text for bright sport accent backgrounds', () => {
    expect(getReadableTextColor(sportAccents.cricket.primary)).toBe(sportsTokens.color.inverse);
    expect(getReadableTextColor(sportAccents.football.primary)).toBe(sportsTokens.color.inverse);
    expect(getReadableTextColor(sportAccents.racquet.primary)).toBe(sportsTokens.color.inverse);
  });
});
