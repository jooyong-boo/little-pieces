import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient();

export const queryKeys = {
  couple: ['couple'] as const,
  memories: ['memories'] as const,
  memory: (id: string) => ['memories', id] as const,
};
