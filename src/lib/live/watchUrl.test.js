import { describe, it, expect } from 'vitest';
import { watchUrl } from './watchUrl';

describe('watchUrl', () => {
  it('builds the canonical production spectator URL', () => {
    expect(watchUrl('ABCD2345')).toBe('https://scoreeasy.app/live/ABCD2345');
  });
});
