const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ||
  process.env.GOOGLE_MAPS_ANDROID_API_KEY;

module.exports = ({ config }) => ({
  expo: {
    ...config,
    web: {
      ...config.web,
      bundler: 'metro',
      output: 'single',
      favicon: './assets/icon.png',
    },
    android: {
      ...config.android,
      versionCode: Math.max(config.android?.versionCode ?? 1, 12),
      config: googleMapsApiKey
        ? {
            ...(config.android?.config ?? {}),
            googleMaps: {
              apiKey: googleMapsApiKey,
            },
          }
        : config.android?.config,
    },
    extra: {
      ...config.extra,
      hasGoogleMapsAndroidKey: Boolean(googleMapsApiKey),
    },
  },
});
