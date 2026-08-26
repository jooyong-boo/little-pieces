import * as SecureStore from 'expo-secure-store';
import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV();

const AUTH_TOKEN_KEY = 'auth-token';

export async function getToken() {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function setToken(token: string) {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

export async function deleteToken() {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}
