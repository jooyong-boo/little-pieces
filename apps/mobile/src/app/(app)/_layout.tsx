import { Stack } from 'expo-router';

import { usePushRegistration } from '@/hooks/use-push-registration';

export default function AppLayout() {
  // 이 레이아웃은 커플이 연결된 뒤에만 마운트된다 — 권한을 물을 맥락이 여기서 생긴다.
  usePushRegistration();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="memory/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="memory/[id]" />
    </Stack>
  );
}
