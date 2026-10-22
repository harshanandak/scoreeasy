import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BoardBar, BoardHeader, BoardOptionsSheet, BoardSheetGroup } from './BoardShell';

// The scorer chrome every sport's board reuses (Kit F0). Sport-specific boards are tested on
// their own (TeamSetsBoard.test.jsx); this pins what the shell promises any of them.

const shellCss = readFileSync(`${import.meta.dirname}/boardShell.css`, 'utf8');

describe('BoardHeader', () => {
  it('shows the title, Live only while shared, and a Mono-strength Finish', () => {
    const onFinish = vi.fn();
    const { rerender } = render(<BoardHeader title="Sharks v Jets" subtitle="Volleyball" onFinish={onFinish} />);
    expect(screen.getByText('Sharks v Jets')).toBeInTheDocument();
    expect(screen.queryByText('Live')).toBeNull();
    const finish = screen.getByRole('button', { name: 'Finish' });
    expect(finish).toHaveClass('se-ctl');
    fireEvent.click(finish);
    expect(onFinish).toHaveBeenCalledTimes(1);

    rerender(<BoardHeader title="Sharks v Jets" subtitle="Volleyball" isLive onFinish={onFinish} />);
    expect(screen.getByText('Live')).toHaveClass('sb-live');
  });

  it('draws the sport dot only when the board passes a sport colour', () => {
    const { container, rerender } = render(<BoardHeader title="A v B" subtitle="Cricket" onFinish={() => {}} />);
    expect(container.querySelector('.sb-sport-dot')).toBeNull();
    rerender(<BoardHeader title="A v B" subtitle="Cricket" sportColour="var(--sport-core)" onFinish={() => {}} />);
    expect(container.querySelector('.sb-sport-dot')).toHaveStyle({ '--sb-sport': 'var(--sport-core)' });
  });
});

describe('BoardBar', () => {
  it('always shows Undo; disabled says there is nothing to undo', () => {
    const props = { undoHint: 'back to 3–2', onUndo: vi.fn(), sheetId: 's', sheetOpen: false, onMore: vi.fn() };
    const { rerender } = render(<BoardBar canUndo {...props} />);
    const undo = screen.getByRole('button', { name: 'Undo last action' });
    expect(undo).toHaveClass('se-ctl');
    expect(undo).toHaveTextContent('back to 3–2');
    rerender(<BoardBar canUndo={false} {...props} />);
    expect(undo).toBeDisabled();
    expect(undo).toHaveTextContent('Nothing to undo');
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    expect(props.onMore).toHaveBeenCalledTimes(1);
  });
});

describe('BoardOptionsSheet', () => {
  it('renders the board content, then Discard last in its own group, and closes before discarding', () => {
    const onClose = vi.fn();
    const onDiscard = vi.fn();
    render(
      <BoardOptionsSheet id="opts" open onClose={onClose} onDiscard={onDiscard}>
        <BoardSheetGroup><button type="button" className="sb-row">Swap sides</button></BoardSheetGroup>
      </BoardOptionsSheet>,
    );
    const rows = screen.getAllByRole('button').filter((b) => b.classList.contains('sb-row'));
    expect(rows.map((b) => b.textContent)).toEqual(['Swap sides', 'Discard match']);
    expect(rows[1]).toHaveClass('sb-row-danger');
    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
    fireEvent.click(rows[1]);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});

describe('boardShell.css', () => {
  it('keeps every shell row thumb-sized and adds no raw colour', () => {
    const code = shellCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/i);
    for (const [, px] of code.matchAll(/min-height:\s*(\d+)px/g)) expect(Number(px)).toBeGreaterThanOrEqual(48);
  });

  it('never shrinks a .se-ctl below its 48px minimum', () => {
    expect(shellCss).not.toMatch(/\.sb-(finish|sheet-close)\s*\{[^}]*min-height/);
  });
});
