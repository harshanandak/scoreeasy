import { beforeEach, describe, expect, it } from 'vitest';
import { SETUP_PREFS_KEY, clearSetupPrefs, loadSetupPrefs, saveSetupPrefs } from './setupPrefs';

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
