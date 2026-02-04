import { Text } from '@react-navigation/elements';
import { Pressable, PressableProps, StyleSheet } from 'react-native';

interface ButtonProps extends PressableProps {
  label: string;
  variant?: 'filled' | 'outlined';
  size?: 'small' | 'medium' | 'large';
}

const Button = ({
  label,
  variant = 'filled',
  size = 'medium',
  ...rest
}: ButtonProps) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        styles[variant],
        styles[size],
        pressed && styles.pressed,
      ]}
      {...rest}
    >
      <Text style={styles[`${variant}Text`]}>{label}</Text>
    </Pressable>
  );
};

export default Button;

const styles = StyleSheet.create({
  container: {
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filled: {
    backgroundColor: 'red',
  },
  outlined: {
    backgroundColor: 'transparent',
    borderColor: 'red',
  },
  filledText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  outlinedText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'red',
  },
  small: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  medium: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  large: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  pressed: {
    opacity: 0.75,
  },
});
