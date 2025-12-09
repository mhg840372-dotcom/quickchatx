declare module "@react-native-clipboard/clipboard" {
  type ClipboardModule = {
    setString?: (text: string) => void;
  };

  const Clipboard: ClipboardModule;
  export default Clipboard;
}
