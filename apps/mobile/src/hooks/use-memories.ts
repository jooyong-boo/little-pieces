import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createMemoryRequest,
  deleteMemoryRequest,
  fetchMemories,
  fetchMemory,
  type MemoryInput,
  updateMemoryRequest,
} from '@/lib/memory-api';
import { queryKeys } from '@/lib/query-client';

export function useMemories() {
  return useQuery({ queryKey: queryKeys.memories, queryFn: fetchMemories });
}

export function useMemory(id: string) {
  return useQuery({ queryKey: queryKeys.memory(id), queryFn: () => fetchMemory(id) });
}

function useMemoriesInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.memories });
}

export function useCreateMemory() {
  const invalidate = useMemoriesInvalidation();
  return useMutation({
    mutationFn: (input: MemoryInput) => createMemoryRequest(input),
    onSuccess: invalidate,
  });
}

export function useUpdateMemory(id: string) {
  const invalidate = useMemoriesInvalidation();
  return useMutation({
    mutationFn: (input: MemoryInput) => updateMemoryRequest(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteMemory(id: string) {
  const invalidate = useMemoriesInvalidation();
  return useMutation({
    mutationFn: () => deleteMemoryRequest(id),
    onSuccess: invalidate,
  });
}
