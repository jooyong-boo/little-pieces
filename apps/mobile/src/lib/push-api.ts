import { z } from 'zod';

import { request } from '@/lib/api-client';

/** 서버는 토큰 형식을 검증하므로, 형식이 아닌 값을 보내면 400이 온다. */
export function registerPushToken(token: string) {
  return request('/push-tokens', { method: 'POST', body: { token }, schema: z.null() });
}

export function unregisterPushToken(token: string) {
  return request('/push-tokens', { method: 'DELETE', body: { token }, schema: z.null() });
}
