// ===================================================
// 📦 videoHelpers.ts — Tipos + Utils pequeños
// ===================================================

export type VideoQuality = "auto" | "360p" | "480p" | "720p" | "1080p";

export function isVideo(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.endsWith(".mp4") || url.includes("video");
}

export function safeUrl(url: string) {
  if (!url) return "";
  return url.replace(/ /g, "%20");
}
