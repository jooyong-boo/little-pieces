import { calculateAnniversary } from '../dday';

// calculateAnniversary는 today의 로컬 날짜 성분을 읽는다.
// Date.UTC로 만들면 UTC 음수 타임존에서만 조용히 하루가 밀린다.
const localDate = (year: number, month: number, day: number) => new Date(year, month - 1, day);

test('counts the anniversary date itself as day 1', () => {
  const result = calculateAnniversary('2026-08-26', localDate(2026, 8, 26));

  expect(result?.dayCount).toBe(1);
});

test('counts elapsed days inclusively', () => {
  const result = calculateAnniversary('2026-01-01', localDate(2026, 1, 11));

  expect(result?.dayCount).toBe(11);
});

test('points at the next hundred-day milestone', () => {
  const result = calculateAnniversary('2026-01-01', localDate(2026, 1, 11));

  expect(result?.nextMilestone).toEqual({ label: '100일', daysLeft: 89 });
});

test('prefers the yearly milestone when it comes first', () => {
  // 361일째 — 366일(1주년)이 400일보다 먼저 온다.
  const result = calculateAnniversary('2026-01-01', localDate(2026, 12, 27));

  expect(result?.nextMilestone).toEqual({ label: '1주년', daysLeft: 5 });
});

test('parses the anniversary string in UTC regardless of local offset', () => {
  // 기념일 문자열을 로컬로 파싱했다면 서머타임이 있는 지역에서 하루가 밀린다.
  const result = calculateAnniversary('2026-03-08', localDate(2026, 3, 9));

  expect(result?.dayCount).toBe(2);
});

test('returns null for a malformed date', () => {
  expect(calculateAnniversary('not-a-date', localDate(2026, 8, 26))).toBeNull();
});
