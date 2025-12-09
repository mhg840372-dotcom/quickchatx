// ======================================================
// 🎬 VideoPlayer Bridge → Usa SOLO QuickPlayVideo
// ------------------------------------------------------
// Mantiene compatibilidad con código viejo que importa
// `components/VideoPlayer`, pero internamente usa
// QuickPlayVideo (el único reproductor real).
// ✅ Acepta TODOS los props de QuickPlayVideo
// ======================================================

import type React from "react";
import QuickPlayVideo from "../QuickPlayVideo";

export type VideoPlayerProps = React.ComponentProps<typeof QuickPlayVideo>;

export default function VideoPlayer(props: VideoPlayerProps) {
  return <QuickPlayVideo {...props} />;
}
