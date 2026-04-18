// app.config.js remplace app.json pour permettre la substitution
// des variables d'environnement EAS (notamment GOOGLE_MAPS_API_KEY)
const { withDangerousMod } = require('@expo/config-plugins')
const path = require('path')
const fs = require('fs')

// Plugin : copie adi-registration.properties dans les assets Android natifs
// Requis par Google Play Console pour enregistrer le nom de package
const withAdiRegistration = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const assetsDir = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/assets'
      )
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true })
      }
      const src = path.join(__dirname, 'assets/adi-registration.properties')
      const dest = path.join(assetsDir, 'adi-registration.properties')
      fs.copyFileSync(src, dest)
      return config
    },
  ])
}

module.exports = {
  expo: {
    name: 'O Taxi',
    slug: 'obaid-taxi',
    version: '1.0.1',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'cover',
      backgroundColor: '#1D4ED8',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.obaidtaxi.app',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Obaid Taxi utilise votre position pour définir votre point de départ.',
        NSLocationAlwaysUsageDescription:
          'Obaid Taxi utilise votre position pour définir votre point de départ.',
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1D4ED8',
      },
      package: 'com.obaidtaxi.app',
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'RECEIVE_BOOT_COMPLETED',
        'VIBRATE',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.POST_NOTIFICATIONS',
      ],
      config: {
        googleMaps: {
          // Substitution réelle de la variable EAS pendant le build
          apiKey: process.env.GOOGLE_MAPS_API_KEY ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    web: {
      bundler: 'metro',
    },
    plugins: [
      withAdiRegistration,
      'expo-router',
      'expo-location',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#1D4ED8',
        },
      ],
      '@react-native-community/datetimepicker',
      'expo-font',
    ],
    scheme: 'obaid-taxi',
    extra: {
      eas: {
        projectId: 'b1e36c3f-5743-4fc7-b2f0-fd27f5c0ade1',
      },
      router: {},
    },
    owner: 'zebreyn',
  },
}
