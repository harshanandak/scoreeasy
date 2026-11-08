export const ABANDONED_LABEL = 'Abandoned · no result';
export const EARLY_FINISH_MESSAGE = 'This match is not decided. It will be recorded as abandoned / no result, keeping the current score and awarding no winner.';

export function isAbandoned(match) {
  return match?.resultType === 'abandoned' || match?.status === 'abandoned';
}

// Only new finishes call this. Old records keep their stored outcome.
export function recordMatchOutcome(match, decided) {
  return {
    ...match,
    status: 'completed',
    resultType: decided ? 'decided' : 'abandoned',
    winner: decided ? match.winner : null,
    ...(decided ? {} : { winDesc: '' }),
  };
}
