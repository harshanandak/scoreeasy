import { fireEvent, screen } from '@testing-library/react';

// The quick-setup colour choice is a button beside the team name that opens a dialog holding the
// swatch group. These helpers open it (once) and return the group, so a test can keep asserting
// which swatch is pressed and which colour reaches the match.
export function teamColourGroup(letter) {
  const name = `Team ${letter} colour`;
  if (!screen.queryByRole('group', { name })) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}:`) }));
  }
  return screen.getByRole('group', { name });
}

export async function findTeamColourGroup(letter) {
  await screen.findByRole('button', { name: new RegExp(`^Team ${letter} colour:`) });
  return teamColourGroup(letter);
}
