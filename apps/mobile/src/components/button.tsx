import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
};

const VARIANT_STYLES = {
  primary: { container: 'bg-blue-600', label: 'text-white' },
  secondary: { container: 'border border-gray-300 bg-white', label: 'text-gray-800' },
  danger: { container: 'border border-red-300 bg-white', label: 'text-red-600' },
} as const;

export function Button({ title, variant = 'primary', isLoading, disabled, ...rest }: ButtonProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <Pressable
      className={`items-center rounded-lg py-3 ${styles.container} ${
        disabled || isLoading ? 'opacity-50' : ''
      }`}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'primary' ? '#ffffff' : '#4b5563'} />
      ) : (
        <Text className={`font-semibold ${styles.label}`}>{title}</Text>
      )}
    </Pressable>
  );
}
