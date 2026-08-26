import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="memory/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="memory/[id]" />
    </Stack>
  );
}
