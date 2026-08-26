import { waitFor } from '@testing-library/react-native';
import { z } from 'zod';

import { request } from '../api-client';
import { useAuthStore } from '../auth-store';

jest.mock('@/lib/storage', () => ({
  getToken: jest.fn(async () => null),
  setToken: jest.fn(async () => {}),
  deleteToken: jest.fn(async () => {}),
}));

const respondWith = (status: number, body: unknown) => {
  globalThis.fetch = jest.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
};

const unauthorized = { success: false, data: null, error: '토큰이 만료되었습니다.' };

beforeEach(() => {
  useAuthStore.setState({ token: null, isAuthenticated: false, isHydrated: true });
});

test('logs the user out when an authenticated request comes back 401', async () => {
  useAuthStore.setState({ token: 'expired-token', isAuthenticated: true });
  respondWith(401, unauthorized);

  await expect(request('/memories', { schema: z.array(z.unknown()) })).rejects.toThrow(
    '토큰이 만료되었습니다.',
  );

  await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false));
});

test('does not log out when login itself is rejected', async () => {
  useAuthStore.setState({ token: 'still-valid', isAuthenticated: true });
  respondWith(401, { success: false, data: null, error: '아이디 또는 비밀번호가 틀렸습니다.' });

  await expect(
    request('/auth/login', { method: 'POST', body: {}, schema: z.unknown(), anonymous: true }),
  ).rejects.toThrow('아이디 또는 비밀번호가 틀렸습니다.');

  expect(useAuthStore.getState().isAuthenticated).toBe(true);
});

test('unwraps the response envelope', async () => {
  respondWith(200, { success: true, data: { id: 'abc' }, error: null });

  await expect(request('/memories/abc', { schema: z.object({ id: z.string() }) })).resolves.toEqual(
    {
      id: 'abc',
    },
  );
});

test('falls back to a generic message when the error body is unreadable', async () => {
  respondWith(500, 'not json at all');

  await expect(request('/memories', { schema: z.unknown() })).rejects.toThrow('(500)');
});
