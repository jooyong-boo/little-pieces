import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ErrorText } from '@/components/error-text';
import { useMemories } from '@/hooks/use-memories';
import { useCurrentLocation } from '@/hooks/use-current-location';
import {
  locatedMemories,
  regionForCoordinates,
  toCoordinates,
  USER_LOCATION_DELTA,
  type Coordinate,
} from '@/lib/map';
import { formatKoreanDate } from '@/lib/timeline';

/** 핀이 화면 가장자리에 붙지 않게. */
const EDGE_PADDING = { top: 80, right: 80, bottom: 80, left: 80 };

/**
 * 하단 컨트롤을 탭바 위로 올리는 높이. 탭바가 지도 위에 떠서 겹쳐 그려지므로
 * SafeArea만으로는 부족하다 — 실기기에서 버튼이 아예 안 보였다.
 */
const CONTROLS_BOTTOM_OFFSET = 96;

export default function MapScreen() {
  const { data, isPending, isError, error, refetch } = useMemories();
  const mapRef = useRef<MapView>(null);
  // 지도에서 추억을 남기면 목록이 무효화되고 좌표 지문이 바뀐다. 그때 아래 effect가
  // 재조정하면 사용자가 방금 고른 자리에서 카메라가 튄다. 그 한 번만 건너뛴다.
  // 영구 플래그로 두면 안 된다 — 탭이 마운트된 채로 유지되므로 사실상 앱 재시작까지
  // 재조정이 죽고, "탭이 살아 있는 동안의 재조정"이라는 아래 의도가 사라진다.
  const skipNextRefit = useRef(false);
  const [isTracking, setIsTracking] = useState(false);

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

  // 좌표는 문자열로 넘긴다 — 라우트 파라미터는 어차피 문자열이 되고,
  // 받는 쪽(new.tsx)이 parseCoordinate로 검증한다.
  const openFormAt = (coordinate: Coordinate) => {
    skipNextRefit.current = true;
    router.push({
      pathname: '/memory/new',
      params: {
        latitude: String(coordinate.latitude),
        longitude: String(coordinate.longitude),
      },
    });
  };

  const { isLocating, goToCurrentLocation } = useCurrentLocation((coordinate) => {
    skipNextRefit.current = true;
    // 여기까지 왔으면 권한이 있다. 파란 점은 그다음에 켠다 — 마운트부터 켜두면
    // 권한을 왜 묻는지 알 수 없는 시점에 프롬프트가 뜬다.
    setIsTracking(true);
    // Region을 쓴다. Camera의 줌은 zoom(Android)/altitude(iOS)로 플랫폼이 갈리지만
    // Region은 안 갈리고, 이 화면의 단위가 이미 전부 Region이다.
    mapRef.current?.animateToRegion({ ...coordinate, ...USER_LOCATION_DELTA }, 500);
  });

  /**
   * 화면 중앙에 추억을 남긴다.
   *
   * 중앙을 onRegionChangeComplete로 따라다니면, 사용자가 지도를 한 번도 안 움직였을 때
   * 값이 없거나 초기화 중의 (0, 0)이 잡힌다 — 실기기에서 좌표가 0으로 들어갔다.
   * 누르는 순간 카메라에 직접 물어보는 편이 짧고 정확하다.
   */
  const openFormAtCenter = async () => {
    const camera = await mapRef.current?.getCamera();
    openFormAt(camera?.center ?? regionForCoordinates(coordinates));
  };

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
        showsUserLocation={isTracking}
        onLongPress={({ nativeEvent: { coordinate } }) => openFormAt(coordinate)}
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

      {/*
        box-none이 없으면 이 레이어가 지도 하단의 팬 제스처를 통째로 먹는다.
        EmptyMap과 같은 함정이다.
      */}
      <View
        pointerEvents="box-none"
        className="absolute inset-x-0 bottom-0 items-end gap-2 px-4"
        style={{ paddingBottom: CONTROLS_BOTTOM_OFFSET }}
      >
        {/*
          길게 누르기는 보이지도 않고, 실기기에서는 손가락이 조금만 움직여도 지도 팬으로
          넘어가 잘 안 잡힌다. 화면 중앙을 쓰는 버튼을 함께 둬서 제스처를 몰라도,
          스크린리더를 써도 같은 일을 할 수 있게 한다.
        */}
        <View className="w-36">
          <Button
            title="여기에 남기기"
            variant="secondary"
            accessibilityLabel="지도 중앙에 추억 남기기"
            onPress={() => void openFormAtCenter()}
          />
        </View>

        {/*
          Button은 className이 하드코딩이고 {...rest}가 그 뒤에 펼쳐진다 —
          className을 넘기면 variant 스타일이 통째로 덮이므로 폭은 바깥에서 준다.
          아이콘 대신 텍스트인 이유: expo-symbols는 SF Symbol이라 Android에 대응하는
          그림이 없다. 텍스트는 두 플랫폼에서 같고 스크린리더도 읽는다.
        */}
        <View className="w-36">
          <Button
            title="현재 위치"
            variant="secondary"
            isLoading={isLocating}
            accessibilityLabel="현재 위치로 이동"
            onPress={() => void goToCurrentLocation()}
          />
        </View>
      </View>
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
        <Text className="text-gray-400">아래 &quot;여기에 남기기&quot;를 눌러보세요.</Text>
      </View>
    </SafeAreaView>
  );
}
