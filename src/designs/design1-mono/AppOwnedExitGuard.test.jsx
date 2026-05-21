import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Design1Mono from './index';

const nativeBackButtonMock = vi.hoisted(() => ({
  installNativeBackButtonGuard: vi.fn(() => vi.fn()),
}));

vi.mock('../../mobile/backButton', () => ({
  installNativeBackButtonGuard: nativeBackButtonMock.installNativeBackButtonGuard,
}));

describe('app-owned scoring exit guard', () => {
  beforeEach(() => {
    nativeBackButtonMock.installNativeBackButtonGuard.mockClear();
    nativeBackButtonMock.installNativeBackButtonGuard.mockReturnValue(vi.fn());
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

  it('lets confirmed native back navigation pass the protected popstate guard once', async () => {
    const historyBack = vi.spyOn(globalThis.history, 'back').mockImplementation(() => {});
    const pushState = vi.spyOn(globalThis.history, 'pushState');

    const { unmount } = render(
      <MemoryRouter initialEntries={['/volleyball/quick']}>
        <Design1Mono />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(nativeBackButtonMock.installNativeBackButtonGuard).toHaveBeenCalledWith(expect.objectContaining({
        goBack: expect.any(Function),
      }));
    });

    const options = nativeBackButtonMock.installNativeBackButtonGuard.mock.calls[0][0];
    pushState.mockClear();

    options.goBack();
    globalThis.dispatchEvent(new Event('popstate'));

    expect(historyBack).toHaveBeenCalledTimes(1);
    expect(pushState).not.toHaveBeenCalled();

    unmount();
  });
});
