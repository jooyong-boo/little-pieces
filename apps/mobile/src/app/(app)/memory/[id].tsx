import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ErrorText } from '@/components/error-text';
import { MemoryForm } from '@/components/memory-form';
import { useDeleteMemory, useMemory, useUpdateMemory } from '@/hooks/use-memories';
import { formatKoreanDate } from '@/lib/timeline';

export default function MemoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useMemory(id);
  const update = useUpdateMemory(id);
  const remove = useDeleteMemory(id);

  const confirmDelete = () =>
    Alert.alert('추억을 지울까요?', '되돌릴 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => remove.mutate(undefined, { onSuccess: () => router.back() }),
      },
    ]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="gap-4 px-6 py-6">
        <Text className="text-2xl font-bold">추억 수정</Text>

        {query.isPending ? <ActivityIndicator /> : null}
        <ErrorText error={query.error} />

        {query.data ? (
          <>
            <Text className="text-sm text-gray-500">
              {query.data.authorNickname ?? '알 수 없음'} · {formatKoreanDate(query.data.createdAt)}{' '}
              기록
            </Text>

            <MemoryForm
              defaults={{
                title: query.data.title,
                description: query.data.description ?? '',
                placeName: query.data.placeName ?? '',
                visitedAt: query.data.visitedAt,
              }}
              submitLabel="저장"
              isPending={update.isPending}
              error={update.error}
              onSubmit={(input) => update.mutate(input, { onSuccess: () => router.back() })}
            />

            <ErrorText error={remove.error} />
            <Button
              title="삭제"
              variant="danger"
              isLoading={remove.isPending}
              onPress={confirmDelete}
            />
          </>
        ) : null}

        <Button title="뒤로" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}
