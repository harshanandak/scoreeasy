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

  it('only lets the topmost app confirmation dialog handle escape', () => {
    const lowerCancel = vi.fn();
    const topCancel = vi.fn();

    render(
      <>
        <AppScoringConfirmDialog
          confirmLabel="Discard"
          message="Lower dialog"
          onCancel={lowerCancel}
          onConfirm={vi.fn()}
          title="Lower confirm"
        />
        <AppScoringConfirmDialog
          confirmLabel="Leave"
          message="Top dialog"
          onCancel={topCancel}
          onConfirm={vi.fn()}
          title="Top confirm"
        />
      </>,
    );

    fireEvent.keyDown(globalThis, { key: 'Escape' });

    expect(topCancel).toHaveBeenCalledTimes(1);
    expect(lowerCancel).not.toHaveBeenCalled();
  });

  it('keeps the shared app confirmation shell mobile-safe and app-owned', () => {
    const source = readFileSync(`${import.meta.dirname}/../index.jsx`, 'utf8');
    const confirmUtils = readFileSync(`${import.meta.dirname}/../components/appConfirmUtils.js`, 'utf8');

    expect(source).toContain('handleAppConfirmKeyDown');
    expect(source).toContain("addEventListener('keydown', handleKeyDown, true)");
    expect(confirmUtils).toContain('APP_CONFIRM_BLOCKED_KEYS');
    expect(confirmUtils).toContain('APP_CONFIRM_FOCUSABLE_SELECTOR');
    expect(confirmUtils).toContain('isTopmostAppConfirmDialog');
    expect(confirmUtils).toContain('stopImmediatePropagation');
    expect(confirmUtils).toContain('!hasBrowserModifier');
    expect(source).toContain('tabIndex={-1}');
    expect(source).toContain("tone: 'danger'");
    expect(source).toContain('.app-confirm-danger');
    expect(source).toContain('.app-scoring-notice');
    expect(source).toContain('@media (max-width: 767px)');
    expect(source).toContain('env(safe-area-inset-bottom, 0px)');
  });

  it('keeps active scorer layouts compact and thumb-reachable on mobile', () => {
    const monoCss = readFileSync(`${import.meta.dirname}/../mono.css`, 'utf8');
    const quickMatchSource = readFileSync(`${import.meta.dirname}/../MonoQuickMatch.jsx`, 'utf8');
    const sourceByComponent = Object.fromEntries(scoringComponents.map((componentFile) => [
      componentFile,
      readFileSync(new URL(componentFile, import.meta.url), 'utf8'),
    ]));

    expect(monoCss).toContain('.mono-scorer-screen');
    expect(monoCss).toContain('.mono-scorer-control-strip');
    expect(monoCss).toMatch(/\.mono-scorer-control-strip\s*\{[\s\S]*position:\s*sticky/);
    expect(monoCss).toMatch(/\.mono-scorer-control-strip\s*\{[\s\S]*bottom:\s*0/);
    expect(monoCss).toContain('env(safe-area-inset-bottom, 0px)');
    expect(monoCss).toContain('clamp(2.75rem, 16vw, 3.5rem)');
    expect(monoCss).toContain('grid-template-columns: repeat(7, minmax(0, 1fr))');
    expect(monoCss).toContain('@media (max-width: 640px) and (max-height: 740px)');

    for (const [componentFile, source] of Object.entries(sourceByComponent)) {
      expect(source, componentFile).toContain('mono-scorer-screen');
      expect(source, componentFile).toContain('mono-scorer-score-value');
      // The cricket Test scorer moves match/ending actions into a top-bar
      // hamburger menu (no bottom control strip) so the keypad stays in the
      // thumb zone; every other scorer keeps the bottom control strip.
      if (componentFile === 'MonoCricketTestLiveScore.jsx') {
        expect(source, componentFile).toContain('aria-label="Match options"');
      } else {
        expect(source, componentFile).toContain('mono-scorer-control-strip');
      }
    }

    expect(sourceByComponent['MonoCricketLiveScore.jsx']).toContain('mono-scorer-run-grid');
    expect(sourceByComponent['MonoCricketLiveScore.jsx']).toContain('mono-scorer-run-button');
    expect(sourceByComponent['MonoCricketTestLiveScore.jsx']).toContain('mono-cricket-keypad');
    expect(sourceByComponent['MonoCricketTestLiveScore.jsx']).toContain('mono-cricket-key');
    expect(sourceByComponent['MonoCricketTestLiveScore.jsx']).not.toContain('className="max-w-2xl mx-auto text-center"');
    expect(sourceByComponent['MonoCricketTestLiveScore.jsx']).not.toMatch(/if \(followOnPrompt\)[\s\S]*className="min-h-screen px-6 py-10"/);
    expect(sourceByComponent['MonoCricketTestLiveScore.jsx']).not.toMatch(/if \(matchComplete && matchResult\)[\s\S]*className="min-h-screen px-6 py-10"/);
    expect(quickMatchSource).not.toMatch(/mono-scorer-run-button[\s\S]{0,240}width: '56px'/);
    expect(quickMatchSource).not.toContain("background: '#fffbeb'");
    expect(sourceByComponent['MonoCricketLiveScore.jsx']).not.toContain("background: '#fffbeb'");
    expect(sourceByComponent['MonoCricketTestLiveScore.jsx']).not.toContain("background: '#fffbeb'");
    // The quick-match and Test cricket scorers use the line-divided keypad
    // (mono-cricket-*); the tournament limited-overs scorer still uses the
    // run-button grid.
    expect(quickMatchSource).toContain('mono-cricket-keypad');
    expect(quickMatchSource).toContain('mono-cricket-key-six');
    expect(sourceByComponent['MonoCricketLiveScore.jsx']).toContain('mono-scorer-run-button-accent');
    expect(sourceByComponent['MonoCricketTestLiveScore.jsx']).toContain('mono-cricket-key-six');
    expect(quickMatchSource).toContain('mono-cricket-out-line');
    expect(sourceByComponent['MonoCricketTestLiveScore.jsx']).toContain('mono-cricket-out-line');
    expect(quickMatchSource).not.toContain('autoFocus');
    expect(sourceByComponent['MonoCricketLiveScore.jsx']).toContain('mono-btn-danger w-full mb-4');
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
    // Score halves are native <button>s now (arena structure); the locked/redirect
    // state disables them via canScoreCurrentSet (which includes isInteractionLocked),
    // which also removes them from the tab order — no manual tabIndex needed.
    expect(source).toContain('disabled={!canScoreCurrentSet}');
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

  it('guards the timed-goal auto-finish timeout (autosave replaced manual draft redirects)', () => {
    const goalsComponentFile = 'MonoGoalsLiveScore.jsx';
    const source = readFileSync(new URL(goalsComponentFile, import.meta.url), 'utf8');

    // Draft persistence is now a continuous autosave effect — there is no manual
    // saveDraft / timer.pause redirect. The timed auto-finish is still guarded
    // against firing while interaction is locked, and its timeout is always cleared,
    // so navigating away (which unmounts the scorer and stops the timer) is safe.
    expect(source).toContain('const autoFinishTimeoutRef = useRef(null);');
    expect(source).toContain('if (!tournament || !sportConfig || scoringPrompt.isInteractionLocked) return undefined;');
    expect(source).toContain('clearTimeout(autoFinishTimeoutRef.current);');
  });

  it('keeps live scoring files free of browser-owned alerts and confirms', () => {
    for (const componentFile of scoringComponents) {
      const source = readFileSync(new URL(componentFile, import.meta.url), 'utf8');

      expect(source).not.toMatch(/\b(?:alert|confirm)\s*\(/);
    }
  });
});
