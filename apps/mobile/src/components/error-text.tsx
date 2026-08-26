import { Text } from 'react-native';

/** 뮤테이션/쿼리 에러를 화면에 그대로 보여준다. 조용히 삼키지 않는다. */
export function ErrorText({ error }: { error: Error | null }) {
  if (!error) return null;
  return <Text className="text-red-500">{error.message}</Text>;
}
