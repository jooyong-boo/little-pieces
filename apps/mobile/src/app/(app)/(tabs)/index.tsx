import { Link } from 'expo-router';
import { ActivityIndicator, SectionList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ErrorText } from '@/components/error-text';
import { useMemories } from '@/hooks/use-memories';
import type { Memory } from '@/lib/memory-api';
import { formatKoreanDate, groupMemoriesByDate } from '@/lib/timeline';

export default function TimelineScreen() {
  const { data, isPending, isError, error, refetch, isRefetching } = useMemories();
  const sections = groupMemoriesByDate(data ?? []);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row items-center justify-between px-6 py-4">
        <Text className="text-2xl font-bold">우리의 조각들</Text>
        <Link href="/memory/new" asChild>
          <Text className="text-base font-semibold text-blue-600">+ 추가</Text>
        </Link>
      </View>

      {isPending ? <ActivityIndicator className="mt-8" /> : null}

      {isError ? (
        <View className="gap-3 px-6">
          <ErrorText error={error} />
          <Button title="다시 시도" variant="secondary" onPress={() => void refetch()} />
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(memory) => memory.id}
        contentContainerClassName="gap-2 px-6 pb-12"
        onRefresh={() => void refetch()}
        refreshing={isRefetching}
        renderSectionHeader={({ section }) => (
          <Text className="bg-white pb-1 pt-4 text-sm font-semibold text-gray-500">
            {formatKoreanDate(section.title)}
          </Text>
        )}
        renderItem={({ item }) => <MemoryRow memory={item} />}
        ListEmptyComponent={isPending || isError ? null : <EmptyTimeline />}
      />
    </SafeAreaView>
  );
}

function MemoryRow({ memory }: { memory: Memory }) {
  return (
    <Link href={{ pathname: '/memory/[id]', params: { id: memory.id } }} asChild>
      <View className="rounded-xl border border-gray-200 p-4">
        <Text className="text-base font-semibold">{memory.title}</Text>
        {memory.placeName ? (
          <Text className="mt-1 text-sm text-gray-600">📍 {memory.placeName}</Text>
        ) : null}
        {memory.description ? (
          <Text className="mt-1 text-sm text-gray-600" numberOfLines={2}>
            {memory.description}
          </Text>
        ) : null}
        {memory.authorNickname ? (
          <Text className="mt-2 text-xs text-gray-400">{memory.authorNickname}</Text>
        ) : null}
      </View>
    </Link>
  );
}

function EmptyTimeline() {
  return (
    <View className="mt-16 items-center gap-2">
      <Text className="text-gray-500">아직 기록된 추억이 없어요.</Text>
      <Text className="text-gray-400">위의 + 추가를 눌러 첫 조각을 남겨보세요.</Text>
    </View>
  );
}
