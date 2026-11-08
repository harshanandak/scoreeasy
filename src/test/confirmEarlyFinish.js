import { fireEvent, screen, within } from '@testing-library/react';

export function confirmEarlyFinish() {
  const dialog = screen.queryByRole('dialog', { name: 'End match?' });
  if (dialog) fireEvent.click(within(dialog).getByRole('button', { name: 'End match' }));
}
