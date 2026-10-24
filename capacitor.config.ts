import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.scoreeasy.app',
  appName: 'Score Easy',
  webDir: 'dist',
  server: {
    hostname: 'scoreeasy.app',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#fafafa',
      showSpinner: false,
    },
    SystemBars: {
      insetsHandling: 'css',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#fafafa',
    },
  },
};

export default config;
