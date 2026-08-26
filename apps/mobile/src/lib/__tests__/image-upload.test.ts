import { resolveMimeType } from '../image-upload';

test('uses the declared mime type when the server allows it', () => {
  expect(resolveMimeType({ mimeType: 'image/png', fileName: 'a.jpg' })).toBe('image/png');
});

test('falls back to the file extension when mimeType is missing', () => {
  // asset.mimeType은 optional이다 — 없다고 업로드를 포기하면 안 된다.
  expect(resolveMimeType({ fileName: 'IMG_0001.PNG' })).toBe('image/png');
  expect(resolveMimeType({ fileName: 'photo.heic' })).toBe('image/heic');
});

test('normalizes jpg and jpeg to the same mime type', () => {
  expect(resolveMimeType({ fileName: 'a.jpg' })).toBe('image/jpeg');
  expect(resolveMimeType({ fileName: 'a.jpeg' })).toBe('image/jpeg');
});

test('falls back to jpeg when there is nothing to go on', () => {
  expect(resolveMimeType({})).toBe('image/jpeg');
  expect(resolveMimeType({ fileName: null })).toBe('image/jpeg');
  expect(resolveMimeType({ fileName: 'no-extension' })).toBe('image/jpeg');
});

test('ignores a mime type the server would reject', () => {
  // 서버가 허용 목록으로 검사하므로, 목록 밖 값을 그대로 보내면 400이 난다.
  expect(resolveMimeType({ mimeType: 'image/gif', fileName: 'a.png' })).toBe('image/png');
  expect(resolveMimeType({ mimeType: 'application/pdf' })).toBe('image/jpeg');
});
