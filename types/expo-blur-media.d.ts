import * as React from "react";

declare module "expo-blur" {
  export const BlurView: React.ComponentType<{
    intensity?: number;
    tint?: "dark" | "light" | "default";
    style?: any;
  }>;
}

declare module "expo-media-library" {
  export function requestPermissionsAsync(): Promise<{
    status: "granted" | "denied" | "undetermined";
    canAskAgain?: boolean;
    granted?: boolean;
  }>;
  export function saveToLibraryAsync(uri: string): Promise<any>;
}
