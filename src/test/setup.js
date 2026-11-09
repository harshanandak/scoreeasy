import '@testing-library/jest-dom';
import { configure } from '@testing-library/dom';
import { beforeEach } from 'vitest';

configure({ asyncUtilTimeout: 5000 });

// Quick setup remembers colours and format per sport in localStorage. A test must never inherit
// another test's remembered choices.
beforeEach(() => {
  try {
    globalThis.localStorage?.removeItem('se_setup_prefs_v1');
  } catch {
    // Storage can be unavailable in a test that stubs it.
  }
});
