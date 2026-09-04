import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { MemoryForm } from '@/components/memory-form';
import { useCreateMemory } from '@/hooks/use-memories';
import { parseCoordinate } from '@/lib/map';

export default function NewMemoryScreen() {
  const mutation = useCreateMemory();
  // 지도를 길게 누르면 그 좌표를 달고 이 화면이 열린다. 그 외 경로에서는 비어 있다.
  const { latitude, longitude } = useLocalSearchParams();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerClassName="gap-4 px-6 py-6"
      >
        <Text className="text-2xl font-bold">추억 남기기</Text>

        <MemoryForm
          submitLabel="저장"
          isPending={mutation.isPending}
          error={mutation.error}
          initialCoordinate={parseCoordinate(latitude, longitude)}
          onSubmit={(input) => mutation.mutate(input, { onSuccess: () => router.back() })}
        />

        <Button title="취소" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}
