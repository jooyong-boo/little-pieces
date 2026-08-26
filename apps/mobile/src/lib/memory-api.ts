import { z } from 'zod';

import { request } from '@/lib/api-client';

const memorySchema = z.object({
  id: z.string(),
  authorUserId: z.string().nullable(),
  authorNickname: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  placeName: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  /** 수정 화면이 그대로 되돌려 보내는 값. */
  imageKeys: z.array(z.string()),
  /** 표시용 서명 URL. 버킷이 비공개라 조회에도 서명이 필요하다. */
  imageUrls: z.array(z.string()),
  visitedAt: z.string(),
  createdAt: z.string(),
});

const uploadUrlSchema = z.object({
  key: z.string(),
  uploadUrl: z.string(),
  expiresInSeconds: z.number(),
});

export type ImageUploadTicket = z.infer<typeof uploadUrlSchema>;

export type Memory = z.infer<typeof memorySchema>;

export type MemoryInput = {
  title: string;
  description: string | null;
  placeName: string | null;
  latitude: number | null;
  longitude: number | null;
  imageKeys: string[];
  visitedAt: string;
};

/** 추억 ID를 요구하지 않는다 — 신규 작성 화면에는 아직 추억이 없다. */
export function requestImageUploadUrl(contentType: string) {
  return request('/memories/upload-url', {
    method: 'POST',
    body: { contentType },
    schema: uploadUrlSchema,
  });
}

export function fetchMemories() {
  return request('/memories', { schema: z.array(memorySchema) });
}

export function fetchMemory(id: string) {
  return request(`/memories/${id}`, { schema: memorySchema });
}

export function createMemoryRequest(input: MemoryInput) {
  return request('/memories', { method: 'POST', body: input, schema: memorySchema });
}

export function updateMemoryRequest(id: string, input: MemoryInput) {
  return request(`/memories/${id}`, { method: 'PUT', body: input, schema: memorySchema });
}

export function deleteMemoryRequest(id: string) {
  return request(`/memories/${id}`, { method: 'DELETE', schema: z.null() });
}
