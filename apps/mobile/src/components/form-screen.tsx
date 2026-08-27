import type { PropsWithChildren } from 'react';
import { ScrollView } from 'react-native';

/**
 * 입력이 있는 화면의 껍데기.
 *
 * 가운데 정렬한 View로 두면 키보드가 올라올 때 버튼이 덮여서, 실기기에서는
 * 키보드를 손으로 내려야 제출할 수 있다. iOS 시뮬레이터는 하드웨어 키보드를
 * 쓰기 때문에 이 문제가 드러나지 않는다.
 *
 * - `flex-grow justify-center`: 내용이 짧으면 가운데, 키보드로 좁아지면 스크롤
 * - `keyboardShouldPersistTaps="handled"`: 키보드가 떠 있어도 버튼이 한 번에 눌린다.
 *   기본값이면 첫 탭이 키보드를 닫는 데 쓰이고 버튼은 안 눌린다.
 * - `automaticallyAdjustKeyboardInsets`: iOS에서 키보드 높이만큼 여백을 준다.
 *   Android는 매니페스트의 adjustResize가 같은 일을 한다.
 */
export function FormScreen({ children }: PropsWithChildren) {
  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="flex-grow justify-center gap-4 px-6 py-8"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}
