import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatCoordinate, LocationPickerModal } from '@/components/location-picker-modal';
import type { Coordinate } from '@/lib/map';

type LocationFieldProps = {
  coordinate: Coordinate | null;
  onChange: (coordinate: Coordinate | null) => void;
};

/**
 * 지도는 스크린리더에 아무 의미도 주지 않는다. 선택 여부와 좌표를 텍스트로 말한다.
 */
export function LocationField({ coordinate, onChange }: LocationFieldProps) {
  const [isPicking, setIsPicking] = useState(false);

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-gray-600">위치 (선택)</Text>

      {coordinate ? (
        <View className="flex-row items-center gap-2">
          <Text
            className="flex-1 text-gray-800"
            accessibilityLabel={`위치 ${formatCoordinate(coordinate)}`}
          >
            📍 {formatCoordinate(coordinate)}
          </Text>
          <Pressable
            onPress={() => setIsPicking(true)}
            accessibilityRole="button"
            accessibilityLabel="위치 변경"
            className="rounded-lg border border-gray-300 px-3 py-2"
          >
            <Text className="text-sm text-gray-800">변경</Text>
          </Pressable>
          <Pressable
            onPress={() => onChange(null)}
            accessibilityRole="button"
            accessibilityLabel="위치 제거"
            className="rounded-lg border border-gray-300 px-3 py-2"
          >
            <Text className="text-sm text-gray-600">제거</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setIsPicking(true)}
          accessibilityRole="button"
          accessibilityLabel="위치 추가"
          className="items-center rounded-lg border border-dashed border-gray-300 py-3"
        >
          <Text className="text-gray-500">지도에서 위치 고르기</Text>
        </Pressable>
      )}

      <LocationPickerModal
        visible={isPicking}
        initial={coordinate}
        onConfirm={(picked) => {
          onChange(picked);
          setIsPicking(false);
        }}
        onCancel={() => setIsPicking(false)}
      />
    </View>
  );
}
