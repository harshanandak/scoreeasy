import { App } from '@capacitor/app';
import { hasNativePlugin, isNativeMobile } from './platform';

export async function addAppStateChangeListener(listener) {
  if (!isNativeMobile() || !hasNativePlugin('App')) {
    return () => {};
  }

  const handle = await App.addListener('appStateChange', listener);
  return () => {
    handle.remove();
  };
}
