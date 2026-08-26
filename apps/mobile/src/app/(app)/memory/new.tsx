import { router } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { MemoryForm } from '@/components/memory-form';
import { useCreateMemory } from '@/hooks/use-memories';

export default function NewMemoryScreen() {
  const mutation = useCreateMemory();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="gap-4 px-6 py-6">
        <Text className="text-2xl font-bold">추억 남기기</Text>

        <MemoryForm
          submitLabel="저장"
          isPending={mutation.isPending}
          error={mutation.error}
          onSubmit={(input) => mutation.mutate(input, { onSuccess: () => router.back() })}
        />

        <Button title="취소" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}
