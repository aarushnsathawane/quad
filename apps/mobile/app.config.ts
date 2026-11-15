import type { ExpoConfig, ConfigContext } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => {
  const building = !!process.env.EAS_BUILD;
  if (building) {
    if (process.env.EXPO_PUBLIC_DEMO_MODE === 'true')
      throw new Error('Demo builds cannot be submitted');
    const url = process.env.EXPO_PUBLIC_API_URL;
    if (!url || !/^https:\/\/[^/]+$/.test(url))
      throw new Error('Set the deployed HTTPS EXPO_PUBLIC_API_URL in your EAS environment');
    if (process.env.EAS_BUILD_PLATFORM === 'android' && !process.env.ANDROID_GOOGLE_MAPS_API_KEY)
      throw new Error('Set ANDROID_GOOGLE_MAPS_API_KEY for the native Android map');
  }
  return {
    ...config,
    name: 'Quad',
    slug: 'quad-campus',
    version: '1.0.0',
    ios: {
      ...config.ios,
      bundleIdentifier: 'com.quadcampus.app',
      infoPlist: { ...config.ios?.infoPlist, ITSAppUsesNonExemptEncryption: false },
    },
    android: {
      ...config.android,
      package: 'com.quadcampus.app',
      config: { googleMaps: { apiKey: process.env.ANDROID_GOOGLE_MAPS_API_KEY } },
    },
    plugins: [
      ...(config.plugins || []),
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Allow Quad to show your approximate campus presence when you choose to share. Background tracking is not used.',
          isAndroidBackgroundLocationEnabled: false,
          isAndroidForegroundServiceEnabled: false,
        },
      ],
    ],
  };
};
