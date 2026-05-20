import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalAuthProvider } from '../../../auth/AuthContext';
import GuestLanding from './GuestLanding';

function renderLanding({ cloudAuthAvailable = false } = {}) {
  return render(
    <LocalAuthProvider reason="missing-config" cloudAuthAvailable={cloudAuthAvailable}>
      <MemoryRouter>
        <GuestLanding />
      </MemoryRouter>
    </LocalAuthProvider>,
  );
}

describe('GuestLanding bottom CTA', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it('keeps the signup CTA visible on preview/local auth builds', () => {
    renderLanding({ cloudAuthAvailable: false });

    expect(screen.getAllByRole('link', { name: 'START CRICKET' }).at(-1)).toHaveAttribute('href', '/play?sport=cricket');
    expect(screen.getByRole('link', { name: 'SIGN UP FREE' })).toHaveAttribute('href', 'https://scoreeasy.app/signup');
  });

  it('keeps the signup CTA visible with cloud auth enabled', () => {
    renderLanding({ cloudAuthAvailable: true });

    expect(screen.getAllByRole('link', { name: 'START CRICKET' }).at(-1)).toHaveAttribute('href', '/play?sport=cricket');
    expect(screen.getByRole('link', { name: 'SIGN UP FREE' })).toHaveAttribute('href', '/signup');
  });

  it('updates the ready CTA when a different hero sport is selected', () => {
    renderLanding({ cloudAuthAvailable: true });

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'VOLLEYBALL' }));

    expect(screen.getAllByRole('link', { name: 'START VOLLEYBALL' }).at(-1)).toHaveAttribute('href', '/play?sport=volleyball');
    expect(screen.queryByRole('link', { name: 'START A GAME' })).not.toBeInTheDocument();
  });
});
