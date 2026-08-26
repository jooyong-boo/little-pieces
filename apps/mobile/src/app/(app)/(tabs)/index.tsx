import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, SectionList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ErrorText } from '@/components/error-text';
import { useCouple } from '@/hooks/use-couple';
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

      <WaitingForPartner />

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

/** 커플 생성 직후엔 상대가 아직 없다. 초대 코드를 찾아 설정 탭까지 가지 않아도 되게 여기 띄운다. */
function WaitingForPartner() {
  const { data: couple } = useCouple();
  if (!couple || couple.members.length >= 2) return null;

  return (
    <View className="mx-6 mb-2 gap-1 rounded-xl bg-blue-50 p-4">
      <Text className="text-sm text-blue-700">상대를 기다리는 중이에요</Text>
      <Text className="text-2xl font-bold tracking-widest text-blue-700">{couple.inviteCode}</Text>
      <Text className="text-sm text-blue-600">이 코드를 알려주면 연결됩니다.</Text>
    </View>
  );
}

/**
 * 스크린리더는 Pressable의 자식 텍스트를 이어붙여 한 덩어리로 읽는다.
 * 그대로 두면 "📍"까지 읽히므로 라벨을 직접 준다.
 */
function memoryLabel(memory: Memory) {
  return [
    memory.title,
    memory.placeName,
    // 스크린리더는 썸네일을 읽지 못하므로 사진이 있다는 사실을 말로 남긴다.
    memory.imageKeys.length > 0 && `사진 ${memory.imageKeys.length}장`,
    memory.authorNickname && `${memory.authorNickname} 기록`,
  ]
    .filter(Boolean)
    .join(', ');
}

function MemoryRow({ memory }: { memory: Memory }) {
  return (
    // Link asChild는 자식에 onPress를 넣는다. View는 onPress를 무시하므로 Pressable이어야 한다.
    <Link href={{ pathname: '/memory/[id]', params: { id: memory.id } }} asChild>
      <Pressable
        className="flex-row gap-3 rounded-xl border border-gray-200 p-4"
        accessibilityRole="button"
        accessibilityLabel={memoryLabel(memory)}
      >
        {memory.imageUrls[0] ? (
          <Image
            source={{ uri: memory.imageUrls[0] }}
            style={{ width: 64, height: 64, borderRadius: 8 }}
          />
        ) : null}

        <View className="flex-1">
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
      </Pressable>
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
