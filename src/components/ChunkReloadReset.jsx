import { useEffect } from 'react';
import { clearChunkReloadAttempt } from '../utils/chunkReload';

// Rendered inside the app's route boundary and Suspense. Its effect runs only once the route
// content has rendered, so it marks a successful startup: the reload that fixed a stale chunk
// worked, and the next stale chunk may reload automatically again.
export default function ChunkReloadReset() {
  useEffect(() => {
    clearChunkReloadAttempt();
  }, []);
  return null;
}
