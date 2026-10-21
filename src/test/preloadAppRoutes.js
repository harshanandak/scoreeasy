// Preload every React.lazy() route chunk that the Design1Mono app shell
// (src/designs/design1-mono/index.jsx) code-splits out.
//
// Why: app-level tests render the real shell and navigate into lazy routes. On
// first navigation React.lazy() kicks off a cold dynamic import(), and vitest
// has to transform and evaluate that route's whole module graph *inside* the
// test's findBy/waitFor window. Under a parallel full-suite run that one-time
// cost can exceed the 5s async-util timeout, so the test flakes even though the
// route renders correctly. Awaiting this at the top level of a test module
// moves the cost into module collection (where the static `import Design1Mono`
// cost already lives, and which has no timeout), so every lazy() factory then
// resolves from the module cache in a microtask.
//
// The specifiers are read from index.jsx itself, so a newly added lazy route is
// preloaded automatically and a renamed/removed one fails loudly here instead of
// silently reintroducing the flake. vi.mock() registrations in the calling test
// file still apply: a mocked route resolves to its mock.
import appShellSource from '../designs/design1-mono/index.jsx?raw';

const routeModules = import.meta.glob('../designs/design1-mono/**/*.{js,jsx}');

const APP_SHELL_DIR = '../designs/design1-mono/';
const LAZY_IMPORT = /lazy\(\s*\(\)\s*=>\s*import\(\s*['"](\.\/[^'"]+)['"]\s*\)\s*\)/g;

export function getLazyRouteSpecifiers(source = appShellSource) {
  return [...source.matchAll(LAZY_IMPORT)].map((match) => match[1]);
}

function resolveLoader(specifier) {
  const base = APP_SHELL_DIR + specifier.slice(2);
  const candidates = [base, `${base}.jsx`, `${base}.js`, `${base}/index.jsx`, `${base}/index.js`];
  const key = candidates.find((candidate) => routeModules[candidate]);
  if (!key) {
    throw new Error(`preloadAppRoutes: cannot resolve lazy route "${specifier}" from index.jsx`);
  }
  return routeModules[key];
}

export async function preloadAppRoutes() {
  const specifiers = getLazyRouteSpecifiers();
  if (specifiers.length === 0) {
    throw new Error('preloadAppRoutes: found no lazy(() => import()) routes in index.jsx');
  }
  await Promise.all(specifiers.map((specifier) => resolveLoader(specifier)()));
  return specifiers;
}
