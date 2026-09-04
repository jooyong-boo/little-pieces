import { useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { useCurrentLocation } from '@/hooks/use-current-location';
import { DEFAULT_REGION, PICKER_DELTA, type Coordinate } from '@/lib/map';

type LocationPickerModalProps = {
  visible: boolean;
  initial: Coordinate | null;
  onConfirm: (coordinate: Coordinate) => void;
  onCancel: () => void;
};

/** 소수점 넷째 자리면 약 11m 해상도. 그 아래는 사람이 읽을 이유가 없다. */
export function formatCoordinate({ latitude, longitude }: Coordinate) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

/**
 * 라우트가 아니라 Modal인 이유: 지도를 폼 안에 인라인으로 두면 ScrollView와
 * 제스처가 싸우는데, Modal은 자체 레이어라 그 충돌이 없다. 라우트로 뺐다면
 * `router.back()`이 값을 돌려주지 못해 전달용 전역 스토어가 필요했을 것이다.
 */
export function LocationPickerModal({
  visible,
  initial,
  onConfirm,
  onCancel,
}: LocationPickerModalProps) {
  const [center, setCenter] = useState<Coordinate>(initial ?? DEFAULT_REGION);
  const mapRef = useRef<MapView>(null);

  // 이미 찍어둔 좌표가 있으면 그 자리를, 없으면 기본 시작점을 — 둘 다 당겨서 연다.
  const initialRegion: Region = { ...DEFAULT_REGION, ...(initial ?? {}), ...PICKER_DELTA };

  // 지도를 옮기면 onRegionChangeComplete가 center를 따라 갱신한다 —
  // 여기서 setCenter를 또 부르지 않는다.
  const [isTracking, setIsTracking] = useState(false);
  const { isLocating, goToCurrentLocation } = useCurrentLocation((coordinate) => {
    // 여기까지 왔으면 권한이 있다. 파란 점은 그다음에 켠다.
    setIsTracking(true);
    mapRef.current?.animateToRegion({ ...coordinate, ...PICKER_DELTA }, 500);
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1">
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={initialRegion}
            showsUserLocation={isTracking}
            // 드래그가 끝날 때만 부른다 — 매 프레임이 아니다.
            onRegionChangeComplete={(region) =>
              setCenter({ latitude: region.latitude, longitude: region.longitude })
            }
          />

          {/* 마커를 끌게 하면 손가락에 가린다. 표적을 중앙에 고정하고 지도를 움직인다. */}
          <View pointerEvents="none" style={styles.pinWrapper}>
            <View style={styles.pin} />
          </View>

          {/* 지도 탭과 같은 버튼을 같은 자리에 둔다. 여기는 탭바가 없어 아래쪽에 여유가 있다. */}
          <View pointerEvents="box-none" className="absolute inset-x-0 bottom-0 items-end p-4">
            <View className="w-28">
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

        <View className="gap-3 px-6 py-4">
          <Text
            className="text-center text-gray-600"
            accessibilityLabel={`선택한 위치 ${formatCoordinate(center)}`}
          >
            {formatCoordinate(center)}
          </Text>
          <Button title="이 위치로" onPress={() => onConfirm(center)} />
          <Button title="취소" variant="secondary" onPress={onCancel} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pinWrapper: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 이모지 핀은 글리프 안에서 뾰족한 끝 위치가 폰트마다 달라, 화면에 보이는
  // 지점과 실제로 저장되는 좌표가 어긋난다. 원은 중심이 곧 지점이라 어긋날 수 없다.
  pin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
});
