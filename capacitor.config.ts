import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.37b7641e64e44b20a85860b3aca87347',
  appName: 'aura-read-vision',
  webDir: 'dist',
  server: {
    url: 'https://37b7641e-64e4-4b20-a858-60b3aca87347.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0d0d0f',
      showSpinner: false,
    },
  },
};

export default config;
