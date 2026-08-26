import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';

import LoginScreen from '../login';

test('renders the login screen', async () => {
  const queryClient = new QueryClient();
  await render(
    <QueryClientProvider client={queryClient}>
      <LoginScreen />
    </QueryClientProvider>,
  );

  expect(screen.getByPlaceholderText('이메일')).toBeVisible();
  expect(screen.getByPlaceholderText('비밀번호')).toBeVisible();
  expect(screen.getAllByText('로그인')).toHaveLength(2);
});
