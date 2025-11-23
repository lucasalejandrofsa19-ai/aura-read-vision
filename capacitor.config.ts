import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.37b7641e64e44b20a85860b3aca87347',
  appName: 'aura-read-vision',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0d0d0f',
      showSpinner: false,
    },
  },
};

export default config;
