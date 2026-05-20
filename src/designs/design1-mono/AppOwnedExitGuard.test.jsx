import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Design1Mono from './index';

describe('app-owned scoring exit guard', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
      callback(0);
      return 1;
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the app popstate guard without registering browser beforeunload prompts', async () => {
    const addEventListener = vi.spyOn(globalThis, 'addEventListener');
    const removeEventListener = vi.spyOn(globalThis, 'removeEventListener');

    const { unmount } = render(
      <MemoryRouter initialEntries={['/volleyball/quick']}>
        <Design1Mono />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(addEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
    });

    expect(addEventListener).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));

    unmount();

    expect(removeEventListener).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });
});
