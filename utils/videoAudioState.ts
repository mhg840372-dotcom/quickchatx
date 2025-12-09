// utils/videoAudioState.ts
// =======================================================
// 🔊 Estado global de audio de video (estilo Twitter)
// -------------------------------------------------------
// - Si desmuteas un video, todos los demás se desmutean.
// - Si muteas, todos vuelven a estar en silencio.
// - No depende de React, solo de memoria del bundle.
// =======================================================

let globalMuted = true;

type Listener = (muted: boolean) => void;
const listeners = new Set<Listener>();

export function getGlobalMuted(): boolean {
  return globalMuted;
}

export function setGlobalMuted(next: boolean) {
  globalMuted = next;
  listeners.forEach((fn) => {
    try {
      fn(globalMuted);
    } catch (e) {
      console.log("[videoAudioState] listener error:", e);
    }
  });
}

export function subscribeToGlobalMuted(listener: Listener): () => void {
  listeners.add(listener);
  // opcional: sincronizar inmediatamente al suscriptor
  try {
    listener(globalMuted);
  } catch {}

  return () => {
    listeners.delete(listener);
  };
}
