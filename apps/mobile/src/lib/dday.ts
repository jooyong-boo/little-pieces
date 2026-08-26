const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** 100일, 200일... 한국에서 커플이 세는 단위. */
const MILESTONE_STEP = 100;
const DAYS_PER_YEAR = 365;

/**
 * 'YYYY-MM-DD'를 UTC 자정으로 읽는다.
 * 로컬 타임존으로 파싱하면 서머타임이 있는 지역에서 하루가 밀린다.
 */
function toUtcDate(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

export type Anniversary = {
  /** 사귄 날을 1일째로 세는 한국식 카운트. */
  dayCount: number;
  /** 다음으로 다가오는 100일 단위 또는 주년. */
  nextMilestone: { label: string; daysLeft: number } | null;
};

export function calculateAnniversary(anniversaryDate: string, today: Date): Anniversary | null {
  const start = toUtcDate(anniversaryDate);
  if (!start) return null;

  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const dayCount = daysBetween(start, todayUtc) + 1;

  return { dayCount, nextMilestone: findNextMilestone(dayCount) };
}

function findNextMilestone(dayCount: number) {
  // 아직 시작 전(미래 날짜)이면 셀 이정표가 없다.
  if (dayCount < 1) return null;

  const nextHundred = (Math.floor((dayCount - 1) / MILESTONE_STEP) + 1) * MILESTONE_STEP;
  const nextYear = Math.floor((dayCount - 1) / DAYS_PER_YEAR) + 1;
  const nextYearDay = nextYear * DAYS_PER_YEAR + 1;

  const [target, label] =
    nextYearDay < nextHundred
      ? [nextYearDay, `${nextYear}주년`]
      : [nextHundred, `${nextHundred}일`];

  return { label, daysLeft: target - dayCount };
}
