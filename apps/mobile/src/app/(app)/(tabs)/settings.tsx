import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ActivityIndicator, Alert, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button } from '@/components/button';
import { ErrorText } from '@/components/error-text';
import { FormField } from '@/components/form-field';
import { useCouple, useLeaveCouple, useUpdateCouple } from '@/hooks/use-couple';
import { useAuthStore } from '@/lib/auth-store';
import { type Couple } from '@/lib/couple-api';
import { calculateAnniversary } from '@/lib/dday';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const coupleSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해주세요.').max(50, '50자 이하로 입력해주세요.'),
  anniversaryDate: z
    .string()
    .trim()
    .refine((value) => value === '' || ISO_DATE.test(value), 'YYYY-MM-DD 형식으로 입력해주세요.'),
});

type CoupleForm = z.infer<typeof coupleSchema>;

export default function SettingsScreen() {
  const { data: couple, isPending } = useCouple();
  const logout = useAuthStore((state) => state.logout);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerClassName="gap-6 px-6 py-6"
      >
        <Text className="text-2xl font-bold">설정</Text>

        {isPending ? <ActivityIndicator /> : null}

        {couple ? (
          <>
            <AnniversaryCard couple={couple} />
            <InviteCard couple={couple} />
            <MembersCard couple={couple} />
            <CoupleInfoForm couple={couple} />
            <LeaveCouple />
          </>
        ) : null}

        <Button title="로그아웃" variant="secondary" onPress={() => void logout()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function AnniversaryCard({ couple }: { couple: Couple }) {
  if (!couple.anniversaryDate) return null;

  const anniversary = calculateAnniversary(couple.anniversaryDate, new Date());
  if (!anniversary) return null;

  return (
    <View className="items-center gap-1 rounded-xl bg-blue-50 p-6">
      <Text className="text-sm text-blue-700">{couple.name}</Text>
      <Text className="text-3xl font-bold text-blue-700">{anniversary.dayCount}일째</Text>
      {anniversary.nextMilestone ? (
        <Text className="text-sm text-blue-600">
          {anniversary.nextMilestone.label}까지 {anniversary.nextMilestone.daysLeft}일
        </Text>
      ) : null}
    </View>
  );
}

function InviteCard({ couple }: { couple: Couple }) {
  const isWaitingForPartner = couple.members.length < 2;

  const share = () =>
    void Share.share({
      message: `Little Pieces 초대 코드: ${couple.inviteCode}`,
    });

  return (
    <View className="gap-2 rounded-xl border border-gray-200 p-4">
      <Text className="text-sm font-semibold text-gray-600">초대 코드</Text>
      <Text className="text-2xl font-bold tracking-widest">{couple.inviteCode}</Text>
      {isWaitingForPartner ? (
        <Text className="text-sm text-gray-500">상대가 이 코드를 입력하면 연결됩니다.</Text>
      ) : null}
      <Button title="코드 공유하기" variant="secondary" onPress={share} />
    </View>
  );
}

function MembersCard({ couple }: { couple: Couple }) {
  return (
    <View className="gap-2 rounded-xl border border-gray-200 p-4">
      <Text className="text-sm font-semibold text-gray-600">멤버</Text>
      {couple.members.map((member) => (
        <Text key={member.userId}>
          {member.nickname}
          {member.role === 'owner' ? ' (개설자)' : ''}
        </Text>
      ))}
    </View>
  );
}

function CoupleInfoForm({ couple }: { couple: Couple }) {
  const mutation = useUpdateCouple();
  const { control, handleSubmit } = useForm<CoupleForm>({
    resolver: zodResolver(coupleSchema),
    defaultValues: {
      name: couple.name,
      anniversaryDate: couple.anniversaryDate ?? '',
    },
  });

  const onSubmit = (values: CoupleForm) =>
    mutation.mutate({
      name: values.name,
      anniversaryDate: values.anniversaryDate === '' ? null : values.anniversaryDate,
    });

  return (
    <View className="gap-4 rounded-xl border border-gray-200 p-4">
      <Text className="text-sm font-semibold text-gray-600">공간 정보</Text>
      <FormField control={control} name="name" label="이름" />
      <FormField
        control={control}
        name="anniversaryDate"
        label="처음 만난 날"
        placeholder="2024-05-01"
        keyboardType="numbers-and-punctuation"
      />
      <ErrorText error={mutation.error} />
      <Button title="저장" isLoading={mutation.isPending} onPress={handleSubmit(onSubmit)} />
    </View>
  );
}

function LeaveCouple() {
  const mutation = useLeaveCouple();

  // 잘못된 코드로 연결했을 때 되돌릴 유일한 길이라 확인을 한 번 받는다.
  const confirm = () =>
    Alert.alert('공간에서 나갈까요?', '마지막 한 명이 나가면 추억도 함께 사라집니다.', [
      { text: '취소', style: 'cancel' },
      { text: '나가기', style: 'destructive', onPress: () => mutation.mutate(undefined) },
    ]);

  return (
    <View className="gap-2">
      <ErrorText error={mutation.error} />
      <Button
        title="공간에서 나가기"
        variant="danger"
        isLoading={mutation.isPending}
        onPress={confirm}
      />
    </View>
  );
}
