import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useForm } from 'react-hook-form';
import { Text, View } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/button';
import { ErrorText } from '@/components/error-text';
import { FormField } from '@/components/form-field';
import { useCreateCouple } from '@/hooks/use-couple';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해주세요.').max(50, '50자 이하로 입력해주세요.'),
  anniversaryDate: z
    .string()
    .trim()
    .refine((value) => value === '' || ISO_DATE.test(value), 'YYYY-MM-DD 형식으로 입력해주세요.'),
});

type CreateForm = z.infer<typeof createSchema>;

export default function CreateCoupleScreen() {
  const mutation = useCreateCouple();
  const { control, handleSubmit } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', anniversaryDate: '' },
  });

  // 성공하면 커플 쿼리가 갱신되고 루트 가드가 (app)으로 옮겨준다.
  // 초대 코드는 타임라인 상단 배너가 이어서 보여준다.
  const onSubmit = (values: CreateForm) =>
    mutation.mutate({
      name: values.name,
      anniversaryDate: values.anniversaryDate === '' ? null : values.anniversaryDate,
    });

  return (
    <View className="flex-1 justify-center gap-4 bg-white px-6">
      <Text className="mb-2 text-2xl font-bold">공간 만들기</Text>

      <FormField control={control} name="name" label="이름" placeholder="예: 우리 둘" />
      <FormField
        control={control}
        name="anniversaryDate"
        label="처음 만난 날 (선택)"
        placeholder="2024-05-01"
        keyboardType="numbers-and-punctuation"
      />

      <ErrorText error={mutation.error} />

      <Button title="만들기" isLoading={mutation.isPending} onPress={handleSubmit(onSubmit)} />
      <Button title="뒤로" variant="secondary" onPress={() => router.back()} />
    </View>
  );
}
