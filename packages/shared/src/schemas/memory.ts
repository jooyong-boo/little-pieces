import { z } from 'zod';

export const memorySchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  visitedAt: z.string(),
});
