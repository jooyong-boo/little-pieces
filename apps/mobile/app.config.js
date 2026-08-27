// app.json은 그대로 두고, 여기서는 커밋하면 안 되는 값만 주입한다.
// @expo/config가 app.json에서 합성한 설정을 `config`로 넘겨준다.
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    [
      'react-native-maps',
      {
        // 키가 없으면 undefined가 들어가고 플러그인이 Android 매니페스트 항목을
        // 건너뛴다 — 그 상태로 빌드하면 Android 지도가 회색으로 뜬다.
        // iOS는 키를 주지 않는다. 그래야 Google Maps Pod이 안 붙고 Apple Maps를 쓴다.
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY,
      },
    ],
  ],
});
