import { Link } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { useLogout } from '@/hooks/use-logout';

export default function OnboardingScreen() {
  const logout = useLogout();

  return (
    <View className="flex-1 justify-center gap-6 bg-white px-6">
      <View className="gap-2">
        <Text className="text-2xl font-bold">둘만의 공간 만들기</Text>
        <Text className="text-gray-600">
          한 명이 공간을 만들고, 초대 코드를 상대에게 알려주면 연결됩니다.
        </Text>
      </View>

      <View className="gap-3">
        <Link href="/(onboarding)/create" asChild>
          <Button title="새로 만들기" />
        </Link>
        <Link href="/(onboarding)/join" asChild>
          <Button title="초대 코드로 참여하기" variant="secondary" />
        </Link>
      </View>

      <Button title="로그아웃" variant="secondary" onPress={() => void logout()} />
    </View>
  );
}
