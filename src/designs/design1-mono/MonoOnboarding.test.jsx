import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MonoOnboarding from './MonoOnboarding';
import { getConsent } from '../../lib/live/liveSession';

// --- Controllable mocks ---------------------------------------------------

const authState = vi.hoisted(() => ({
  current: {
    isAuthenticated: true,
    isLoading: false,
    clerkUser: null,
  },
}));

// useQuery controls the username-availability result. `undefined` = pending.
const queryState = vi.hoisted(() => ({ available: true }));
const submitState = vi.hoisted(() => ({ impl: vi.fn(async () => {}) }));

vi.mock('convex/react', () => ({
  useMutation: () => (...args) => submitState.impl(...args),
  useQuery: () => queryState.available,
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => authState.current,
}));

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <MonoOnboarding />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  authState.current = { isAuthenticated: true, isLoading: false, clerkUser: null };
  queryState.available = true;
  submitState.impl = vi.fn(async () => {});
});

async function clickContinueAndWaitFor(headingRegex) {
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  return waitFor(() => screen.getByRole('heading', { name: headingRegex }), { timeout: 2000 });
}

describe('MonoOnboarding — step navigation & focus', () => {
  it('moves focus to the new step heading on step change', async () => {
    renderOnboarding();
    const nameHeading = await screen.findByRole('heading', { name: /what's your name/i });
    await waitFor(() => expect(nameHeading).toHaveFocus());

    await clickContinueAndWaitFor(/choose your gamertag/i);
    const gamertagHeading = screen.getByRole('heading', { name: /choose your gamertag/i });
    await waitFor(() => expect(gamertagHeading).toHaveFocus());
  });

  it('skips the name step when Clerk already has a name and prefills it', async () => {
    authState.current = {
      isAuthenticated: true,
      isLoading: false,
      clerkUser: { firstName: 'Ada', lastName: 'Lovelace' },
    };
    renderOnboarding();
    const gamertagHeading = await screen.findByRole('heading', { name: /choose your gamertag/i });
    await waitFor(() => expect(gamertagHeading).toHaveFocus());
    expect(screen.queryByRole('heading', { name: /what's your name/i })).toBeNull();
  });

  it('carries the prefilled OAuth name through to completeOnboarding', async () => {
    authState.current = {
      isAuthenticated: true,
      isLoading: false,
      clerkUser: { firstName: 'Ada', lastName: 'Lovelace' },
    };
    renderOnboarding();
    await screen.findByRole('heading', { name: /choose your gamertag/i });
    fireEvent.change(screen.getByPlaceholderText('username'), {
      target: { value: 'adalovelace' },
    });
    await waitFor(
      () => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled(),
      { timeout: 2000 },
    );
    await clickContinueAndWaitFor(/how do you play/i);
    await clickContinueAndWaitFor(/what do you play/i);
    fireEvent.click(screen.getByRole('button', { name: /let's go/i }));
    await waitFor(() => expect(submitState.impl).toHaveBeenCalled());
    expect(submitState.impl).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Ada', lastName: 'Lovelace', username: 'adalovelace' }),
    );
  });
});

describe('MonoOnboarding — username availability status', () => {
  async function gotoUsernameStep() {
    renderOnboarding();
    await screen.findByRole('heading', { name: /what's your name/i });
    await clickContinueAndWaitFor(/choose your gamertag/i);
  }

  it('conveys availability via a persistent aria-live region with a non-color glyph', async () => {
    await gotoUsernameStep();
    const status = document.getElementById('onboard-username-status');
    expect(status).toBeTruthy();
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');

    fireEvent.change(screen.getByPlaceholderText('username'), {
      target: { value: 'adalovelace' },
    });
    await waitFor(() => expect(status.textContent).toMatch(/available/i), { timeout: 2000 });
    expect(status.textContent).toContain('✓');
  });

  it('shows a timeout message (not an endless spinner) when the check stays pending', async () => {
    queryState.available = undefined; // never resolves
    await gotoUsernameStep();
    const input = screen.getByPlaceholderText('username');
    fireEvent.change(input, { target: { value: 'adalovelace' } });
    const status = document.getElementById('onboard-username-status');
    await waitFor(() => expect(status.textContent).toMatch(/checking/i), { timeout: 2000 });
    // Watchdog fires at 8s — give it real time plus margin.
    await waitFor(() => expect(status.textContent).toMatch(/couldn't check/i), { timeout: 10000 });
    expect(input.getAttribute('aria-invalid')).toBe('true');
  }, 15000);
});

describe('MonoOnboarding — live-sharing consent (do not pre-write declined)', () => {
  async function gotoFinalStep() {
    renderOnboarding();
    await screen.findByRole('heading', { name: /what's your name/i });
    await clickContinueAndWaitFor(/choose your gamertag/i);
    fireEvent.change(screen.getByPlaceholderText('username'), {
      target: { value: 'adalovelace' },
    });
    await waitFor(
      () => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled(),
      { timeout: 2000 },
    );
    await clickContinueAndWaitFor(/how do you play/i);
    await clickContinueAndWaitFor(/what do you play/i);
  }

  it('records NOTHING when the consent checkbox is never touched', async () => {
    await gotoFinalStep();
    fireEvent.click(screen.getByRole('button', { name: /let's go/i }));
    await waitFor(() => expect(submitState.impl).toHaveBeenCalled());
    expect(getConsent()).toBeNull();
  });

  it('records "accepted" when the user checks the box', async () => {
    await gotoFinalStep();
    fireEvent.click(screen.getByLabelText(/share my matches live/i));
    fireEvent.click(screen.getByRole('button', { name: /let's go/i }));
    await waitFor(() => expect(submitState.impl).toHaveBeenCalled());
    expect(getConsent()).toBe('accepted');
  });

  it('records "declined" when the user toggles the box on then off (touched)', async () => {
    await gotoFinalStep();
    const box = screen.getByLabelText(/share my matches live/i);
    fireEvent.click(box); // on
    fireEvent.click(box); // off, but touched
    fireEvent.click(screen.getByRole('button', { name: /let's go/i }));
    await waitFor(() => expect(submitState.impl).toHaveBeenCalled());
    expect(getConsent()).toBe('declined');
  });

  it('"Skip & finish" completes onboarding (submits)', async () => {
    await gotoFinalStep();
    fireEvent.click(screen.getByRole('button', { name: /skip & finish/i }));
    await waitFor(() => expect(submitState.impl).toHaveBeenCalled());
  });
});

describe('MonoOnboarding — touch targets', () => {
  it('Back control meets the 44px minimum height', async () => {
    renderOnboarding();
    await screen.findByRole('heading', { name: /what's your name/i });
    await clickContinueAndWaitFor(/choose your gamertag/i);
    const back = screen.getByRole('button', { name: /back/i });
    expect(back.style.minHeight).toBe('44px');
  });
});
