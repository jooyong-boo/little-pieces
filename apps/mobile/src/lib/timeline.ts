import type { Memory } from '@/lib/memory-api';

/** 'YYYY-MM-DD' → '2024년 5월 1일'. Intl 없이 문자열만으로 만든다. */
export function formatKoreanDate(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`;
}

export function todayIso() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

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
