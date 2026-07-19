import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MonoSheet from './MonoSheet';

afterEach(() => {
  // Guard against a leaked scroll-lock bleeding between tests.
  document.body.style.overflow = '';
});

function renderSheet(props = {}) {
  return render(
    <MonoSheet open onClose={vi.fn()} title="Match options" {...props}>
      <button type="button">Share match</button>
    </MonoSheet>,
  );
}

describe('MonoSheet bottom-sheet primitive', () => {
  it('renders nothing while closed', () => {
    render(
      <MonoSheet open={false} onClose={vi.fn()} title="Match options">
        <button type="button">Share match</button>
      </MonoSheet>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('portals a labelled modal dialog to the document body', () => {
    renderSheet();

    const dialog = screen.getByRole('dialog', { name: 'Match options' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveClass('mono-sheet');
    // Portalled: the sheet mounts on document.body, not inside the React root.
    expect(dialog.closest('#root')).toBeNull();
    expect(document.body.contains(dialog)).toBe(true);
    expect(screen.getByText('Share match')).toBeInTheDocument();
  });

  it('falls back to an aria-label when no title is provided', () => {
    render(
      <MonoSheet open onClose={vi.fn()} ariaLabel="More actions">
        <button type="button">Share match</button>
      </MonoSheet>,
    );

    expect(screen.getByRole('dialog', { name: 'More actions' })).toBeInTheDocument();
  });

  it('renders an optional primary/secondary action row and fires their handlers', () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    renderSheet({
      primaryAction: { label: 'Confirm', onClick: onPrimary },
      secondaryAction: { label: 'Skip', onClick: onSecondary },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onSecondary).toHaveBeenCalledTimes(1);
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it('dismisses on Escape and on backdrop tap', () => {
    const onClose = vi.fn();
    renderSheet({ onClose });

    fireEvent.keyDown(globalThis, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Close sheet'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('moves focus into the sheet on open and returns it to the trigger on close', () => {
    function Harness({ open }) {
      return (
        <>
          <button type="button" data-testid="trigger">Open</button>
          <MonoSheet open={open} onClose={vi.fn()} title="Match options">
            <button type="button">Share match</button>
          </MonoSheet>
        </>
      );
    }

    const { rerender } = render(<Harness open={false} />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    rerender(<Harness open />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Share match' }));

    rerender(<Harness open={false} />);
    expect(document.activeElement).toBe(trigger);
  });

  it('traps Tab focus within the sheet', () => {
    renderSheet({
      primaryAction: { label: 'Confirm', onClick: vi.fn() },
    });

    const shareButton = screen.getByRole('button', { name: 'Share match' });
    const confirmButton = screen.getByRole('button', { name: 'Confirm' });

    confirmButton.focus();
    fireEvent.keyDown(confirmButton, { key: 'Tab' });
    expect(document.activeElement).toBe(shareButton);

    fireEvent.keyDown(shareButton, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirmButton);
  });

  it('locks body scroll while open and restores it on close', () => {
    const { rerender } = render(
      <MonoSheet open={false} onClose={vi.fn()} title="Match options">
        <button type="button">Share match</button>
      </MonoSheet>,
    );
    expect(document.body.style.overflow).toBe('');

    rerender(
      <MonoSheet open onClose={vi.fn()} title="Match options">
        <button type="button">Share match</button>
      </MonoSheet>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <MonoSheet open={false} onClose={vi.fn()} title="Match options">
        <button type="button">Share match</button>
      </MonoSheet>,
    );
    expect(document.body.style.overflow).toBe('');
  });

  it('only lets the topmost sheet handle Escape', () => {
    const lowerClose = vi.fn();
    const topClose = vi.fn();

    render(
      <>
        <MonoSheet open onClose={lowerClose} title="Lower sheet">
          <button type="button">Lower</button>
        </MonoSheet>
        <MonoSheet open onClose={topClose} title="Top sheet">
          <button type="button">Top</button>
        </MonoSheet>
      </>,
    );

    fireEvent.keyDown(globalThis, { key: 'Escape' });

    expect(topClose).toHaveBeenCalledTimes(1);
    expect(lowerClose).not.toHaveBeenCalled();
  });

  it('blocks global scorer hotkeys from leaking behind the open sheet, keeps Escape/Tab working, then stops blocking once closed', () => {
    // Simulate a scorer's document-level hotkey listener (q/p/u/w/e + numbers
    // mutate the match) sitting behind the sheet.
    const hotkeyListener = vi.fn();
    globalThis.addEventListener('keydown', hotkeyListener);

    const onClose = vi.fn();
    const { rerender } = render(
      <MonoSheet
        open
        onClose={onClose}
        title="Match options"
        primaryAction={{ label: 'Confirm', onClick: vi.fn() }}
      >
        <button type="button">Share match</button>
      </MonoSheet>,
    );

    const shareButton = screen.getByRole('button', { name: 'Share match' });
    const confirmButton = screen.getByRole('button', { name: 'Confirm' });

    // Scorer hotkeys pressed while a control inside the sheet is focused must
    // NOT reach the document listener behind the modal.
    fireEvent.keyDown(shareButton, { key: 'q' });
    fireEvent.keyDown(shareButton, { key: '1' });
    fireEvent.keyDown(confirmButton, { key: 'w' });
    fireEvent.keyDown(confirmButton, { key: 'p' });
    expect(hotkeyListener).not.toHaveBeenCalled();

    // Tab still cycles focus inside the sheet.
    confirmButton.focus();
    fireEvent.keyDown(confirmButton, { key: 'Tab' });
    expect(document.activeElement).toBe(shareButton);

    // Escape still dismisses without leaking to the scorer.
    fireEvent.keyDown(shareButton, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(hotkeyListener).not.toHaveBeenCalled();

    // Once closed, the document listener receives keys normally again.
    rerender(
      <MonoSheet open={false} onClose={onClose} title="Match options">
        <button type="button">Share match</button>
      </MonoSheet>,
    );

    fireEvent.keyDown(globalThis, { key: 'q' });
    expect(hotkeyListener).toHaveBeenCalledTimes(1);

    globalThis.removeEventListener('keydown', hotkeyListener);
  });

  it('keeps the shared sheet shell brutalist-framed, soft-topped and mobile-safe', () => {
    const monoCss = readFileSync(`${import.meta.dirname}/../mono.css`, 'utf8');
    const confirmUtils = readFileSync(`${import.meta.dirname}/appConfirmUtils.js`, 'utf8');

    // Backdrop shares the established z-260 stacking baseline.
    expect(monoCss).toMatch(/\.mono-sheet-backdrop\s*\{[\s\S]*z-index:\s*260/);
    // Brutalist frame: hard hairline border + hard offset shadow.
    expect(monoCss).toMatch(/\.mono-sheet\s*\{[\s\S]*var\(--se-color-line-strong\)/);
    expect(monoCss).toMatch(/\.mono-sheet\s*\{[\s\S]*var\(--se-shadow-hard\)/);
    // HiFi soft top radii + safe-area padding + drag handle affordance.
    expect(monoCss).toContain('var(--se-blend-radius-soft-lg)');
    expect(monoCss).toContain('env(safe-area-inset-bottom, 0px)');
    expect(monoCss).toContain('.mono-sheet-handle');
    // Reduced-motion neutralizes the slide-up animation.
    expect(monoCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.mono-sheet\s*\{[\s\S]*animation:\s*none/);
    // Focus-trap selector generalized so sheets qualify alongside confirm dialogs.
    expect(confirmUtils).toContain('.mono-sheet');
    expect(confirmUtils).toContain('handleModalTabTrap');
  });
});
