import type { Memory } from '@/lib/memory-api';

/** 서버의 MAX_IMAGES와 같은 값. 넘으면 저장이 400으로 떨어진다. */
export const MAX_IMAGES = 10;

/**
 * 화면에 뿌릴 한 장. `key`는 저장에 쓰고 `uri`는 표시에 쓴다.
 * 방금 올린 사진은 서명된 조회 URL이 아직 없어서 로컬 파일 uri를 쓴다.
 */
export type MemoryImage = { key: string; uri: string };

export function fromMemory(memory: Pick<Memory, 'imageKeys' | 'imageUrls'>): MemoryImage[] {
  // 스토리지 미설정이면 imageUrls가 비어 있다. 키는 살려두되 표시는 포기한다.
  return memory.imageKeys.map((key, index) => ({ key, uri: memory.imageUrls[index] ?? '' }));
}

export function addImage(images: MemoryImage[], image: MemoryImage): MemoryImage[] {
  if (images.length >= MAX_IMAGES) return images;
  if (images.some((existing) => existing.key === image.key)) return images;
  return [...images, image];
}

export function removeImage(images: MemoryImage[], key: string): MemoryImage[] {
  return images.filter((image) => image.key !== key);
}

export function remainingSlots(images: MemoryImage[]): number {
  return Math.max(0, MAX_IMAGES - images.length);
}

export function toKeys(images: MemoryImage[]): string[] {
  return images.map((image) => image.key);
}
