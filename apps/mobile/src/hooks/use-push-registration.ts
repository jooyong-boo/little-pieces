import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { getPushToken, rememberToken } from '@/lib/push';
import { registerPushToken } from '@/lib/push-api';

/** 서버가 알림에 실어 보내는 데이터. 탭했을 때 어디로 갈지 알려준다. */
function memoryIdFrom(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const { memoryId } = data as { memoryId?: unknown };
  return typeof memoryId === 'string' ? memoryId : null;
}

/**
 * 커플이 연결된 뒤에만 부른다 — 알림을 받을 상대가 생긴 시점이라
 * 권한을 물어볼 맥락이 있다. 로그인 직후에 물으면 왜 필요한지 알 수 없다.
 *
 * 실패는 조용히 넘긴다. 푸시는 곁가지고, 알림을 못 받는다고 앱을 막으면 안 된다.
 */
export function usePushRegistration() {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const token = await getPushToken();
      if (cancelled || !token) return;
      try {
        await registerPushToken(token);
        rememberToken(token);
      } catch {
        // 등록 실패는 알림만 못 받는 것이다.
      }
    })();

    // 알림을 탭하면 해당 추억으로 간다.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const memoryId = memoryIdFrom(response.notification.request.content.data);
      if (memoryId) router.push({ pathname: '/memory/[id]', params: { id: memoryId } });
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
}
