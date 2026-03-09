import { BadRequestException } from '@nestjs/common';
import type { ZodIssue, ZodSchema } from 'zod';

export function parseWithSchema<T>(schema: ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new BadRequestException({
      message: 'Validation failed',
      issues: result.error.issues.map((issue: ZodIssue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  return result.data;
}
