// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { choosePlan, parseNameStatus } from './pre-push-tests.mjs';

const planFor = (status, ...paths) => choosePlan({
  changes: [{ status, paths }], baseOk: true,
});

describe('choosePlan', () => {
  it('selects related tests for a modified source file', () => {
    expect(planFor('M', 'src/scoring.js')).toEqual({ mode: 'related' });
  });

  it.each(['leaf.js', 'payload.json', 'theme.css'])('runs all tests for deletion or rename of %s', (path) => {
    expect(planFor('D', path)).toEqual({
      mode: 'full', reason: `tracked file deleted/renamed (${path})`, nativeTriggers: false,
    });
    expect(planFor('R100', path, `assets/${path}`)).toEqual({
      mode: 'full', reason: `tracked file deleted/renamed (${path} -> assets/${path})`, nativeTriggers: false,
    });
  });

  it.each(['vite.config.js', 'vitest.config.mjs'])('runs all tests before loading changed %s', (path) => {
    expect(planFor('M', path)).toEqual({
      mode: 'full', reason: `test environment changed (${path})`, nativeTriggers: false,
    });
  });

  it.each(['package.json', 'bun.lock', 'src/test/setup.js', 'tsconfig.json'])('uses native full-suite triggers for %s', (path) => {
    expect(planFor('M', path)).toEqual({
      mode: 'full', reason: `test environment changed (${path})`, nativeTriggers: true,
    });
  });

  it('runs all tests when the selection script changes', () => {
    expect(planFor('M', 'scripts/pre-push-tests.mjs')).toMatchObject({ mode: 'full', nativeTriggers: false });
  });

  it('uses related mode for docs-only changes, allowing Vitest to report no related tests', () => {
    expect(planFor('M', 'docs/README.md')).toEqual({ mode: 'related' });
  });

  it.each([
    [false, false, 'Missing base origin/master'],
    [true, false, 'No common ancestor between HEAD and origin/master'],
  ])('blocks when baseOk=%s and mergeBaseOk=%s', (baseOk, mergeBaseOk, problem) => {
    expect(choosePlan({ changes: [], baseOk, mergeBaseOk })).toEqual({
      mode: 'blocked',
      message: `${problem}. Run \`git fetch origin master\`. For a shallow clone, also run \`git fetch --unshallow origin\`, then retry.`,
    });
  });
});

it('parses NUL-delimited name-status entries including rename paths and unusual filenames', () => {
  expect(parseNameStatus('M\0src/a.js\0D\0payload.json\0R100\0old name.css\0new\nname.css\0')).toEqual([
    { status: 'M', paths: ['src/a.js'] },
    { status: 'D', paths: ['payload.json'] },
    { status: 'R100', paths: ['old name.css', 'new\nname.css'] },
  ]);
});
