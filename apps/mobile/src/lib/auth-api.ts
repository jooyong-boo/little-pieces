import { z } from 'zod';

import { env } from '@/lib/env';

const authResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ token: z.string() }),
  error: z.null(),
});

const errorResponseSchema = z.object({
  success: z.literal(false),
  data: z.null(),
  error: z.string(),
});

async function postAuth(path: string, email: string, password: string) {
  const response = await fetch(`${env.EXPO_PUBLIC_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const json = await response.json();

  if (!response.ok) {
    const parsedError = errorResponseSchema.safeParse(json);
    throw new Error(parsedError.success ? parsedError.data.error : '요청에 실패했습니다.');
  }

  return authResponseSchema.parse(json).data;
}

export function signupRequest(email: string, password: string) {
  return postAuth('/auth/signup', email, password);
}

export function loginRequest(email: string, password: string) {
  return postAuth('/auth/login', email, password);
}
