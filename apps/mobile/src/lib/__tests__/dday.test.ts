import { calculateAnniversary } from '../dday';

const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

test('counts the anniversary date itself as day 1', () => {
  const result = calculateAnniversary('2026-08-26', utc(2026, 8, 26));

  expect(result?.dayCount).toBe(1);
});

test('counts elapsed days inclusively', () => {
  const result = calculateAnniversary('2026-01-01', utc(2026, 1, 11));

  expect(result?.dayCount).toBe(11);
});

test('points at the next hundred-day milestone', () => {
  const result = calculateAnniversary('2026-01-01', utc(2026, 1, 11));

  expect(result?.nextMilestone).toEqual({ label: '100일', daysLeft: 89 });
});

test('prefers the yearly milestone when it comes first', () => {
  // 361일째 — 366일(1주년)이 400일보다 먼저 온다.
  const result = calculateAnniversary('2026-01-01', utc(2026, 12, 27));

  expect(result?.nextMilestone).toEqual({ label: '1주년', daysLeft: 5 });
});

test('survives a daylight-saving boundary', () => {
  // 로컬 타임존으로 파싱했다면 서머타임 지역에서 하루가 밀린다.
  const result = calculateAnniversary('2026-03-08', utc(2026, 3, 9));

  expect(result?.dayCount).toBe(2);
});

test('returns null for a malformed date', () => {
  expect(calculateAnniversary('not-a-date', utc(2026, 8, 26))).toBeNull();
});
