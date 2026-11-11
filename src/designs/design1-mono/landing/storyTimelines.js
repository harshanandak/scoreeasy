// The approved M1 story timelines, in seconds. These illustrate rules, not persisted matches.
export const STORIES = [
  {
    sport: 'tennis', label: 'Start a tennis match', theme: '#1b2a63',
    gradient: 'linear-gradient(170deg,#25377d 0%,#16205a 55%,#0f1740 100%)',
    duration: 9.2,
    initial: { call: 'Love all', pa: '0', pb: '0', ga: '0', gb: '0', gameNo: '1', srv: 'a' },
    steps: [
      [1, { pa: '15', call: '15–love', tap: 'a' }],
      [1.8, { pb: '15', call: '15 all', tap: 'b' }],
      [2.6, { pa: '30', call: '30–15', tap: 'a' }],
      [3.4, { pb: '30', call: '30 all', tap: 'b' }],
      [4.2, { pa: '40', call: '40–30', tap: 'a' }],
      [5, { pb: '40', call: 'Deuce', tap: 'b' }],
      [6.2, { pa: 'AD', call: 'Advantage Asha', tap: 'a' }],
      [7.4, { pa: '0', pb: '0', ga: '1', gameNo: '2', call: 'Game Asha', srv: 'b', tap: 'a' }],
    ],
  },
  {
    sport: 'cricket', label: 'Start a cricket match', theme: '#2f62f2',
    gradient: 'linear-gradient(170deg,#3a6bf5 0%,#2148d6 55%,#14309e 100%)',
    duration: 8.4, initial: { runs: '0', balls: [], slots: 6 },
    steps: [
      [0.9, { runs: '1', balls: ['1'] }],
      [1.7, { runs: '5', balls: ['1', '4'] }],
      [2.5, { runs: '11', balls: ['1', '4', '6'] }],
      [3.6, { runs: '5', balls: ['1', '4'], slots: 5, gone: true, press: true }],
      [3.82, { press: false }],
      [4.02, { gone: false }],
      [4.7, { runs: '7', balls: ['1', '4', '2'], slots: 6 }],
      [5.5, { runs: '7', balls: ['1', '4', '2', 'W'] }],
      [6.3, { runs: '8', balls: ['1', '4', '2', 'W', '1'] }],
    ],
  },
  {
    sport: 'football', label: 'Start a football match', theme: '#0f8a45',
    gradient: 'linear-gradient(170deg,#139a4e 0%,#0b7a3c 55%,#06502a 100%)',
    duration: 8, initial: { you: '0', riya: '0', youChip: 'online', riyaChip: 'live' },
    steps: [
      [1, { you: '1' }], [1.5, { riya: '1' }], [2.7, { youChip: 'nosignal' }],
      [3.5, { you: '2', youChip: 'saved' }], [5, { youChip: 'online' }],
      [5.5, { riya: '2', riyaChip: 'synced' }], [6.9, { riyaChip: 'live' }],
    ],
  },
  {
    label: 'Pick your sport', theme: '#7447e0',
    gradient: 'linear-gradient(170deg,#7d52e8 0%,#5a30c8 55%,#3f1c9c 100%)',
    duration: 6, initial: { moms: 0 },
    steps: [[0.5, { moms: 1 }], [1.6, { moms: 2 }], [2.7, { moms: 3 }]],
  },
];

export function storyFrame(index, time) {
  const story = STORIES[index];
  const state = { ...story.initial };
  let step = -1;
  story.steps.forEach(([at, patch], n) => {
    if (at <= time) { Object.assign(state, patch); step = n; }
  });
  return { ...state, step };
}
