import { z } from 'zod';

export const createCoupleSchema = z.object({
  name: z.string().min(1).max(60),
  anniversaryDate: z.string().datetime().optional(),
});

export type CreateCoupleRequest = z.infer<typeof createCoupleSchema>;
