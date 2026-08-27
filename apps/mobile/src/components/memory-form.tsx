import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/button';
import { ErrorText } from '@/components/error-text';
import { FormField } from '@/components/form-field';
import { ImageStrip } from '@/components/image-strip';
import { LocationField } from '@/components/location-field';
import type { Coordinate } from '@/lib/map';
import type { MemoryInput } from '@/lib/memory-api';
import { toKeys, type MemoryImage } from '@/lib/memory-images';
import { todayIso } from '@/lib/timeline';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const memoryFormSchema = z.object({
  title: z.string().trim().min(1, '제목을 입력해주세요.').max(120, '120자 이하로 입력해주세요.'),
  description: z.string().max(500, '500자 이하로 입력해주세요.'),
  placeName: z.string().max(100, '100자 이하로 입력해주세요.'),
  visitedAt: z.string().regex(ISO_DATE, 'YYYY-MM-DD 형식으로 입력해주세요.'),
});

type MemoryFormValues = z.infer<typeof memoryFormSchema>;

export type MemoryFormDefaults = Partial<MemoryFormValues>;

type MemoryFormProps = {
  defaults?: MemoryFormDefaults;
  /** 수정 화면에서 이미 올려둔 사진. */
  initialImages?: MemoryImage[];
  /** 수정 화면에서 이미 찍어둔 위치. */
  initialCoordinate?: Coordinate | null;
  submitLabel: string;
  isPending: boolean;
  error: Error | null;
  onSubmit: (input: MemoryInput) => void;
};

/** 비워둔 칸은 null로 보낸다 — 서버도 빈 문자열을 "없음"으로 취급한다. */
const nullIfBlank = (value: string) => (value.trim() === '' ? null : value.trim());

export function MemoryForm({
  defaults,
  initialImages,
  initialCoordinate,
  submitLabel,
  isPending,
  error,
  onSubmit,
}: MemoryFormProps) {
  const [images, setImages] = useState<MemoryImage[]>(initialImages ?? []);
  const [coordinate, setCoordinate] = useState<Coordinate | null>(initialCoordinate ?? null);
  const { control, handleSubmit } = useForm<MemoryFormValues>({
    resolver: zodResolver(memoryFormSchema),
    defaultValues: {
      title: defaults?.title ?? '',
      description: defaults?.description ?? '',
      placeName: defaults?.placeName ?? '',
      visitedAt: defaults?.visitedAt ?? todayIso(),
    },
  });

  const submit = (values: MemoryFormValues) =>
    onSubmit({
      title: values.title.trim(),
      description: nullIfBlank(values.description),
      placeName: nullIfBlank(values.placeName),
      latitude: coordinate?.latitude ?? null,
      longitude: coordinate?.longitude ?? null,
      imageKeys: toKeys(images),
      visitedAt: values.visitedAt,
    });

  return (
    <View className="gap-4">
      <FormField control={control} name="title" label="제목" placeholder="예: 첫 데이트" />
      <FormField
        control={control}
        name="visitedAt"
        label="날짜"
        placeholder="2024-05-01"
        keyboardType="numbers-and-punctuation"
      />
      <FormField control={control} name="placeName" label="장소 (선택)" placeholder="예: 성수동" />
      <LocationField coordinate={coordinate} onChange={setCoordinate} />
      <ImageStrip images={images} onChange={setImages} />
      <FormField
        control={control}
        name="description"
        label="메모 (선택)"
        placeholder="그날 어땠는지 적어두세요"
        multiline
        numberOfLines={4}
        style={{ minHeight: 96, textAlignVertical: 'top' }}
      />

      <ErrorText error={error} />

      <Button title={submitLabel} isLoading={isPending} onPress={handleSubmit(submit)} />
    </View>
  );
}
