import { useState } from 'react';
import { Alert } from 'react-native';

import { getCurrentCoordinate } from '@/lib/location';
import type { Coordinate } from '@/lib/map';

const MESSAGES = {
  denied: '설정에서 허용하면 현재 위치를 볼 수 있어요.',
  unavailable: '현재 위치를 찾지 못했어요. 잠시 뒤에 다시 눌러주세요.',
} as const;

/**
 * "현재 위치" 버튼의 동작. 지도 탭과 위치 고르기 모달이 같은 버튼을 쓰므로 여기 모은다.
 *
 * 버튼을 눌렀는데 아무 일도 안 일어나는 게 제일 나쁘다. 실패하면 이유를 말한다.
 */
export function useCurrentLocation(onLocated: (coordinate: Coordinate) => void) {
  const [isLocating, setIsLocating] = useState(false);

  const goToCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const result = await getCurrentCoordinate();
      if (result.ok) {
        onLocated(result.coordinate);
        return;
      }
      Alert.alert('위치를 쓸 수 없어요', MESSAGES[result.reason]);
    } finally {
      setIsLocating(false);
    }
  };

  return { isLocating, goToCurrentLocation };
}
