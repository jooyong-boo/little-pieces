import * as Location from 'expo-location';

import type { Coordinate } from '@/lib/map';

/**
 * 실패 이유를 구분해서 돌려준다. 권한을 거부한 것과 측위가 안 되는 것은 사용자가 할 수 있는
 * 일이 다르다 — 전자는 설정에서 켜야 하고, 후자는 기다리거나 자리를 옮겨야 한다.
 */
export type LocationResult =
  { ok: true; coordinate: Coordinate } | { ok: false; reason: 'denied' | 'unavailable' };

/**
 * 현재 위치를 한 번 읽는다.
 *
 * react-native-maps의 `showsUserLocation`만으로 iOS가 권한을 물어볼 거라 기대했는데
 * 실기기에서 프롬프트가 뜨지 않았다. 그래서 expo-location으로 직접 요청한다.
 */
export async function getCurrentCoordinate(): Promise<LocationResult> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return { ok: false, reason: 'denied' };

  // 마지막으로 알려진 위치가 있으면 그걸 먼저 쓴다 — 측위는 몇 초씩 걸리는데,
  // 버튼을 누른 직후 화면이 멈춰 있는 것보다 조금 낡은 좌표로 바로 움직이는 편이 낫다.
  const last = await Location.getLastKnownPositionAsync();
  const position = last ?? (await Location.getCurrentPositionAsync());
  if (!position) return { ok: false, reason: 'unavailable' };

  return {
    ok: true,
    coordinate: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    },
  };
}
