import type { Memory } from '../memory-api';
import {
  DEFAULT_REGION,
  locatedMemories,
  parseCoordinate,
  regionForCoordinates,
  toCoordinates,
} from '../map';

const memory = (
  id: string,
  visitedAt: string,
  coordinate?: { latitude: number; longitude: number },
  createdAt = '2026-08-26T00:00:00Z',
): Memory => ({
  id,
  authorUserId: null,
  authorNickname: null,
  title: id,
  description: null,
  placeName: null,
  latitude: coordinate?.latitude ?? null,
  longitude: coordinate?.longitude ?? null,
  imageKeys: [],
  imageUrls: [],
  visitedAt,
  createdAt,
});

const seoul = { latitude: 37.5665, longitude: 126.978 };
const busan = { latitude: 35.1796, longitude: 129.0756 };

test('drops memories without coordinates', () => {
  const result = locatedMemories([
    memory('with', '2024-05-01', seoul),
    memory('without', '2024-05-02'),
  ]);

  expect(result.map((m) => m.id)).toEqual(['with']);
});

test('flips the server ordering so the path runs oldest to newest', () => {
  // 서버는 타임라인용으로 visited_at DESC를 준다. 그대로 이으면 경로가 거꾸로 그려진다.
  const result = locatedMemories([
    memory('recent', '2024-09-01', busan),
    memory('first', '2024-05-01', seoul),
  ]);

  expect(result.map((m) => m.id)).toEqual(['first', 'recent']);
});

test('breaks same-day ties by record order so the line is deterministic', () => {
  const result = locatedMemories([
    memory('second', '2024-05-01', busan, '2026-08-26T10:00:00Z'),
    memory('first', '2024-05-01', seoul, '2026-08-26T09:00:00Z'),
  ]);

  expect(result.map((m) => m.id)).toEqual(['first', 'second']);
});

test('survives an empty list and a single pin', () => {
  expect(locatedMemories([])).toEqual([]);
  expect(locatedMemories([memory('only', '2024-05-01', seoul)])).toHaveLength(1);
});

test('treats a memory with only one half of a coordinate as unlocated', () => {
  // 서버가 짝을 강제하므로 정상 경로로는 안 생기지만, 반쪽짜리를 지도에 찍으면 안 된다.
  const half = { ...memory('half', '2024-05-01'), latitude: 37.5 };

  expect(locatedMemories([half])).toEqual([]);
});

test('extracts plain coordinates for the polyline', () => {
  const result = toCoordinates(locatedMemories([memory('a', '2024-05-01', seoul)]));

  expect(result).toEqual([seoul]);
});

test('falls back to the default region when there is nothing to show', () => {
  expect(regionForCoordinates([])).toEqual(DEFAULT_REGION);
});

test('centres between the outermost pins', () => {
  const region = regionForCoordinates([
    { latitude: 37.0, longitude: 126.0 },
    { latitude: 38.0, longitude: 128.0 },
  ]);

  expect(region.latitude).toBeCloseTo(37.5);
  expect(region.longitude).toBeCloseTo(127.0);
});

test('leaves margin so pins do not sit on the edge', () => {
  const region = regionForCoordinates([
    { latitude: 37.0, longitude: 126.0 },
    { latitude: 38.0, longitude: 128.0 },
  ]);

  expect(region.latitudeDelta).toBeGreaterThan(1);
  expect(region.longitudeDelta).toBeGreaterThan(2);
});

test('keeps a usable zoom for a single pin', () => {
  // 델타가 0이면 지도가 무한히 확대된다.
  const region = regionForCoordinates([{ latitude: 37.5, longitude: 127.0 }]);

  expect(region.latitudeDelta).toBeGreaterThan(0);
  expect(region.longitudeDelta).toBeGreaterThan(0);
});

// 라우트 파라미터는 문자열이고, scheme으로 앱 밖에서도 열 수 있어 무엇이든 올 수 있다.

test('reads a coordinate from route params', () => {
  expect(parseCoordinate('37.5665', '126.978')).toEqual({
    latitude: 37.5665,
    longitude: 126.978,
  });
  expect(parseCoordinate('-33.8688', '-151.2093')).toEqual({
    latitude: -33.8688,
    longitude: -151.2093,
  });
});

test('rejects params that are missing or not strings', () => {
  expect(parseCoordinate(undefined, undefined)).toBeNull();
  expect(parseCoordinate('37.5665', undefined)).toBeNull();
  // ?latitude=1&latitude=2 는 배열로 온다.
  expect(parseCoordinate(['1', '2'], '126.978')).toBeNull();
});

test('rejects blank params', () => {
  // Number('')는 0이라 typeof 가드만으로는 (0, 0)이 통과해버린다.
  expect(parseCoordinate('', '')).toBeNull();
  expect(parseCoordinate(' ', '126.978')).toBeNull();
});

test('rejects params that are not numbers', () => {
  expect(parseCoordinate('abc', '126.978')).toBeNull();
  expect(parseCoordinate('37.5665', 'NaN')).toBeNull();
});

test('rejects coordinates outside the globe', () => {
  expect(parseCoordinate('91', '126.978')).toBeNull();
  expect(parseCoordinate('37.5665', '181')).toBeNull();
});
