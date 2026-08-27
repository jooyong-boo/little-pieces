import { currentToken, rememberToken } from '../push';

afterEach(() => rememberToken(null));

test('remembers the registered token so logout knows what to delete', () => {
  rememberToken('ExponentPushToken[abc]');

  expect(currentToken()).toBe('ExponentPushToken[abc]');
});

test('starts empty and can be cleared', () => {
  expect(currentToken()).toBeNull();

  rememberToken('ExponentPushToken[abc]');
  rememberToken(null);

  expect(currentToken()).toBeNull();
});
