import { NativeTabs } from 'expo-router/unstable-native-tabs';

// ponytail: 아이콘은 iOS SF Symbol만. Android는 drawable 리소스가 필요한데
// 아직 없어서 라벨만 나온다 — 아이콘 에셋이 생기면 drawable을 채운다.
export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>추억</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="heart.text.square.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Label>지도</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="map.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>설정</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
