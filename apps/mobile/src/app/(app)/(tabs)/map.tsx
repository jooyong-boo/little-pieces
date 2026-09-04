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
  // 지도에서 추억을 남기면 목록이 무효화되고 좌표 지문이 바뀐다. 그때 아래 effect가
  // 재조정하면 사용자가 방금 고른 자리에서 카메라가 튄다. 그 한 번만 건너뛴다.
  // 영구 플래그로 두면 안 된다 — 탭이 마운트된 채로 유지되므로 사실상 앱 재시작까지
  // 재조정이 죽고, "탭이 살아 있는 동안의 재조정"이라는 아래 의도가 사라진다.
  const skipNextRefit = useRef(false);

  const located = locatedMemories(data ?? []);
  const coordinates = toCoordinates(located);
  // 배열 아이덴티티는 매 렌더 바뀐다. 좌표가 실제로 달라졌을 때만 다시 맞춘다.
  const fingerprint = coordinates
    .map(({ latitude, longitude }) => `${latitude},${longitude}`)
    .join('|');

  // 첫 화면과 이후 갱신을 다른 수단으로 맞춘다. 시뮬레이터에서 관찰한 것:
  //   - 마운트 직후에 부른 fitToCoordinates는 효과가 없었다.
  //   - 같은 API를 나중에(버튼으로) 부르면 정상 동작한다 — API가 깨진 게 아니라 시점 문제다.
  //     정확한 이유는 확인하지 않았다.
  // 그래서 첫 화면은 initialRegion으로 계산해 넣어 시점에 아예 의존하지 않고,
  // 탭이 계속 살아 있는 동안의 재조정만 fitToCoordinates에 맡긴다.
  useEffect(() => {
    if (coordinates.length === 0) return;
    if (skipNextRefit.current) {
      skipNextRefit.current = false;
      return;
    }
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
        // 좌표는 문자열로 넘긴다 — 라우트 파라미터는 어차피 문자열이 되고,
        // 받는 쪽(new.tsx)이 parseCoordinate로 검증한다.
        onLongPress={({ nativeEvent: { coordinate } }) => {
          skipNextRefit.current = true;
          router.push({
            pathname: '/memory/new',
            params: {
              latitude: String(coordinate.latitude),
              longitude: String(coordinate.longitude),
            },
          });
        }}
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
    // 지도 위에 덮이는 레이어다. pointerEvents를 주지 않으면 안내문이 지도 상단의
    // 터치를 통째로 먹는다 — 핀이 하나도 없을 때만 뜨는 화면이라, 하필 사용자가 지도에
    // 처음 무언가를 해보려는 순간에 걸린다.
    <SafeAreaView
      pointerEvents="box-none"
      className="absolute inset-x-0 top-0 items-center px-6"
      edges={['top']}
    >
      {/* 카드 자체도 막아야 한다. box-none은 래퍼만 통과시키고 자식 영역은 그대로 남긴다. */}
      <View
        pointerEvents="none"
        className="mt-4 items-center gap-1 rounded-xl bg-white/95 px-6 py-4"
      >
        <Text className="text-gray-600">아직 지도에 찍힌 추억이 없어요.</Text>
        <Text className="text-gray-400">지도를 길게 누르면 그 자리에 남길 수 있어요.</Text>
      </View>
    </SafeAreaView>
  );
}
