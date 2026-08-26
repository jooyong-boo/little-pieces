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
  visitedAt: z.string(),
  createdAt: z.string(),
});

export type Memory = z.infer<typeof memorySchema>;

export type MemoryInput = {
  title: string;
  description: string | null;
  placeName: string | null;
  latitude: number | null;
  longitude: number | null;
  visitedAt: string;
};

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
