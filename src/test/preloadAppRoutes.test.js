import { describe, expect, it } from 'vitest';
import appShellSource from '../designs/design1-mono/index.jsx?raw';
import { getLazyRouteSpecifiers } from './preloadAppRoutes';

describe('preloadAppRoutes', () => {
  it('finds every React.lazy() route in the app shell', () => {
    // If a lazy() call is written in a shape the extractor does not recognise,
    // that route would silently stay cold in app-level tests and bring the
    // findBy/waitFor timeout flake back. Keep the two counts in lockstep.
    const lazyCalls = appShellSource.match(/\blazy\(/g) ?? [];
    const specifiers = getLazyRouteSpecifiers();

    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers).toHaveLength(lazyCalls.length);
  });

  it('extracts relative specifiers from lazy(() => import()) calls', () => {
    const source = `
      const A = lazy(() => import('./A'));
      const B = lazy(() => import("./nested/B"));
    `;

    expect(getLazyRouteSpecifiers(source)).toEqual(['./A', './nested/B']);
  });
});
