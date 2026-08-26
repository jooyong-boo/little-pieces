import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

type FormFieldProps<T extends FieldValues> = TextInputProps & {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
};

/**
 * Controller + TextInput + 에러 문구 묶음. 폼마다 이 셋을 다시 쓰는 걸 막는다.
 */
export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  ...inputProps
}: FormFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View className="gap-1">
          {label ? <Text className="text-sm font-medium text-gray-600">{label}</Text> : null}
          <TextInput
            className="rounded-lg border border-gray-300 px-4 py-3"
            placeholderTextColor="#9ca3af"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value ?? ''}
            {...inputProps}
          />
          {error ? <Text className="text-red-500">{error.message}</Text> : null}
        </View>
      )}
    />
  );
}
