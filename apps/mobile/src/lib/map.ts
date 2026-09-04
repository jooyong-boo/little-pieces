import type { Memory } from '@/lib/memory-api';

export type Coordinate = { latitude: number; longitude: number };

/** 좌표가 채워진 추억. 타입 가드로 좁혀서 `latitude!` 같은 단언을 쓰지 않는다. */
export type LocatedMemory = Memory & Coordinate;

/** 좌표를 아예 안 찍은 커플에게 보여줄 시작점. */
export const DEFAULT_REGION = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

/**
 * 라우트 파라미터로 넘어온 좌표를 읽는다.
 *
 * `unknown`으로 받는 이유: app.json이 scheme("littlepieces")을 등록하므로
 * `littlepieces://memory/new?latitude=foo` 같은 링크를 앱 밖에서도 열 수 있다.
 * `useLocalSearchParams<{ latitude?: string }>`는 캐스트일 뿐 검증이 아니고,
 * 같은 키를 두 번 주면(`?latitude=1&latitude=2`) 문자열이 아니라 배열이 온다.
 *
 * 위치는 선택 항목이라 이상하면 `null`을 준다 — 폼은 열리고 위치 칸만 빈다.
 */
export function parseCoordinate(latitude: unknown, longitude: unknown): Coordinate | null {
  if (typeof latitude !== 'string' || typeof longitude !== 'string') return null;
  // Number('')와 Number(' ')는 0이다. 빈 값을 그냥 두면 기니만 앞바다(0, 0)에 핀이 박힌다.
  if (latitude.trim() === '' || longitude.trim() === '') return null;

  const parsed = { latitude: Number(latitude), longitude: Number(longitude) };
  if (!Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) return null;
  if (Math.abs(parsed.latitude) > 90 || Math.abs(parsed.longitude) > 180) return null;
  return parsed;
}

function hasCoordinate(memory: Memory): memory is LocatedMemory {
  return memory.latitude !== null && memory.longitude !== null;
}

/**
 * 좌표가 있는 것만 골라 방문일 오름차순으로 준다.
 *
 * 서버는 타임라인용으로 `visited_at DESC`를 내려준다. 경로선은 반대여야
 * "처음 간 곳 → 최근 간 곳"으로 이어진다. 같은 날짜가 여럿이면 기록순으로 잇는다.
 */
export function locatedMemories(memories: Memory[]): LocatedMemory[] {
  return memories
    .filter(hasCoordinate)
    .sort(
      (a, b) => a.visitedAt.localeCompare(b.visitedAt) || a.createdAt.localeCompare(b.createdAt),
    );
}

export function toCoordinates(memories: LocatedMemory[]): Coordinate[] {
  return memories.map(({ latitude, longitude }) => ({ latitude, longitude }));
}

/** 핀 하나뿐이거나 모두 같은 자리일 때 델타가 0이 되면 지도가 무한히 확대된다. */
const MIN_DELTA = 0.02;
/** 핀이 화면 가장자리에 붙지 않게 하는 여백 배수. */
const PADDING_FACTOR = 1.5;

/**
 * 핀들을 모두 담는 화면.
 *
 * `fitToCoordinates`가 있지만 마운트 시점에 지도가 아직 레이아웃되지 않아 무시된다.
 * 데이터가 준비된 뒤에만 지도를 그리므로 `initialRegion`으로 처음부터 맞춰 준다.
 */
export function regionForCoordinates(coordinates: Coordinate[]) {
  if (coordinates.length === 0) return DEFAULT_REGION;

  const latitudes = coordinates.map((c) => c.latitude);
  const longitudes = coordinates.map((c) => c.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max((maxLatitude - minLatitude) * PADDING_FACTOR, MIN_DELTA),
    longitudeDelta: Math.max((maxLongitude - minLongitude) * PADDING_FACTOR, MIN_DELTA),
  };
}
