import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { DEFAULT_REGION, type Coordinate } from '@/lib/map';

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

  const initialRegion: Region = initial ? { ...DEFAULT_REGION, ...initial } : DEFAULT_REGION;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1">
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={initialRegion}
            // 드래그가 끝날 때만 부른다 — 매 프레임이 아니다.
            onRegionChangeComplete={(region) =>
              setCenter({ latitude: region.latitude, longitude: region.longitude })
            }
          />

          {/* 마커를 끌게 하면 손가락에 가린다. 표적을 중앙에 고정하고 지도를 움직인다. */}
          <View pointerEvents="none" style={styles.pinWrapper}>
            <View style={styles.pin} />
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
