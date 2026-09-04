import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { formatKoreanDate, fromIsoDate, todayIso, toIsoDate } from '@/lib/timeline';

/**
 * 네이티브 피커가 Date를 읽는 기준이 플랫폼마다 반대다 — Android는 UTC 자정,
 * iOS는 기기 타임존. 이 저장소에서 그 사실을 아는 유일한 줄이다. 변환은 timeline.ts가 한다.
 */
const PICKER_UTC = Platform.OS === 'android';

type DateFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
};

/**
 * FormField와 같은 시그니처를 갖는 날짜 필드. 손으로 'YYYY-MM-DD'를 치는 대신 네이티브
 * 피커를 연다. 값은 여전히 문자열이라 zod 스키마와 서버 계약은 그대로다.
 */
export function DateField<T extends FieldValues>({ control, name, label }: DateFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <View className="gap-1">
          {label ? <Text className="text-sm font-medium text-gray-600">{label}</Text> : null}
          <DatePicker value={value} onChange={onChange} />
          {/*
            피커는 잘못된 값을 만들 수 없지만, 스키마가 어떤 이유로든 거부하면
            handleSubmit이 조용히 아무것도 안 하는 미스터리가 된다. 한 줄로 막는다.
          */}
          {error ? <Text className="text-red-500">{error.message}</Text> : null}
        </View>
      )}
    />
  );
}

/**
 * Controller의 render는 컴포넌트가 아니라 콜백으로 불린다. 그 안에서 useState를 부르면
 * 훅 순서가 깨지므로 상태를 가진 부분을 별도 컴포넌트로 뺀다.
 */
function DatePicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [isPicking, setIsPicking] = useState(false);
  // 저장된 값이 깨져 있어도 피커는 열려야 한다. 오늘로 시작한다.
  const [draft, setDraft] = useState(() => fromIsoDate(value, PICKER_UTC) ?? new Date());

  const open = () => {
    setDraft(fromIsoDate(value, PICKER_UTC) ?? fromIsoDate(todayIso(), PICKER_UTC)!);
    setIsPicking(true);
  };

  const commit = (picked: Date) => {
    onChange(toIsoDate(picked, PICKER_UTC));
    setIsPicking(false);
  };

  return (
    <>
      {/*
        트리거는 인풋과 같은 한 줄 높이여야 한다. 피커를 폼에 상시 인라인으로 두면
        iOS는 달력이 통째로 펼쳐져(항상 inline이다) '저장' 버튼이 화면 밖으로 밀린다.
      */}
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`날짜 ${formatKoreanDate(value)}`}
        className="rounded-lg border border-gray-300 px-4 py-3"
      >
        <Text className="text-gray-800">📅 {formatKoreanDate(value)}</Text>
      </Pressable>

      {isPicking &&
        (Platform.OS === 'android' ? (
          // Android는 presentation 기본값이 dialog다. 마운트하는 순간 네이티브 다이얼로그가
          // 열리고 확인/취소 버튼도 다이얼로그가 직접 그린다.
          <DateTimePicker
            value={draft}
            mode="date"
            onValueChange={(_, picked) => commit(picked)}
            onDismiss={() => setIsPicking(false)}
          />
        ) : (
          <Modal visible animationType="slide" onRequestClose={() => setIsPicking(false)}>
            {/*
              전체화면이어야 한다. graphical 스타일 피커가 minWidth 320pt를 요구해서
              좁은 기기(iPhone SE)에서 좌우 패딩을 주면 넘친다.
            */}
            <SafeAreaView className="flex-1 justify-between bg-white">
              <DateTimePicker
                value={draft}
                mode="date"
                display="inline"
                onValueChange={(_, picked) => setDraft(picked)}
              />
              <View className="gap-3 px-6 py-4">
                <Button title="이 날짜로" onPress={() => commit(draft)} />
                <Button title="취소" variant="secondary" onPress={() => setIsPicking(false)} />
              </View>
            </SafeAreaView>
          </Modal>
        ))}
    </>
  );
}
