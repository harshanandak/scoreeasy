import { describe, expect, it } from 'vitest';
import { guidedRulesForMatch, resolveGuidedRules, guidedCompletionReason } from './cricketRules';
import { applyDelivery, createInnings, deriveChase, deriveInnings, makeDelivery } from './cricketEngine';

describe('versioned guided rules', () => {
  const setup = { overs: 5, players: 6, freeHit: false, lastManStands: true, noLBW: true,
    powerplay: [{ start: 1, end: 2, label: 'Powerplay' }] };

  it('resolves the setup names without sharing mutable rule objects', () => {
    const rules = resolveGuidedRules(setup);
    expect(rules).toMatchObject({ rulesVersion: 1, oversPerInnings: 5, playersPerSide: 6,
      maxLegalBalls: 30, freeHitOnNoBall: false, houseRules: { lastManStands: true, noLBW: true } });
    expect(Object.isFrozen(rules)).toBe(true);
    expect(Object.isFrozen(rules.houseRules)).toBe(true);
    expect(Object.isFrozen(rules.powerplays[0])).toBe(true);
    expect(rules.powerplays).not.toBe(setup.powerplay);
  });

  it('keeps the resolved snapshot when tournament settings change, including after JSON persistence', () => {
    const cricketRules = JSON.parse(JSON.stringify(guidedRulesForMatch({ status: 'pending' }, setup)));
    expect(guidedRulesForMatch({ cricketRules }, { overs: 20, players: 11 })).toEqual(cricketRules);
  });

  it('preserves the old engine defaults for an in-flight setup-shaped match', () => {
    const rules = guidedRulesForMatch({ status: 'in-progress' }, setup);
    expect(rules).toMatchObject({ rulesVersion: 0, oversPerInnings: 20, playersPerSide: 11,
      maxLegalBalls: 120, freeHitOnNoBall: true });
    expect(guidedCompletionReason(createInnings(), { runs: 0, wkts: 10, legalBalls: 10 }, rules)).toBe('allout');
  });

  it('preserves canonical old rules and the saved innings player count', () => {
    const rules = guidedRulesForMatch({ draftState: { phase: 'innings1', guidedInnings: { playersPerSide: 3 } } },
      { oversPerInnings: 2, ballsPerOver: 8, freeHitOnNoBall: false, houseRules: { lastManStands: true } });
    expect(rules).toMatchObject({ rulesVersion: 0, maxLegalBalls: 16, playersPerSide: 3, freeHitOnNoBall: false });
    expect(guidedCompletionReason(createInnings({ playersPerSide: 3 }), { runs: 0, wkts: 2, legalBalls: 2 }, rules)).toBe('allout');
  });

  it('uses the fixed legal-ball limit for chase figures as well as completion', () => {
    const rules = resolveGuidedRules({ trackOvers: false, maxBalls: 7 });
    const innings = applyDelivery(createInnings({ target: 20 }), makeDelivery({ batsmanRuns: 1 }), rules);
    expect(deriveChase(innings, rules).ballsLeft).toBe(6);
    expect(guidedCompletionReason(innings, deriveInnings(innings, rules), rules)).toBeNull();
  });

  it('keeps unlimited innings unlimited', () => {
    const rules = resolveGuidedRules({ overs: null });
    expect(rules.maxLegalBalls).toBeNull();
    expect(guidedCompletionReason(createInnings(), { runs: 1, wkts: 0, legalBalls: 1000 }, rules)).toBeNull();
  });
});
