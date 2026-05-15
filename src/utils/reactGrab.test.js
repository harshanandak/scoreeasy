import { describe, expect, it } from 'vitest';
import { shouldLoadReactGrab } from './reactGrab';

describe('shouldLoadReactGrab', () => {
  it('requires development mode and an explicit opt-in flag', () => {
    expect(shouldLoadReactGrab({ DEV: true, VITE_ENABLE_REACT_GRAB: 'true' })).toBe(true);
    expect(shouldLoadReactGrab({ DEV: true })).toBe(false);
    expect(shouldLoadReactGrab({ DEV: false, VITE_ENABLE_REACT_GRAB: 'true' })).toBe(false);
  });
});
