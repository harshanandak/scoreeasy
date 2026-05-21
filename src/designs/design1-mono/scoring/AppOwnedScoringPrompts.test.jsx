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
    expect(screen.getByText('Saved locally')).toBeInTheDocument();

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
        tone="danger"
        title="Discard changes?"
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toHaveClass('app-confirm-danger');

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

    const modifiedShortcutListener = vi.fn();
    globalThis.addEventListener('keydown', modifiedShortcutListener);

    fireEvent.keyDown(confirmButton, { key: 'w', ctrlKey: true });
    expect(modifiedShortcutListener).toHaveBeenCalledTimes(1);

    globalThis.removeEventListener('keydown', modifiedShortcutListener);
  });

  it('keeps the shared app confirmation shell mobile-safe and app-owned', () => {
    const source = readFileSync(`${import.meta.dirname}/../index.jsx`, 'utf8');
    const confirmUtils = readFileSync(`${import.meta.dirname}/../components/appConfirmUtils.js`, 'utf8');

    expect(source).toContain('handleAppConfirmKeyDown');
    expect(confirmUtils).toContain('APP_CONFIRM_BLOCKED_KEYS');
    expect(confirmUtils).toContain('APP_CONFIRM_FOCUSABLE_SELECTOR');
    expect(confirmUtils).toContain('!hasBrowserModifier');
    expect(source).toContain('tabIndex={-1}');
    expect(source).toContain("tone: 'danger'");
    expect(source).toContain('.app-confirm-danger');
    expect(source).toContain('.app-scoring-notice');
    expect(source).toContain('@media (max-width: 767px)');
    expect(source).toContain('env(safe-area-inset-bottom, 0px)');
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

  it('marks discard prompts as destructive app actions', () => {
    const { result } = renderHook(() => useAppScoringPrompt());

    act(() => {
      result.current.requestDiscardPrompt();
    });

    expect(result.current.pendingPrompt).toMatchObject({
      cancelLabel: 'Keep scoring',
      confirmLabel: 'Discard',
      tone: 'danger',
      title: 'Discard changes?',
    });
  });

  it('locks all sets scorer controls during delayed draft redirects', () => {
    const setsComponentFile = 'MonoSetsLiveScore.jsx';
    const source = readFileSync(new URL(setsComponentFile, import.meta.url), 'utf8');

    expect(source).toContain('const isInteractionLocked = scoringPrompt.isInteractionLocked');
    expect(source).toMatch(/const handleSwapSides = \(\) => \{\s+if \(isInteractionLocked\) return;/);
    expect(source).toMatch(/const handleToggleScoringMode = \(\) => \{\s+if \(isInteractionLocked\) return;/);
    expect(source).toContain('disabled={isInteractionLocked}');
    expect(source).toContain('tabIndex={canScoreCurrentSet ? 0 : -1}');
    expect(source).toMatch(/isInteractionLocked\r?\n {4}\? 'Scoring is temporarily locked'/);
    expect(source).toMatch(/isInteractionLocked\r?\n {4}\? 'Scoring locked'/);
  });

  it('locks completion actions while post-save redirects are pending', () => {
    const sourceByComponent = Object.fromEntries(scoringComponents.map((componentFile) => [
      componentFile,
      readFileSync(new URL(componentFile, import.meta.url), 'utf8'),
    ]));

    expect(sourceByComponent['MonoCricketLiveScore.jsx']).toContain('if (!tournament || !match || scoringPrompt.isInteractionLocked) return;');
    expect(sourceByComponent['MonoGoalsLiveScore.jsx']).toMatch(/const saveMatch = \(\) => \{\s+if \(scoringPrompt\.isInteractionLocked\) return;/);
    expect(sourceByComponent['MonoSetsLiveScore.jsx']).toMatch(/const saveMatch = \(\) => \{\s+if \(isInteractionLocked\) return;/);
    expect(sourceByComponent['MonoTennisLiveScore.jsx']).toMatch(/const saveMatch = \(\) => \{\s+if \(scoringPrompt\.isInteractionLocked\) return;/);
    expect(sourceByComponent['MonoTennisLiveScore.jsx']).toContain('const canScoreCurrentSet = !currentSetData.completed && !scoringPrompt.isInteractionLocked');
    expect(sourceByComponent['MonoTennisLiveScore.jsx']).toMatch(/scoringPrompt\.isInteractionLocked\r?\n {4}\? 'Scoring is temporarily locked'/);
    expect(sourceByComponent['MonoCricketTestLiveScore.jsx']).toMatch(/const saveCompleteMatch = \(\) => \{\s+if \(scoringPrompt\.isInteractionLocked\) return;/);
  });

  it('pauses timed goal auto-finish before delayed draft redirects', () => {
    const goalsComponentFile = 'MonoGoalsLiveScore.jsx';
    const source = readFileSync(new URL(goalsComponentFile, import.meta.url), 'utf8');

    expect(source).toContain('const autoFinishTimeoutRef = useRef(null);');
    expect(source).toContain('if (!tournament || !sportConfig || scoringPrompt.isInteractionLocked) return undefined;');
    expect(source).toContain('clearTimeout(autoFinishTimeoutRef.current);');
    expect(source).toContain('timer.pause();');
    expect(source).toMatch(/timer\.pause\(\);\s+setHasChanges\(false\);\s+scoringPrompt\.scheduleDraftRedirect\(navigateToTournament\);/);
  });

  it('keeps live scoring files free of browser-owned alerts and confirms', () => {
    for (const componentFile of scoringComponents) {
      const source = readFileSync(new URL(componentFile, import.meta.url), 'utf8');

      expect(source).not.toMatch(/\b(?:alert|confirm)\s*\(/);
    }
  });
});
