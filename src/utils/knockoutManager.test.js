import { describe, expect, it } from 'vitest';
import { updateKnockoutBracket } from './knockoutManager';

describe('updateKnockoutBracket', () => {
  it('places a single play-in winner into the open seeded semi-final slot', () => {
    const playIn = {
      id: 'play-in-1',
      round: 'play-in-1',
      team1Id: 'team4',
      team2Id: 'team5',
      status: 'completed',
      winner: 'team5',
    };
    const semi = {
      id: 'semi-1',
      round: 'semi-1',
      team1Id: 'team1',
      team2Id: null,
      status: 'pending',
      sourceMatchIds: ['play-in-1'],
      sourceSlots: ['team2Id'],
    };

    expect(updateKnockoutBracket([playIn, semi])[1]).toMatchObject({
      team1Id: 'team1',
      team2Id: 'team5',
    });
  });

  it('refreshes pending source-linked matches when an upstream winner changes', () => {
    const semi1 = {
      id: 'semi-1',
      round: 'semi-1',
      team1Id: 'team1',
      team2Id: 'team4',
      status: 'completed',
      winner: 'team1',
    };
    const semi2 = {
      id: 'semi-2',
      round: 'semi-2',
      team1Id: 'team2',
      team2Id: 'team3',
      status: 'completed',
      winner: 'team2',
    };
    const final = {
      id: 'final',
      round: 'final',
      team1Id: 'team4',
      team2Id: 'team2',
      status: 'pending',
      sourceMatchIds: ['semi-1', 'semi-2'],
      sourceSlots: ['team1Id', 'team2Id'],
    };

    expect(updateKnockoutBracket([semi1, semi2, final])[2]).toMatchObject({
      team1Id: 'team1',
      team2Id: 'team2',
    });
  });
});
