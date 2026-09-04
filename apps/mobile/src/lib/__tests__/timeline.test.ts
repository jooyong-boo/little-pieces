import type { Memory } from '../memory-api';
import { formatKoreanDate, fromIsoDate, groupMemoriesByDate, toIsoDate } from '../timeline';

const memory = (id: string, visitedAt: string): Memory => ({
  id,
  authorUserId: null,
  authorNickname: null,
  title: id,
  description: null,
  placeName: null,
  latitude: null,
  longitude: null,
  imageKeys: [],
  imageUrls: [],
  visitedAt,
  createdAt: '2026-08-26T00:00:00Z',
});

test('formats an ISO date without leading zeros', () => {
  expect(formatKoreanDate('2024-05-01')).toBe('2024년 5월 1일');
});

test('returns the input unchanged when it is not a date', () => {
  expect(formatKoreanDate('nope')).toBe('nope');
});

test('groups memories that share a visit date', () => {
  const sections = groupMemoriesByDate([
    memory('a', '2024-05-02'),
    memory('b', '2024-05-01'),
    memory('c', '2024-05-01'),
  ]);

  expect(sections).toEqual([
    { title: '2024-05-02', data: [expect.objectContaining({ id: 'a' })] },
    {
      title: '2024-05-01',
      data: [expect.objectContaining({ id: 'b' }), expect.objectContaining({ id: 'c' })],
    },
  ]);
});

test('preserves server ordering instead of re-sorting', () => {
  const sections = groupMemoriesByDate([memory('a', '2024-05-01'), memory('b', '2024-05-09')]);

  expect(sections.map((section) => section.title)).toEqual(['2024-05-01', '2024-05-09']);
});

test('returns no sections for an empty timeline', () => {
  expect(groupMemoriesByDate([])).toEqual([]);
});

// 날짜 피커는 Date를 주고받는데, 저장 형식은 'YYYY-MM-DD' 문자열이다.
// 그 사이 변환이 하루를 밀면 사용자가 고른 날과 저장된 날이 달라진다.

test('round-trips an ISO date through Date and back', () => {
  expect(toIsoDate(fromIsoDate('2024-05-01')!)).toBe('2024-05-01');
  expect(toIsoDate(fromIsoDate('2024-05-01', true)!, true)).toBe('2024-05-01');
});

test('keeps the local calendar day when the clock is near midnight', () => {
  // toISOString()으로 만들었다면 UTC+n 지역에서 '2024-01-02'가 나온다.
  expect(toIsoDate(new Date(2024, 0, 1, 23, 59))).toBe('2024-01-01');
  // 반대 방향. UTC-n 지역에서 이른 시각이 전날로 밀리는지 본다.
  expect(toIsoDate(new Date(2024, 0, 1, 0, 1))).toBe('2024-01-01');
});

test('anchors to UTC midnight when asked', () => {
  expect(fromIsoDate('2024-05-01', true)!.getTime()).toBe(Date.UTC(2024, 4, 1));
  expect(toIsoDate(new Date(Date.UTC(2024, 4, 1)), true)).toBe('2024-05-01');
});

test('rejects malformed and non-existent dates', () => {
  expect(fromIsoDate('2024-5-1')).toBeNull();
  expect(fromIsoDate('')).toBeNull();
  // new Date(2024, 12, 32)는 던지지 않고 조용히 다음 달로 넘어간다.
  expect(fromIsoDate('2024-13-45')).toBeNull();
  expect(fromIsoDate('2023-02-29')).toBeNull();
});
