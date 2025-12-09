// utils/videoTrimEvents.ts
// =======================================================
// 🚌 Mini event-bus para comunicar /post/video-trim
// con CreatePostScreen sin usar navegación complicada.
// =======================================================

export type VideoTrimPayload = {
  originalUri: string;
  trimmedUri: string;
  durationSec?: number;
  sizeMb?: number;
};

type Listener = (payload: VideoTrimPayload) => void;

const listeners = new Set<Listener>();

export function emitVideoTrimDone(payload: VideoTrimPayload) {
  if (!listeners.size) {
    console.log(
      "[videoTrimEvents] emitVideoTrimDone sin listeners registrados"
    );
  }

  for (const cb of listeners) {
    try {
      cb(payload);
    } catch (e) {
      console.log("[videoTrimEvents] listener error:", e);
    }
  }
}

export function subscribeToVideoTrimDone(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
