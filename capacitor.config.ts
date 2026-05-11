import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.scoreeasy.app',
  appName: 'Score Easy',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#fafafa',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#fafafa',
    },
  },
};

export default config;
