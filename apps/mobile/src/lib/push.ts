import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Android는 채널이 없으면 알림이 조용히 무시된다. */
const ANDROID_CHANNEL_ID = 'default';

/**
 * 마지막으로 서버에 등록한 토큰. 로그아웃할 때 무엇을 지울지 알아야 한다.
 * 기기당 하나뿐이라 모듈 변수로 충분하다.
 */
let registeredToken: string | null = null;

export function rememberToken(token: string | null) {
  registeredToken = token;
}

export function currentToken() {
  return registeredToken;
}

/**
 * EAS projectId 없이는 `getExpoPushTokenAsync`가 토큰을 만들지 못한다.
 * `eas init`이 app.json의 extra.eas.projectId에 넣어준다.
 */
export function easProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? null;
}

/**
 * 알림을 받을 수 있는 상태를 만들고 Expo 푸시 토큰을 돌려준다.
 * 받을 수 없으면(권한 거부, 시뮬레이터, projectId 없음) `null`.
 *
 * 실패를 예외로 올리지 않는 이유: 푸시는 곁가지다. 알림을 못 받는다고
 * 앱을 쓸 수 없게 만들면 안 된다.
 */
export async function getPushToken(): Promise<string | null> {
  const projectId = easProjectId();
  if (!projectId) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: '기본',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const granted =
    existing.granted ||
    (existing.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);

  if (!granted) return null;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    // 시뮬레이터/에뮬레이터에는 푸시 자격증명이 없다. 정상적인 실패다.
    return null;
  }
}
