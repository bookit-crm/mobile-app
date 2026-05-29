import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.scheday',
  appName: 'ScheDay',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    hostname: 'scheday-app',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#6366f1',
      sound: 'default',
    },
  },
};

export default config;
