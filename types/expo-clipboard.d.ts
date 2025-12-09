declare module "expo-clipboard" {
  export const setStringAsync: (text: string) => Promise<void>;
}

declare module "@react-native-clipboard/clipboard" {
  const Clipboard: { setString?: (text: string) => void };
  export default Clipboard;
}
