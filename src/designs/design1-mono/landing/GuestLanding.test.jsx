import { render, screen } from '@testing-library/react';
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

    expect(screen.getByRole('link', { name: 'START A GAME' })).toHaveAttribute('href', '/play');
    expect(screen.getByRole('link', { name: 'SIGN UP FREE' })).toHaveAttribute('href', 'https://scoreeasy.app/signup');
  });

  it('keeps the signup CTA visible with cloud auth enabled', () => {
    renderLanding({ cloudAuthAvailable: true });

    expect(screen.getByRole('link', { name: 'START A GAME' })).toHaveAttribute('href', '/play');
    expect(screen.getByRole('link', { name: 'SIGN UP FREE' })).toHaveAttribute('href', '/signup');
  });
});
