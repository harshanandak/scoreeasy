import { Capacitor } from '@capacitor/core';

export const MOBILE_APP_ID = 'com.scoreeasy.app';

export function getMobilePlatform() {
  return Capacitor.getPlatform();
}

export function isNativeMobile() {
  return Capacitor.isNativePlatform();
}

export function hasNativePlugin(pluginName) {
  return Capacitor.isPluginAvailable(pluginName);
}
