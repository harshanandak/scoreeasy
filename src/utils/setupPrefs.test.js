import { beforeEach, describe, expect, it } from 'vitest';
import { withMatchStorageScope } from './accountStorage';
import { loadCustomSetup, saveCustomSetup, SETUP_PREFS_KEY, clearSetupPrefs, loadSetupPrefs, saveSetupPrefs } from './setupPrefs';

beforeEach(() => globalThis.localStorage.clear());

describe('setup prefs', () => {
  it('remembers colours and format per sport', () => {
    saveSetupPrefs('tennis', { colours: ['#d62828', '#1d4ed8'], formatId: 'sets-3' });
    saveSetupPrefs('kabaddi', { colours: null, formatId: 'pro' });
    expect(loadSetupPrefs('tennis')).toEqual({ colours: ['#d62828', '#1d4ed8'], formatId: 'sets-3' });
    expect(loadSetupPrefs('kabaddi')).toEqual({ colours: null, formatId: 'pro' });
    expect(loadSetupPrefs('football')).toBeNull();
  });

  it('never stores team names', () => {
    saveSetupPrefs('tennis', { colours: ['#d62828', '#1d4ed8'], formatId: 'sets-1', names: ['Royals', 'Strikers'] });
    expect(globalThis.localStorage.getItem(SETUP_PREFS_KEY)).not.toMatch(/Royals|Strikers|names/);
  });

  it('clears one sport and keeps the others', () => {
    saveSetupPrefs('tennis', { formatId: 'sets-3' });
    saveSetupPrefs('kabaddi', { formatId: 'pro' });
    clearSetupPrefs('tennis');
    expect(loadSetupPrefs('tennis')).toBeNull();
    expect(loadSetupPrefs('kabaddi')).toEqual({ colours: null, formatId: 'pro' });
  });

  it('reads malformed or clashing data as nothing remembered', () => {
    globalThis.localStorage.setItem(SETUP_PREFS_KEY, '"junk"');
    expect(loadSetupPrefs('tennis')).toBeNull();
    globalThis.localStorage.setItem(SETUP_PREFS_KEY, JSON.stringify({
      tennis: { colours: ['#d62828', '#d62828'], formatId: 7 },
      kabaddi: { colours: ['red', 'blue'] },
    }));
    expect(loadSetupPrefs('tennis')).toBeNull();
    expect(loadSetupPrefs('kabaddi')).toBeNull();
  });
});


describe('saved custom rules', () => {
  it('keeps one setup per sport and isolates accounts and guests', () => {
    const format = { preset: 'custom', overs: 15, players: 8 };
    withMatchStorageScope('scorer-a', () => {
      saveCustomSetup('cricket', { format });
      saveCustomSetup('tennis', { format: { type: 'single', points: 4 } });
      expect(loadCustomSetup('cricket')).toEqual({ format, source: null });
      saveCustomSetup('cricket', { format: { ...format, overs: 12 } });
      expect(loadCustomSetup('cricket').format.overs).toBe(12);
      expect(loadCustomSetup('tennis').format.points).toBe(4);
    });
    withMatchStorageScope('scorer-b', () => expect(loadCustomSetup('cricket')).toBeNull());
    expect(loadCustomSetup('cricket')).toBeNull();
  });
});
