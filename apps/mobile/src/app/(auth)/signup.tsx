import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { signupRequest } from '@/lib/auth-api';
import { useAuthStore } from '@/lib/auth-store';

const signupSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
});

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupScreen() {
  const login = useAuthStore((state) => state.login);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: SignupForm) => signupRequest(values.email, values.password),
    onSuccess: (data) => login(data.token),
  });

  const onSubmit = (values: SignupForm) => mutation.mutate(values);

  return (
    <View className="flex-1 justify-center gap-4 bg-white px-6">
      <Text className="mb-2 text-2xl font-bold">회원가입</Text>

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <View className="gap-1">
            <TextInput
              className="rounded-lg border border-gray-300 px-4 py-3"
              placeholder="이메일"
              autoCapitalize="none"
              keyboardType="email-address"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
            {errors.email ? <Text className="text-red-500">{errors.email.message}</Text> : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <View className="gap-1">
            <TextInput
              className="rounded-lg border border-gray-300 px-4 py-3"
              placeholder="비밀번호"
              secureTextEntry
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
            {errors.password ? (
              <Text className="text-red-500">{errors.password.message}</Text>
            ) : null}
          </View>
        )}
      />

      {mutation.isError ? <Text className="text-red-500">{mutation.error.message}</Text> : null}

      <Pressable
        className="items-center rounded-lg bg-blue-600 py-3 disabled:opacity-50"
        disabled={mutation.isPending}
        onPress={handleSubmit(onSubmit)}
      >
        <Text className="font-semibold text-white">가입하기</Text>
      </Pressable>

      <Link href="/(auth)/login" className="text-center text-blue-600">
        이미 계정이 있으신가요? 로그인
      </Link>
    </View>
  );
}
