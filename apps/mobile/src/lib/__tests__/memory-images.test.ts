import {
  addImage,
  fromMemory,
  MAX_IMAGES,
  remainingSlots,
  removeImage,
  toKeys,
} from '../memory-images';

const image = (key: string) => ({ key, uri: `file:///${key}` });
const fill = (count: number) => Array.from({ length: count }, (_, i) => image(`k${i}`));

test('pairs each stored key with its signed url', () => {
  const images = fromMemory({ imageKeys: ['a', 'b'], imageUrls: ['url-a', 'url-b'] });

  expect(images).toEqual([
    { key: 'a', uri: 'url-a' },
    { key: 'b', uri: 'url-b' },
  ]);
});

test('keeps keys when the server sent no urls', () => {
  // 스토리지 미설정이면 imageUrls가 빈 배열로 온다. 키를 잃으면 저장 시 사진이 사라진다.
  const images = fromMemory({ imageKeys: ['a'], imageUrls: [] });

  expect(toKeys(images)).toEqual(['a']);
});

test('appends a new image', () => {
  expect(toKeys(addImage([image('a')], image('b')))).toEqual(['a', 'b']);
});

test('ignores a key that is already present', () => {
  const images = [image('a')];

  expect(addImage(images, image('a'))).toBe(images);
});

test('refuses to go past the limit', () => {
  const full = fill(MAX_IMAGES);

  expect(addImage(full, image('one-too-many'))).toBe(full);
});

test('does not mutate the input array', () => {
  const images = [image('a')];
  addImage(images, image('b'));
  removeImage(images, 'a');

  expect(images).toHaveLength(1);
});

test('removes by key', () => {
  expect(toKeys(removeImage([image('a'), image('b')], 'a'))).toEqual(['b']);
});

test('reports how many more can be added', () => {
  expect(remainingSlots([])).toBe(MAX_IMAGES);
  expect(remainingSlots(fill(MAX_IMAGES))).toBe(0);
  expect(remainingSlots(fill(MAX_IMAGES + 5))).toBe(0);
});
