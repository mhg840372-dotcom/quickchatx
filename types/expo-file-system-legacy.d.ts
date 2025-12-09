declare module "expo-file-system/legacy" {
  export const cacheDirectory: string | null;
  export const documentDirectory: string | null;

  export function getInfoAsync(
    fileUri: string,
    options?: { size?: boolean }
  ): Promise<{
    exists: boolean;
    isDirectory: boolean;
    uri: string;
    size?: number;
    modificationTime?: number;
  }>;

  export function makeDirectoryAsync(
    fileUri: string,
    options?: { intermediates?: boolean }
  ): Promise<void>;

  export function downloadAsync(
    uri: string,
    fileUri: string,
    options?: {
      headers?: Record<string, string>;
      md5?: boolean;
    }
  ): Promise<{
    uri: string;
    status?: number;
    headers?: Record<string, string>;
    md5?: string;
  }>;
}
