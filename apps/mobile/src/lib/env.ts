import { Platform } from 'react-native';
import { z } from 'zod';

// The Android emulator can't resolve `localhost` to the host machine — it maps
// 10.0.2.2 to the host's loopback interface instead. iOS Simulator has no such
// issue. This only matters for the unset-env-var dev default.
const DEFAULT_API_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

const envSchema = z.object({
  EXPO_PUBLIC_API_URL: z.string().url().default(DEFAULT_API_URL),
});

export const env = envSchema.parse({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
});
