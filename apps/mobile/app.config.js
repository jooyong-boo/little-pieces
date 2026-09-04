// app.json은 그대로 두고, 여기서는 커밋하면 안 되는 값만 주입한다.
// @expo/config가 app.json에서 합성한 설정을 `config`로 넘겨준다.
// 로컬 개발 서버는 평문 HTTP다. Android는 릴리스 빌드에서 평문을 기본 차단하므로
// 실기기 테스트를 하려면 예외가 필요하다. 프로덕션 API는 HTTPS이므로 이 예외가
// 딸려 나가면 안 된다 — 그래서 기본은 꺼짐이고, 명시적으로 켤 때만 들어간다.
//   ALLOW_CLEARTEXT=1 npx expo run:android --variant release
const allowCleartext = process.env.ALLOW_CLEARTEXT === '1';

// Firebase(FCM) 설정. Android 푸시 토큰 발급에 필요하다.
// 커밋하지 않는 파일이라, 없으면 조용히 건너뛴다 — 푸시만 안 되고 나머지는 그대로 빌드된다.
const fs = require('node:fs');
const path = require('node:path');
const googleServicesFile = './google-services.json';
const hasFirebase = fs.existsSync(path.join(__dirname, googleServicesFile));

// CocoaPods의 Pods-*-frameworks.sh는 EXPANDED_CODE_SIGN_IDENTITY가 비어 있으면
// 임베드 프레임워크 서명을 통째로 건너뛴다(조용히). Expo 템플릿 기본값인
// "iPhone Developer"는 요즘 인증서 이름("Apple Development: ...")과 맞지 않아
// 그 변수가 빈 값이 된다. 그러면 빌드는 0 error로 성공하고 앱 본체도 서명되지만,
// 기기 설치가 ApplicationVerificationFailed로 죽는다:
//   hermesvm.framework : 0xe800801c (No code signature found.)
// ios/는 gitignore(CNG)라 project.pbxproj를 직접 고쳐도 prebuild가 되돌린다.
const { withXcodeProject } = require('@expo/config-plugins');

const withModernCodeSignIdentity = (config) =>
  withXcodeProject(config, (cfg) => {
    cfg.modResults.updateBuildProperty('CODE_SIGN_IDENTITY[sdk=iphoneos*]', '"Apple Development"');
    return cfg;
  });

module.exports = ({ config }) =>
  withModernCodeSignIdentity({
    ...config,
    android: {
      ...config.android,
      ...(hasFirebase ? { googleServicesFile } : {}),
    },
    plugins: [
      ...(config.plugins ?? []),
      ...(allowCleartext
        ? [['expo-build-properties', { android: { usesCleartextTraffic: true } }]]
        : []),
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
