import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { hasNativePlugin, isNativeMobile } from './platform';

export async function setupNativeChrome() {
  if (!isNativeMobile()) return { statusBar: 'web', splashScreen: 'web' };

  const result = { statusBar: 'skipped', splashScreen: 'skipped' };

  if (hasNativePlugin('StatusBar')) {
    try {
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#fafafa' });
      result.statusBar = 'configured';
    } catch {
      result.statusBar = 'failed';
    }
  }

  if (hasNativePlugin('SplashScreen')) {
    try {
      await SplashScreen.hide();
      result.splashScreen = 'hidden';
    } catch {
      result.splashScreen = 'failed';
    }
  }

  return result;
}
