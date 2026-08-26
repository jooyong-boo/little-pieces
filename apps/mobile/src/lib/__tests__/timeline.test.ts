import type { Memory } from '../memory-api';
import { formatKoreanDate, groupMemoriesByDate } from '../timeline';

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
