// ==================================================================
// 🎚 videoQualitySelector.ts — Selector manual estilo YouTube
// ==================================================================

export const AVAILABLE_QUALITIES = [
  "auto",
  "360p",
  "480p",
  "720p",
  "1080p",
];

export function buildQualityUrl(urlBase: string, quality: string) {
  if (quality === "auto") return urlBase;

  if (!urlBase.endsWith(".mp4")) {
    console.log("⚠ buildQualityUrl: URL inválida:", urlBase);
    return urlBase;
  }

  return urlBase.replace(".mp4", `_${quality}.mp4`);
}

export function nextQuality(current: string): string {
  const i = AVAILABLE_QUALITIES.indexOf(current);
  return AVAILABLE_QUALITIES[(i + 1) % AVAILABLE_QUALITIES.length];
}
