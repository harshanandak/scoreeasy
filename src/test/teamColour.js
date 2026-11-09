import { fireEvent, screen, within } from '@testing-library/react';

// Quick setup is a few steps. Team name and colour are edited together in one team sheet that opens
// from the Teams step. These helpers open the right step and sheet (closing another team's sheet
// first) and return the control, so a test keeps asserting the same names, the same pressed swatch
// and the same colour reaching the match.

export function closeOpenSheet() {
  const open = screen.queryByRole('dialog');
  if (open) fireEvent.click(within(open).getByRole('button', { name: 'Done' }));
}

export function goToSetupStep(label) {
  closeOpenSheet();
  if (screen.queryByRole('button', { name: label, current: 'step' })) return;
  fireEvent.click(screen.getByRole('button', { name: label }));
}

export function openTeamSheet(letter) {
  const sheet = screen.queryByRole('dialog', { name: `Team ${letter}` });
  if (sheet) return sheet;
  goToSetupStep('Teams');
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Edit Team ${letter}:`) }));
  return screen.getByRole('dialog', { name: `Team ${letter}` });
}

export function teamNameInput(letter) {
  return within(openTeamSheet(letter)).getByRole('textbox', { name: `Team ${letter} name` });
}

export function teamColourGroup(letter) {
  return within(openTeamSheet(letter)).getByRole('group', { name: `Team ${letter} colour` });
}

export async function findTeamNameInput(letter) {
  await screen.findByRole('button', { name: 'Teams' });
  return teamNameInput(letter);
}

export async function findTeamColourGroup(letter) {
  await screen.findByRole('button', { name: 'Teams' });
  return teamColourGroup(letter);
}
