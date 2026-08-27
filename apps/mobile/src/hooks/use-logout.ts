import { useAuthStore } from '@/lib/auth-store';
import { currentToken, rememberToken } from '@/lib/push';
import { unregisterPushToken } from '@/lib/push-api';

/**
 * 로그아웃 전에 이 기기의 푸시 토큰을 먼저 지운다.
 *
 * 순서가 중요하다 — 로그아웃이 먼저면 인증 토큰이 사라져서 삭제 요청이 401로 튕기고,
 * 서버에는 죽은 토큰이 남아 다음 사용자에게 알림이 잘못 갈 수 있다.
 * 토큰 삭제가 실패해도 로그아웃 자체는 막지 않는다.
 */
export function useLogout() {
  const logout = useAuthStore((state) => state.logout);

  return async () => {
    const token = currentToken();
    if (token) {
      try {
        await unregisterPushToken(token);
      } catch {
        // 네트워크가 끊겨도 로그아웃은 되어야 한다.
      }
      rememberToken(null);
    }
    await logout();
  };
}
