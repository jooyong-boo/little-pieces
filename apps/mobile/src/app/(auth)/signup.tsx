import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useForm } from 'react-hook-form';
import { Text } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/button';
import { FormScreen } from '@/components/form-screen';
import { ErrorText } from '@/components/error-text';
import { FormField } from '@/components/form-field';
import { signupRequest } from '@/lib/auth-api';
import { useAuthStore } from '@/lib/auth-store';

const signupSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
  // 파트너 화면에 이 이름이 그대로 보인다.
  nickname: z
    .string()
    .trim()
    .min(1, '닉네임을 입력해주세요.')
    .max(20, '닉네임은 20자 이하여야 합니다.'),
});

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupScreen() {
  const login = useAuthStore((state) => state.login);
  const { control, handleSubmit } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', nickname: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: SignupForm) =>
      signupRequest(values.email, values.password, values.nickname),
    onSuccess: (data) => login(data.token),
  });

  return (
    <FormScreen>
      <Text className="mb-2 text-2xl font-bold">회원가입</Text>

      <FormField
        control={control}
        name="email"
        placeholder="이메일"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <FormField control={control} name="password" placeholder="비밀번호" secureTextEntry />
      <FormField control={control} name="nickname" placeholder="닉네임" maxLength={20} />

      <ErrorText error={mutation.error} />

      <Button
        title="가입하기"
        isLoading={mutation.isPending}
        onPress={handleSubmit((values) => mutation.mutate(values))}
      />

      <Link href="/(auth)/login" className="text-center text-blue-600">
        이미 계정이 있으신가요? 로그인
      </Link>
    </FormScreen>
  );
}
