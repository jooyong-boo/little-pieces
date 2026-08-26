import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { requestImageUploadUrl } from '@/lib/memory-api';

/** 서버가 허용하는 형식과 같아야 한다 — 어긋나면 업로드 URL 발급이 400으로 떨어진다. */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};
const FALLBACK_MIME_TYPE = 'image/jpeg';
/** 휴대폰 사진은 3~5MB다. 서버측 리사이즈가 없으니 여기서 줄인다. */
const PICKER_QUALITY = 0.7;

export type PickedImage = { uri: string; mimeType: string };

/**
 * `asset.mimeType`은 optional이다. 없으면 파일명 확장자로, 그것도 없으면 JPEG로 본다.
 * 서버가 허용 목록으로 검사하므로 목록 밖의 값은 폴백으로 돌린다.
 */
export function resolveMimeType(asset: { mimeType?: string; fileName?: string | null }): string {
  const declared = asset.mimeType?.toLowerCase();
  if (declared && ALLOWED_MIME_TYPES.includes(declared as (typeof ALLOWED_MIME_TYPES)[number])) {
    return declared;
  }

  const extension = asset.fileName?.split('.').pop()?.toLowerCase();
  return (extension && EXTENSION_MIME_TYPES[extension]) || FALLBACK_MIME_TYPE;
}

export async function pickImages(remainingSlots: number): Promise<PickedImage[]> {
  if (remainingSlots < 1) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: remainingSlots > 1,
    selectionLimit: remainingSlots,
    quality: PICKER_QUALITY,
  });

  if (result.canceled) return [];

  return result.assets.map((asset) => ({ uri: asset.uri, mimeType: resolveMimeType(asset) }));
}

/** 서버가 발급한 서명 URL로 직접 PUT하고, 저장에 쓸 객체 키를 돌려준다. */
export async function uploadPickedImage(image: PickedImage): Promise<string> {
  const ticket = await requestImageUploadUrl(image.mimeType);

  const result = await new File(image.uri).upload(ticket.uploadUrl, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': image.mimeType },
  });

  // upload()는 비2xx도 reject가 아니라 resolve한다. 직접 보지 않으면
  // 업로드 실패가 조용히 성공으로 넘어간다.
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`사진 업로드에 실패했습니다. (${result.status})`);
  }

  return ticket.key;
}
