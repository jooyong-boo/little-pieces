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
import { loginRequest } from '@/lib/auth-api';
import { useAuthStore } from '@/lib/auth-store';

const loginSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const login = useAuthStore((state) => state.login);
  const { control, handleSubmit } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: LoginForm) => loginRequest(values.email, values.password),
    onSuccess: (data) => login(data.token),
  });

  return (
    <FormScreen>
      <Text className="mb-2 text-2xl font-bold">로그인</Text>

      <FormField
        control={control}
        name="email"
        placeholder="이메일"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <FormField control={control} name="password" placeholder="비밀번호" secureTextEntry />

      <ErrorText error={mutation.error} />

      <Button
        title="로그인"
        isLoading={mutation.isPending}
        onPress={handleSubmit((values) => mutation.mutate(values))}
      />

      <Link href="/(auth)/signup" className="text-center text-blue-600">
        계정이 없으신가요? 회원가입
      </Link>
    </FormScreen>
  );
}
