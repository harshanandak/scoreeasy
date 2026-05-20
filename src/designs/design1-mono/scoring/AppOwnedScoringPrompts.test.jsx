import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppScoringConfirmDialog, AppScoringNotice } from '../components/AppScoringPrompt';

const scoringComponents = [
  'MonoCricketLiveScore.jsx',
  'MonoCricketTestLiveScore.jsx',
  'MonoGoalsLiveScore.jsx',
  'MonoSetsLiveScore.jsx',
  'MonoTennisLiveScore.jsx',
];

describe('app-owned scoring prompts', () => {
  it('renders dismissible in-app notices for scoring feedback', () => {
    const onDismiss = vi.fn();

    render(
      <AppScoringNotice
        message="Draft saved. You can resume this match later."
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Draft saved');

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders in-app confirmation dialogs instead of browser prompts', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <AppScoringConfirmDialog
        cancelLabel="Keep scoring"
        confirmLabel="Discard"
        message="Your unsaved scoring changes will be lost."
        onCancel={onCancel}
        onConfirm={onConfirm}
        title="Discard changes?"
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('keeps live scoring files free of browser-owned alerts and confirms', () => {
    for (const componentFile of scoringComponents) {
      const source = readFileSync(new URL(componentFile, import.meta.url), 'utf8');

      expect(source).not.toMatch(/\b(?:alert|confirm)\s*\(/);
    }
  });
});
