import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CRICKET_RUN_VALUES, isCricketRunKey } from './cricketRunControls';

const cricketScoreSourceFiles = [
  'src/designs/design1-mono/MonoQuickMatch.jsx',
  'src/designs/design1-mono/scoring/MonoCricketLiveScore.jsx',
  'src/designs/design1-mono/scoring/MonoCricketTestLiveScore.jsx',
];

describe('cricketRunControls', () => {
  it('includes every legal ball run input including five', () => {
    expect(CRICKET_RUN_VALUES).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('accepts keyboard run shortcuts for zero through six', () => {
    for (const key of ['0', '1', '2', '3', '4', '5', '6']) {
      expect(isCricketRunKey(key)).toBe(true);
    }
    expect(isCricketRunKey('w')).toBe(false);
    expect(isCricketRunKey('10')).toBe(false);
  });

  it('uses the shared cricket run values in each cricket scoring surface', () => {
    for (const sourceFile of cricketScoreSourceFiles) {
      const source = readFileSync(join(process.cwd(), sourceFile), 'utf8');
      expect(source).toContain('CRICKET_RUN_VALUES');
      expect(source).not.toContain('[0, 1, 2, 3, 4, 6]');
    }
  });
});
