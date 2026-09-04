import type { Memory } from '@/lib/memory-api';

/** 'YYYY-MM-DD' → '2024년 5월 1일'. Intl 없이 문자열만으로 만든다. */
export function formatKoreanDate(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`;
}

/**
 * 'YYYY-MM-DD' ↔ Date. `utc`는 어느 타임존의 자정을 가리킬지 정한다.
 *
 * 이 인자가 있는 이유는 네이티브 날짜 피커가 Date를 읽는 기준이 플랫폼마다 반대이기 때문이다:
 * Android(Material3 DatePickerState)는 UTC 밀리초로, iOS(SwiftUI DatePicker)는 기기
 * 타임존으로 읽는다. 한쪽 기준으로 통일해 넘기면 UTC 오프셋만큼 하루가 어긋난다
 * — KST(UTC+9)에서는 하루 전날이 뜬다. 정오로 맞추는 우회도 안 통한다. Android는 읽을 때
 * 정오가 아니라 UTC 자정을 돌려주므로 읽기 방향이 여전히 갈린다.
 *
 * 그래서 Platform.OS 판단은 date-field.tsx 한 곳에 두고, 계산만 여기서 한다.
 * toISOString()은 쓰지 않는다 — 로컬 모드에서 하루가 밀린다.
 */
export function fromIsoDate(isoDate: string, utc = false): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = utc ? new Date(Date.UTC(year, month - 1, day)) : new Date(year, month - 1, day);
  // new Date(2024, 12, 32)는 던지지 않고 조용히 다음 달로 넘어간다. 되돌려 확인한다.
  const rolled = utc ? date.getUTCMonth() : date.getMonth();
  return rolled === month - 1 ? date : null;
}

export function toIsoDate(date: Date, utc = false): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const [year, month, day] = utc
    ? [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
    : [date.getFullYear(), date.getMonth() + 1, date.getDate()];
  return `${year}-${pad(month)}-${pad(day)}`;
}

export const todayIso = () => toIsoDate(new Date());

export type MemorySection = { title: string; data: Memory[] };

/**
 * SectionList용으로 방문일별로 묶는다.
 * 서버가 이미 visitedAt DESC로 정렬해 보내므로 여기서 다시 정렬하지 않는다 —
 * 순서를 유지하면서 인접한 같은 날짜만 모은다.
 */
export function groupMemoriesByDate(memories: Memory[]): MemorySection[] {
  return memories.reduce<MemorySection[]>((sections, memory) => {
    const last = sections.at(-1);
    if (last?.title === memory.visitedAt) {
      return [...sections.slice(0, -1), { ...last, data: [...last.data, memory] }];
    }
    return [...sections, { title: memory.visitedAt, data: [memory] }];
  }, []);
}
