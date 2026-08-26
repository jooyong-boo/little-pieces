import { z } from 'zod';

import { request } from '@/lib/api-client';

const authResponseSchema = z.object({ token: z.string() });

export function signupRequest(email: string, password: string, nickname: string) {
  return request('/auth/signup', {
    method: 'POST',
    body: { email, password, nickname },
    schema: authResponseSchema,
    anonymous: true,
  });
}

export function loginRequest(email: string, password: string) {
  return request('/auth/login', {
    method: 'POST',
    body: { email, password },
    schema: authResponseSchema,
    anonymous: true,
  });
}
