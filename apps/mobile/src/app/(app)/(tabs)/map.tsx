import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ErrorText } from '@/components/error-text';
import { useMemories } from '@/hooks/use-memories';
import { locatedMemories, regionForCoordinates, toCoordinates } from '@/lib/map';
import { formatKoreanDate } from '@/lib/timeline';

/** 핀이 화면 가장자리에 붙지 않게. */
const EDGE_PADDING = { top: 80, right: 80, bottom: 80, left: 80 };

export default function MapScreen() {
  const { data, isPending, isError, error, refetch } = useMemories();
  const mapRef = useRef<MapView>(null);

  const located = locatedMemories(data ?? []);
  const coordinates = toCoordinates(located);
  // 배열 아이덴티티는 매 렌더 바뀐다. 좌표가 실제로 달라졌을 때만 다시 맞춘다.
  const fingerprint = coordinates
    .map(({ latitude, longitude }) => `${latitude},${longitude}`)
    .join('|');

  // 첫 화면과 이후 갱신을 다른 수단으로 맞춘다. 실기기에서 확인한 사실:
  //   - 마운트 직후의 fitToCoordinates는 지도가 아직 네이티브 레이아웃 전이라 무시된다
  //     → 그래서 첫 화면은 initialRegion으로 계산해 넣는다(타이밍에 의존하지 않는다).
  //   - 이미 떠 있는 지도에 대해서는 fitToCoordinates가 정상 동작한다
  //     → 탭은 한 번 마운트되면 계속 살아 있으므로, 추억이 늘면 이걸로 다시 맞춘다.
  useEffect(() => {
    if (coordinates.length === 0) return;
    mapRef.current?.fitToCoordinates(coordinates, { edgePadding: EDGE_PADDING, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 좌표 배열은 매 렌더 새로 만들어진다. 내용으로 비교한다.
  }, [fingerprint]);

  if (isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 justify-center gap-3 bg-white px-6">
        <ErrorText error={error} />
        <Button title="다시 시도" variant="secondary" onPress={() => void refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={regionForCoordinates(coordinates)}
      >
        {/* 방문일 오름차순이라 처음 간 곳에서 최근 간 곳으로 이어진다. */}
        {coordinates.length > 1 ? (
          <Polyline coordinates={coordinates} strokeColor="#2563eb" strokeWidth={3} />
        ) : null}

        {located.map((memory) => (
          <Marker
            key={memory.id}
            coordinate={{ latitude: memory.latitude, longitude: memory.longitude }}
            title={memory.title}
            description={memory.placeName ?? formatKoreanDate(memory.visitedAt)}
            onCalloutPress={() =>
              router.push({ pathname: '/memory/[id]', params: { id: memory.id } })
            }
          />
        ))}
      </MapView>

      {located.length === 0 ? <EmptyMap /> : null}
    </View>
  );
}

function EmptyMap() {
  return (
    <SafeAreaView className="absolute inset-x-0 top-0 items-center px-6" edges={['top']}>
      <View className="mt-4 items-center gap-1 rounded-xl bg-white/95 px-6 py-4">
        <Text className="text-gray-600">아직 지도에 찍힌 추억이 없어요.</Text>
        <Text className="text-gray-400">추억을 쓸 때 위치를 골라보세요.</Text>
      </View>
    </SafeAreaView>
  );
}
