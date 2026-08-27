// NativeWind 스타일시트. 앱 전역이므로 진입점에서 직접 가져온다.
import '@/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, Text, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Button } from '@/components/button';
import { useCouple } from '@/hooks/use-couple';
import { useLogout } from '@/hooks/use-logout';
import { useAuthStore } from '@/lib/auth-store';
import { queryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();

// 기본값은 앱이 포그라운드일 때 알림을 조용히 넘긴다.
// 파트너가 방금 올린 추억은 앱을 보고 있을 때도 알려주는 게 맞다.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <RootNavigator />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * 라우팅 상태가 셋이다: 미인증 / 인증했지만 커플 없음 / 커플 있음.
 * 커플 소속 여부는 서버에만 있으므로 조회가 끝나기 전에 라우팅하면
 * 온보딩으로 튀었다가 되돌아오는 깜빡임이 생긴다. 그래서 먼저 기다린다.
 */
function RootNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const coupleQuery = useCouple(isHydrated && isAuthenticated);

  if (!isHydrated || (isAuthenticated && coupleQuery.isPending)) {
    return <CenteredSpinner />;
  }

  // 오프라인이면 커플이 있는데도 없는 것처럼 보여 온보딩으로 떨어진다.
  // 그건 사용자를 헷갈리게 하므로 재시도를 내준다.
  if (isAuthenticated && coupleQuery.isError) {
    return <ConnectionError onRetry={() => void coupleQuery.refetch()} />;
  }

  const hasCouple = Boolean(coupleQuery.data);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated && !hasCouple}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated && hasCouple}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

function CenteredSpinner() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator />
    </View>
  );
}

function ConnectionError({ onRetry }: { onRetry: () => void }) {
  const logout = useLogout();

  return (
    <View className="flex-1 justify-center gap-4 bg-white px-6">
      <Text className="text-xl font-bold">연결할 수 없어요</Text>
      <Text className="text-gray-600">
        서버에 닿지 못했습니다. 네트워크를 확인하고 다시 시도해주세요.
      </Text>
      <Button title="다시 시도" onPress={onRetry} />
      <Button title="로그아웃" variant="secondary" onPress={() => void logout()} />
    </View>
  );
}
