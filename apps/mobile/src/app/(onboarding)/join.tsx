import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useForm } from 'react-hook-form';
import { Text } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/button';
import { FormScreen } from '@/components/form-screen';
import { ErrorText } from '@/components/error-text';
import { FormField } from '@/components/form-field';
import { useJoinCouple } from '@/hooks/use-couple';

const joinSchema = z.object({
  inviteCode: z.string().trim().min(1, '초대 코드를 입력해주세요.'),
});

type JoinForm = z.infer<typeof joinSchema>;

export default function JoinCoupleScreen() {
  const mutation = useJoinCouple();
  const { control, handleSubmit } = useForm<JoinForm>({
    resolver: zodResolver(joinSchema),
    defaultValues: { inviteCode: '' },
  });

  // 성공하면 커플 쿼리가 갱신되고 루트 라우터가 (app)으로 옮겨준다.
  const onSubmit = (values: JoinForm) => mutation.mutate(values.inviteCode);

  return (
    <FormScreen>
      <Text className="mb-2 text-2xl font-bold">초대 코드 입력</Text>
      <Text className="text-gray-600">상대가 알려준 6자리 코드를 입력해주세요.</Text>

      <FormField
        control={control}
        name="inviteCode"
        placeholder="ABC123"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={8}
      />

      <ErrorText error={mutation.error} />

      <Button title="참여하기" isLoading={mutation.isPending} onPress={handleSubmit(onSubmit)} />
      <Button title="뒤로" variant="secondary" onPress={() => router.back()} />
    </FormScreen>
  );
}
