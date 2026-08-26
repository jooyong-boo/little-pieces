import { z } from 'zod';

import { request } from '@/lib/api-client';

const coupleMemberSchema = z.object({
  userId: z.string(),
  nickname: z.string(),
  role: z.string(),
  joinedAt: z.string(),
});

const coupleSchema = z.object({
  id: z.string(),
  name: z.string(),
  anniversaryDate: z.string().nullable(),
  inviteCode: z.string(),
  createdAt: z.string(),
  members: z.array(coupleMemberSchema),
});

export type Couple = z.infer<typeof coupleSchema>;
export type CoupleMember = z.infer<typeof coupleMemberSchema>;

export type CoupleInput = {
  name: string;
  anniversaryDate: string | null;
};

/** 커플이 없는 것은 신규 유저의 정상 상태다 — 에러가 아니라 null로 온다. */
export function fetchMyCouple() {
  return request('/couples/me', { schema: coupleSchema.nullable() });
}

export function createCoupleRequest(input: CoupleInput) {
  return request('/couples', { method: 'POST', body: input, schema: coupleSchema });
}

export function joinCoupleRequest(inviteCode: string) {
  return request('/couples/join', { method: 'POST', body: { inviteCode }, schema: coupleSchema });
}

export function updateCoupleRequest(input: CoupleInput) {
  return request('/couples/me', { method: 'PUT', body: input, schema: coupleSchema });
}

export function leaveCoupleRequest() {
  return request('/couples/me', { method: 'DELETE', schema: z.null() });
}
