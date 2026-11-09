import '@testing-library/jest-dom';
import { configure } from '@testing-library/dom';
import { beforeEach } from 'vitest';

configure({ asyncUtilTimeout: 5000 });

// Quick setup remembers colours and the last custom rules per sport in account-scoped localStorage
// keys (matchStorageKey prefixes them). A test must never inherit another test's remembered choices.
beforeEach(() => {
  try {
    const store = globalThis.localStorage;
    if (!store) return;
    const keys = [];
    for (let i = 0; i < store.length; i += 1) keys.push(store.key(i));
    for (const k of keys) {
      if (k && (k.endsWith('se_setup_prefs_v1') || k.endsWith('se_custom_setup_v1'))) store.removeItem(k);
    }
  } catch {
    // Storage can be unavailable in a test that stubs it.
  }
});
