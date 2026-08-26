import { Image } from 'expo-image';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { ErrorText } from '@/components/error-text';
import { pickImages, uploadPickedImage, type PickedImage } from '@/lib/image-upload';
import {
  addImage,
  MAX_IMAGES,
  type MemoryImage,
  remainingSlots,
  removeImage,
} from '@/lib/memory-images';

type ImageStripProps = {
  images: MemoryImage[];
  /**
   * setState 업데이터를 그대로 받는다. 업로드가 여러 장 겹쳐 돌 때
   * prop으로 받은 배열을 기준으로 더하면 먼저 끝난 것이 덮여 사라진다.
   */
  onChange: Dispatch<SetStateAction<MemoryImage[]>>;
};

type PendingUpload = { id: string; image: PickedImage };

/**
 * 고른 즉시 올린다 — 저장 버튼이 기다리지 않고, 진행 상태를 사진별로 보여줄 수 있다.
 * 대가는 작성을 취소했을 때 남는 고아 객체인데, 정리 잡 없이 그냥 둔다.
 */
export function ImageStrip({ images, onChange }: ImageStripProps) {
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const slots = remainingSlots(images) - pending.length;

  const onAdd = async () => {
    setError(null);

    let picked: PickedImage[];
    try {
      picked = await pickImages(slots);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('사진을 불러오지 못했습니다.'));
      return;
    }

    const uploads = picked.map((image, index) => ({
      id: `${image.uri}-${index}`,
      image,
    }));
    setPending((current) => [...current, ...uploads]);

    for (const upload of uploads) {
      try {
        const key = await uploadPickedImage(upload.image);
        // 방금 올린 사진은 서명된 조회 URL이 없으므로 로컬 uri로 보여준다.
        onChange((current) => addImage(current, { key, uri: upload.image.uri }));
      } catch (cause) {
        setError(cause instanceof Error ? cause : new Error('사진 업로드에 실패했습니다.'));
      } finally {
        setPending((current) => current.filter((item) => item.id !== upload.id));
      }
    }
  };

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-gray-600">
        사진 ({images.length}/{MAX_IMAGES})
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2"
      >
        {images.map((image) => (
          <View key={image.key} className="h-20 w-20">
            <View className="h-full w-full overflow-hidden rounded-lg bg-gray-100">
              {image.uri ? (
                <Image source={{ uri: image.uri }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Text className="text-xs text-gray-400">사진</Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={() => onChange((current) => removeImage(current, image.key))}
              accessibilityRole="button"
              accessibilityLabel="사진 제거"
              hitSlop={8}
              className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-black/70"
            >
              <Text className="text-xs font-bold text-white">×</Text>
            </Pressable>
          </View>
        ))}

        {pending.map((item) => (
          <View
            key={item.id}
            className="h-20 w-20 items-center justify-center rounded-lg bg-gray-100"
          >
            <ActivityIndicator />
          </View>
        ))}

        {slots > 0 ? (
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel="사진 추가"
            className="h-20 w-20 items-center justify-center rounded-lg border border-dashed border-gray-300"
          >
            <Text className="text-2xl text-gray-400">+</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <ErrorText error={error} />
    </View>
  );
}
