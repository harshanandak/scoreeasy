import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { AppScoringConfirmDialog, AppScoringNotice, useAppScoringPrompt } from '../components/AppScoringPrompt';

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

  it('cancels confirmation dialogs from the safe action, escape key, and backdrop', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    const { rerender } = render(
      <AppScoringConfirmDialog
        cancelLabel="Keep scoring"
        confirmLabel="Discard"
        message="Your unsaved scoring changes will be lost."
        onCancel={onCancel}
        onConfirm={onConfirm}
        title="Discard changes?"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Keep scoring' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    rerender(
      <AppScoringConfirmDialog
        cancelLabel="Keep scoring"
        confirmLabel="Discard"
        message="Your unsaved scoring changes will be lost."
        onCancel={onCancel}
        onConfirm={onConfirm}
        title="Discard changes?"
      />,
    );
    fireEvent.keyDown(globalThis, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByLabelText('Cancel prompt'));
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps keyboard focus and scorer hotkeys inside the confirmation dialog', () => {
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

    const cancelButton = screen.getByRole('button', { name: 'Keep scoring' });
    const confirmButton = screen.getByRole('button', { name: 'Discard' });

    expect(document.activeElement).toBe(cancelButton);

    fireEvent.keyDown(cancelButton, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirmButton);

    const hotkeyListener = vi.fn();
    globalThis.addEventListener('keydown', hotkeyListener);

    fireEvent.keyDown(confirmButton, { key: 'q' });
    expect(hotkeyListener).not.toHaveBeenCalled();

    globalThis.removeEventListener('keydown', hotkeyListener);
  });

  it('locks scorer interaction while the post-save redirect is pending', () => {
    vi.useFakeTimers();
    const navigateAfterSave = vi.fn();
    const { result } = renderHook(() => useAppScoringPrompt());

    act(() => {
      result.current.scheduleDraftRedirect(navigateAfterSave);
    });

    expect(result.current.isInteractionLocked).toBe(true);

    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(navigateAfterSave).toHaveBeenCalledTimes(1);
    expect(result.current.isInteractionLocked).toBe(false);

    vi.useRealTimers();
  });

  it('keeps live scoring files free of browser-owned alerts and confirms', () => {
    for (const componentFile of scoringComponents) {
      const source = readFileSync(new URL(componentFile, import.meta.url), 'utf8');

      expect(source).not.toMatch(/\b(?:alert|confirm)\s*\(/);
    }
  });
});
