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

function setViewport(width, mobile = false) {
  globalThis.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: mobile && query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  Object.defineProperty(globalThis, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

describe('GuestLanding bottom CTA', () => {
  beforeEach(() => {
    setViewport(1024);
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

  it('keeps mobile hero controls at touch target size', () => {
    setViewport(390, true);

    renderLanding({ cloudAuthAvailable: true });

    expect(screen.getAllByRole('link', { name: 'START CRICKET' }).at(0)).toHaveStyle({ minHeight: '44px' });
    expect(screen.getAllByRole('link', { name: 'CHOOSE SPORT' }).at(0)).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByRole('button', { name: 'CRICKET' })).toHaveStyle({ minHeight: '44px' });
  });

  it('turns landing sport cards into mobile-friendly start links', () => {
    setViewport(390, true);

    renderLanding({ cloudAuthAvailable: true });

    const cricketCard = screen.getByRole('link', { name: 'Start Cricket from sports' });
    expect(cricketCard).toHaveAttribute('href', '/play?sport=cricket');
    expect(cricketCard).toHaveStyle({ minHeight: '0' });
    expect(cricketCard).toHaveStyle({ textAlign: 'center' });
    expect(screen.getByRole('link', { name: 'Start Football from sports' })).toHaveAttribute('href', '/play?sport=football');
    expect(screen.getByRole('link', { name: 'Start Volleyball from sports' })).toHaveAttribute('href', '/play?sport=volleyball');
    expect(screen.getByRole('link', { name: 'Start Table Tennis from sports' })).toHaveAttribute('href', '/play?sport=tabletennis');
    expect(screen.getByRole('link', { name: 'Start Kabaddi from sports' })).toHaveAttribute('href', '/play?sport=kabaddi');
  });

  it('turns the three-step section into active sport actions', () => {
    renderLanding({ cloudAuthAvailable: true });

    expect(screen.getAllByRole('link', { name: 'CHOOSE SPORT' }).at(-1)).toHaveAttribute('href', '/play');
    expect(screen.getByRole('link', { name: 'SET UP CRICKET' })).toHaveAttribute('href', '/play?sport=cricket');
    expect(screen.getByRole('link', { name: 'START SCORING' })).toHaveAttribute('href', '/play?sport=cricket');

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'VOLLEYBALL' }));

    expect(screen.getByRole('link', { name: 'SET UP VOLLEYBALL' })).toHaveAttribute('href', '/play?sport=volleyball');
    expect(screen.getByRole('link', { name: 'START SCORING' })).toHaveAttribute('href', '/play?sport=volleyball');
  });
});
