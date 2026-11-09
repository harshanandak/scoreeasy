import { render } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import ChunkReloadReset from './ChunkReloadReset';
import { CHUNK_RELOAD_KEY } from '../utils/chunkReload';

beforeEach(() => {
  globalThis.sessionStorage.clear();
});

it('clears the recorded reload attempt once it mounts (the route rendered)', () => {
  globalThis.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  render(<ChunkReloadReset />);
  expect(globalThis.sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull();
});
