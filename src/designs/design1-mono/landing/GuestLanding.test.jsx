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

function expectReadyStartLink(label, href) {
  expect(screen.getAllByRole('link', { name: label }).at(-1)).toHaveAttribute('href', href);
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

    expectReadyStartLink('START CRICKET', '/play?sport=cricket');
    expect(screen.getByRole('link', { name: 'SIGN UP FREE' })).toHaveAttribute('href', 'https://scoreeasy.app/signup');
  });

  it('keeps the signup CTA visible with cloud auth enabled', () => {
    renderLanding({ cloudAuthAvailable: true });

    expectReadyStartLink('START CRICKET', '/play?sport=cricket');
    expect(screen.getByRole('link', { name: 'SIGN UP FREE' })).toHaveAttribute('href', '/signup');
  });

  it('updates the ready CTA when a different hero sport is selected', () => {
    renderLanding({ cloudAuthAvailable: true });

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'VOLLEYBALL' }));

    expectReadyStartLink('START VOLLEYBALL', '/play?sport=volleyball');
    expect(screen.queryByRole('link', { name: 'START A GAME' })).not.toBeInTheDocument();
  });
});
