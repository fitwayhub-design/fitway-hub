import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.peetrix.fitwayhub',
  appName: 'FitWayHub',
  webDir: 'dist',
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
    allowMixedContent: false,
  },
  ios: {
    scheme: 'fitwayhub',
    contentInset: 'automatic',
  },
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: [
      'accounts.google.com',
      '*.google.com',
      '*.googleapis.com',
      '*.facebook.com',
      '*.fbcdn.net',
    ],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: '#0A0A0B',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A0A0B',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Geolocation: {
      // Permissions declared in native manifests
    },
  },
};

export default config;
