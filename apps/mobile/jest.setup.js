// react-native-nitro-modules tries to initialize native code on import, which crashes
// under Jest. react-native-mmkv already mocks its own MMKV behavior in test environments,
// so it's safe to stub the native module away entirely.
// https://github.com/mrousavy/react-native-mmkv/issues/934
jest.mock('react-native-nitro-modules', () => ({}));
