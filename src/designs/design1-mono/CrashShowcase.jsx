import { useSearchParams } from 'react-router-dom';
import ErrorBoundary from '../../components/ErrorBoundary';
import { CHUNK_RELOAD_KEY } from '../../utils/chunkReload';

// Internal route (SHOW_INTERNAL_ROUTES only, never in a production build): forces the
// crash screen so its two variants can be reviewed. /showcase/crash?kind=chunk shows the
// "new version" screen, anything else shows the generic one.
function Boom({ kind }) {
  if (kind === 'chunk') {
    // Pretend a reload just happened, so the boundary shows the screen instead of reloading.
    try {
      globalThis.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    } catch {
      // Storage blocked: the boundary will show the screen anyway.
    }
    throw new TypeError('Failed to fetch dynamically imported module: /assets/Old-deadbeef.js');
  }
  throw new Error('Forced crash for the showcase');
}

export default function CrashShowcase() {
  const [params] = useSearchParams();
  return (
    <ErrorBoundary captureToSentry={false}>
      <Boom kind={params.get('kind')} />
    </ErrorBoundary>
  );
}
