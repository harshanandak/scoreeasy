import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CloudAuthProvider from './CloudAuthProvider';

const mocks = vi.hoisted(() => ({
  storeUser: vi.fn(),
  convexUser: null,
}));

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({
    isLoaded: true,
    user: {
      id: 'user_123',
      imageUrl: '',
      fullName: 'Test User',
      primaryEmailAddress: {
        emailAddress: 'test@example.com',
      },
    },
  }),
}));

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
  }),
  useMutation: () => mocks.storeUser,
  useQuery: () => mocks.convexUser,
}));

vi.mock('../../convex/_generated/api', () => ({
  api: {
    users: {
      getCurrent: 'users:getCurrent',
      store: 'users:store',
    },
  },
}));

describe('CloudAuthProvider', () => {
  let warnSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    mocks.convexUser = null;
    mocks.storeUser.mockReset();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.useRealTimers();
  });

  it('keeps the storeUser retry timer alive across bootstrap rerenders', async () => {
    mocks.storeUser.mockRejectedValue(new Error('temporary failure'));

    render(
      <CloudAuthProvider>
        <div>child</div>
      </CloudAuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.storeUser).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mocks.storeUser).toHaveBeenCalledTimes(2);
  });
});
