// ======================================================
// 📡 feedEvents.ts — bus de eventos para sincronizar Feed
// ------------------------------------------------------
// - Permite que PostDetailView avise al Feed cuando cambian:
//     • commentsCount
//     • likes
//     • videoViews
// - También emite eventos cuando cambia el perfil de usuario
//   (avatar / username / nombre) para parchear el feed en caliente,
//   tanto por subscribeToFeedUpdates como por subscribeToUserProfileUpdates.
// ======================================================

// ======================================================
// 👤 Eventos de actualización de perfil de usuario
// ======================================================

export type UserProfileUpdatePayload = {
  userId: string;
  username?: string;
  // opcionales, por si quieres actualizar nombre completo
  firstName?: string;
  lastName?: string;
  // name genérico (por si tu modelo lo usa así)
  name?: string;
  avatarUrl?: string;
  safeAvatar?: string;
  [key: string]: any;
};

// ======================================================
// 📰 Eventos de actualización del feed (posts)
// ======================================================

export type FeedUpdateEvent =
  | {
      type: "commentsCount";
      postId: string;
      value?: number; // si viene, se fija directamente
      delta?: number; // sino, se suma al valor actual (default +1)
    }
  | {
      type: "likes";
      postId: string;
      liked: boolean;
      likesCount: number;
    }
  | {
      // 👁‍🗨 views de video (para feed y detalle)
      type: "videoViews";
      postId: string;
      viewsCount: number;
    }
  // Evento de perfil de usuario también entra por el bus general
  | ({ type: "userProfile" } & UserProfileUpdatePayload)
  // Fallback súper genérico para no romper nada si en algún sitio
  // emites un tipo custom no declarado aquí
  | {
      type: string;
      postId?: string;
      [key: string]: any;
    };

type Listener = (update: FeedUpdateEvent) => void;

const listeners = new Set<Listener>();

export const subscribeToFeedUpdates = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const emitFeedUpdate = (update: FeedUpdateEvent) => {
  listeners.forEach((l) => {
    try {
      l(update);
    } catch (e) {
      console.log("[feedEvents] listener error:", e);
    }
  });
};

// ======================================================
// 👤 Bus específico para perfil de usuario (compat legacy)
// ======================================================

type UserProfileListener = (payload: UserProfileUpdatePayload) => void;

let userProfileListeners: UserProfileListener[] = [];

/**
 * Suscribirse a cambios de perfil de usuario.
 * Útil para que FeedScreen, comentarios, etc. parchen avatar/username en caliente.
 */
export const subscribeToUserProfileUpdates = (cb: UserProfileListener) => {
  userProfileListeners.push(cb);
  return () => {
    userProfileListeners = userProfileListeners.filter((l) => l !== cb);
  };
};

/**
 * Emitir que un perfil de usuario ha sido actualizado.
 * Llama a todos los listeners registrados (Feed, listas, etc),
 * y además reenvía el evento al bus general del feed.
 */
export const emitUserProfileUpdated = (
  payload: UserProfileUpdatePayload
) => {
  if (!payload?.userId) return;

  // 1) Bus específico de perfil (compatibilidad con código existente)
  userProfileListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (e) {
      console.log("[feedEvents] userProfile listener error:", e);
    }
  });

  // 2) Bus general del feed (para FeedScreen, etc.)
  const feedPayload: FeedUpdateEvent = {
    type: "userProfile",
    ...payload,
  };
  emitFeedUpdate(feedPayload);
};

// ✅ Alias para no romper nada si en algún sitio usas emitUserProfileUpdate
export const emitUserProfileUpdate = (payload: UserProfileUpdatePayload) =>
  emitUserProfileUpdated(payload);
