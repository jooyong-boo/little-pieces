import { z } from 'zod';

import { useAuthStore } from '@/lib/auth-store';
import { env } from '@/lib/env';

const errorResponseSchema = z.object({
  success: z.literal(false),
  data: z.null(),
  error: z.string(),
});

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions<T> = {
  schema: z.ZodType<T>;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** 로그인/회원가입처럼 토큰 없이 부르는 요청. */
  anonymous?: boolean;
};

function errorMessage(json: unknown, status: number) {
  const parsed = errorResponseSchema.safeParse(json);
  if (parsed.success) return parsed.data.error;
  return `요청에 실패했습니다. (${status})`;
}

/**
 * 서버의 `{ success, data, error }` 봉투를 벗기고 data만 zod로 검증해서 돌려준다.
 * 엔드포인트별 클라이언트(auth-api, couple-api, memory-api)는 전부 이걸 통한다.
 */
export async function request<T>(path: string, options: RequestOptions<T>): Promise<T> {
  const { schema, method = 'GET', body, anonymous = false } = options;
  const token = anonymous ? null : useAuthStore.getState().token;

  const response = await fetch(`${env.EXPO_PUBLIC_API_URL}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    // 토큰을 붙여 보냈는데 401이면 만료된 것이다. 로그인 화면으로 되돌린다.
    // 토큰 없이 받은 401은 자격증명이 틀린 것이므로 로그아웃할 게 없다.
    if (response.status === 401 && token) {
      void useAuthStore.getState().logout();
    }
    throw new ApiError(errorMessage(json, response.status), response.status);
  }

  const envelope = z.object({ success: z.literal(true), data: schema, error: z.null() });
  return envelope.parse(json).data;
}
