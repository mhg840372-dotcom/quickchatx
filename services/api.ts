// ======================================================
// 🌐 api.ts — QuickChatX v15.2 STABLE PRO + VIEWS + REPOST (2025)
// ------------------------------------------------------
// ✅ Si no hay DOMINIO, se deriva de URL quitando /api
// ✅ createPost: multipart FormData compatible con React Native
// ✅ updateUserProfile: multipart limpio (sin tocar defaults globales)
// ✅ resolveImage usa siempre DOMINIO / BASE_URL
// ✅ registerPostView: contador de visualizaciones de post/video
// ✅ repostPost: multi-endpoint (/posts/:id/repost, /posts/repost, /interactions/repost, /repost)
// ✅ getPostById: multi-endpoint para mayor compat (/posts/:id, /post/:id, /posts/by-id/:id)
// ======================================================

import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, ToastAndroid, Alert, AppState } from "react-native";

// ======================================================
// 🌐 CONFIG BASE (URL + DOMINIO)
// ======================================================

const RAW_API_URL =
  process.env.EXPO_PUBLIC_URL || "https://api.quickchatx.com/api";

// Normaliza y garantiza sufijo /api para evitar 404 por ruta base incorrecta
const normalizeApiUrl = (url: string) => {
  const trimmed = url.replace(/\/+$/, "");
  if (/\/api$/i.test(trimmed)) return trimmed;
  return `${trimmed}/api`;
};

export const API_URL = normalizeApiUrl(RAW_API_URL);

// dominio opcional explícito
const RAW_DOMAIN =
  process.env.EXPO_PUBLIC_DOMINIO ||
  process.env.EXPO_PUBLIC_DOMAIN ||
  "";

// si no hay dominio explícito, lo derivamos de API_URL quitando /api
const BASE_URL = (
  RAW_DOMAIN && RAW_DOMAIN.trim().length > 0
    ? RAW_DOMAIN
    : API_URL.replace(/\/api$/i, "")
).replace(/\/+$/, "");

export const TOKEN_KEY = "qcxtoken";
export const USER_KEY = "qcxuser";
export const REFRESH_TOKEN_KEY = "qcxrefresh";

// ======================================================
// 🖼️ Resolve URLs relativas → absolutas
// ======================================================
const resolveImage = (url?: string | null): string | null => {
  if (!url) return null;

  let cleaned = String(url).trim();

  // Ya es absoluta
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return cleaned;
  }

  // Protocol-relative //cdn...
  if (cleaned.startsWith("//")) {
    return `https:${cleaned}`;
  }

  // /uploads servido desde el mismo dominio
  if (cleaned.startsWith("/uploads")) {
    // ej: /uploads/user/file.jpg
    return `${BASE_URL}${cleaned}`;
  }

  // uploads/... sin slash inicial
  if (cleaned.startsWith("uploads/")) {
    // ej: uploads/user/file.jpg
    return `${BASE_URL}/${cleaned}`;
  }

  // Cualquier path absoluto genérico: /algo/imagen.jpg
  if (cleaned.startsWith("/")) {
    return `${BASE_URL}${cleaned}`;
  }

  // Cualquier path relativo -> lo colgamos de /uploads evitando duplicar
  // ej: "user/file.jpg" -> https://api.quickchatx.com/uploads/user/file.jpg
  return `${BASE_URL}/uploads/${cleaned.replace(/^\/+/, "")}`;
};

// ======================================================
// 🔔 Toast cross-platform
// ======================================================
const notify = (msg: string) => {
  // Evitar Alert/Toast cuando no hay Activity adjunta
  const isActive = AppState.currentState === "active";
  if (!isActive) {
    console.log("ℹ️ (deferred alert)", msg);
    return;
  }
  if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert("QuickChatX", msg);
};

// ======================================================
// ⚙️ AXIOS INSTANCE
// ======================================================
export const api = axios.create({
  baseURL: API_URL, // ej: http://IP:4700/api
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// ======================================================
// 🔒 GLOBAL LOGOUT HANDLER
// ======================================================
let globalLogout: null | (() => void) = null;
export const setGlobalLogoutHandler = (fn: () => void) => {
  globalLogout = fn;
};

// ======================================================
// 🧩 REQUEST INTERCEPTOR
// ======================================================
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (
    token &&
    !config.url?.includes("/login") &&
    !config.url?.includes("/register")
  ) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// Helper: detectar si un string parece ObjectId (hex de 24)
const isLikelyObjectId = (val?: string | null) =>
  typeof val === "string" && /^[a-fA-F0-9]{24}$/.test(val);

// ======================================================
// 🔁 REFRESH TOKEN (seguro + fallback)
// ======================================================
let refreshing = false;
let queue: any[] = [];
let legacyRefresh = false;

const processQueue = (err: any, token: string | null) => {
  queue.forEach((p) => (err ? p.reject(err) : p.resolve(token)));
  queue = [];
};

const refreshToken = async (): Promise<string> => {
  const endpoint = legacyRefresh ? "/login/refresh" : "/auth/refresh";

  try {
    const storedRefresh = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);

    if (!storedRefresh && !legacyRefresh) {
      throw new Error("No hay refreshToken disponible");
    }

    const body = legacyRefresh ? undefined : { refreshToken: storedRefresh };

    const res = await api.post(endpoint, body);
    const { token, user, refreshToken: newRefreshToken } = res.data;

    if (!token) throw new Error("Token nuevo no recibido");

    const kv: [string, string][] = [
      [TOKEN_KEY, token],
      [USER_KEY, JSON.stringify(user)],
    ];
    if (newRefreshToken) {
      kv.push([REFRESH_TOKEN_KEY, newRefreshToken]);
    }

    await AsyncStorage.multiSet(kv);

    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    return token;
  } catch (err: any) {
    if (!legacyRefresh && err?.response?.status === 404) {
      legacyRefresh = true;
      return refreshToken();
    }
    throw err;
  }
};

// ======================================================
// 🧱 RESPONSE INTERCEPTOR
// ======================================================
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status;
    const original = error.config || {};
    const url: string = original.url || "";

    if (url.includes("/auth/refresh") || url.includes("/login/refresh")) {
      return Promise.reject(error);
    }

    if (url.includes("login") || url.includes("register")) {
      return Promise.reject(error);
    }

    if (
      error.code === "ECONNABORTED" ||
      error.message?.includes("Network") ||
      error.message?.includes("timeout")
    ) {
      notify("Error de red o conexión.");
      return Promise.reject(error);
    }

    if (status === 404 || status === 502) return Promise.reject(error);

    if (status === 401 && !original._retry) {
      const hasAuthHeader = Boolean(
        original.headers?.Authorization ||
          original.headers?.authorization ||
          (api.defaults as any)?.headers?.common?.Authorization
      );

      if (!hasAuthHeader) {
        return Promise.reject(error);
      }

      const storedRefresh = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      const canRefresh = Boolean(storedRefresh || legacyRefresh);

      if (!canRefresh) {
        await clearSession();
        globalLogout?.();
        notify("⚠️ Sesión expirada. Inicia sesión nuevamente.");
        return Promise.reject(error);
      }

      if (refreshing) {
        return new Promise((resolve, reject) =>
          queue.push({ resolve, reject })
        )
          .then((token) => {
            if (token) {
              original.headers = original.headers || {};
              original.headers.Authorization = `Bearer ${token}`;
            }
            return api(original);
          })
          .catch(Promise.reject);
      }

      refreshing = true;
      (original as any)._retry = true;

      try {
        const newToken = await refreshToken();
        processQueue(null, newToken);
        if (newToken) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(original);
      } catch (err) {
        processQueue(err, null);
        await clearSession();
        globalLogout?.();
        notify("⚠️ Sesión expirada. Inicia sesión nuevamente.");
        throw err;
      } finally {
        refreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ======================================================
// 🧹 CLEAR SESSION
// ======================================================
export const clearSession = async () => {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, REFRESH_TOKEN_KEY]);
  delete api.defaults.headers.common["Authorization"];
};

// ======================================================
// 🔑 SET TOKEN
// ======================================================
export const setAuthToken = (token: string | null) => {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
};

// ======================================================
// 🔓 LOGIN (prioriza /users/login con perfil completo)
// ======================================================
export const loginUser = async (identifier: string, password: string) => {
  const tryEndpoints = ["/users/login", "/auth/login", "/login"];
  const payloads = [
    { identifier, password },
    { email: identifier, password },
    { username: identifier, password },
    { login: identifier, password },
  ];

  let lastAuthMessage: string | null = null;

  const mapAuthMessage = (msg: string | null, status?: number) => {
    const normalized = (msg || "").toLowerCase();

    if (normalized.includes("user") || normalized.includes("usuario")) {
      return "Usuario incorrecto o no encontrado.";
    }
    if (normalized.includes("pass") || normalized.includes("contrase")) {
      return "Contraseña incorrecta.";
    }
    if (normalized.includes("token")) {
      return "Usuario o contraseña incorrectos.";
    }
    if (status === 400 || status === 401 || status === 403) {
      return "Usuario o contraseña incorrectos.";
    }
    return msg;
  };

  for (const endpoint of tryEndpoints) {
    for (const payload of payloads) {
      try {
        const res = await api.post(endpoint, payload);
        const { token, user, refreshToken: rToken } = res.data;

        const kv: [string, string][] = [
          [TOKEN_KEY, token],
          [USER_KEY, JSON.stringify(user)],
        ];
        if (rToken) kv.push([REFRESH_TOKEN_KEY, rToken]);

        await AsyncStorage.multiSet(kv);
        setAuthToken(token);
        return { token, user };
      } catch (err: any) {
        const status = err?.response?.status;
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message;
        const friendly = mapAuthMessage(msg, status);

        // 400/401/403 → credenciales inválidas, seguimos intentando payload/endpoints alternos
        if (status === 400 || status === 401 || status === 403) {
          lastAuthMessage = friendly || lastAuthMessage;
          continue;
        }

        // 404 → endpoint no disponible, probamos el siguiente
        if (status === 404) continue;

        // Errores de red u otros status: propagamos
        throw err;
      }
    }
  }

  throw new Error(
    lastAuthMessage ||
      "Usuario o contraseña incorrectos. Verifica e inténtalo de nuevo."
  );
};

// ======================================================
// 🆕 REGISTER (prioriza /users/register con perfil completo)
// ======================================================
export const registerUser = async (
  firstName: string,
  lastName: string,
  username: string,
  email: string,
  password: string,
  confirmPassword: string,
  birthDate?: string
) => {
  const payload = {
    firstName,
    lastName,
    username,
    email,
    password,
    confirmPassword,
    acceptedTerms: true,
    birthDate,
    birthdate: birthDate,
  };

  const endpoints = ["/users/register", "/auth/register"];
  let res: any = null;
  let lastErr: any = null;

  for (const endpoint of endpoints) {
    try {
      res = await api.post(endpoint, payload);
      if (res?.data) break;
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;
      if (status === 404 || status === 405) continue;
      if (status === 400) continue;
      throw err;
    }
  }

  if (!res) throw lastErr || new Error("No se pudo registrar");

  const { token, user, refreshToken: rToken } = res.data;

  const kv: [string, string][] = [
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
  ];
  if (rToken) kv.push([REFRESH_TOKEN_KEY, rToken]);

  await AsyncStorage.multiSet(kv);
  setAuthToken(token);
  return { token, user };
};

// ======================================================
// 🔎 USERNAME CHECK (multi-endpoint + normalizador)
// ======================================================
type UsernameCheckResult = {
  available: boolean;
  suggestions: string[];
  fromApi?: boolean;
};

type EmailCheckResult = {
  available: boolean;
};

const parseUsernameCheck = (payload: any): UsernameCheckResult | null => {
  if (!payload) return null;

  const available =
    typeof payload.available === "boolean"
      ? payload.available
      : typeof payload.isAvailable === "boolean"
      ? payload.isAvailable
      : typeof payload.valid === "boolean"
      ? payload.valid
      : null;

  if (available === null) return null;

  const rawSuggestions =
    payload.suggestions ||
    payload.suggested ||
    payload.alternatives ||
    payload.data?.suggestions ||
    [];

  const suggestions = Array.isArray(rawSuggestions)
    ? rawSuggestions
    : [rawSuggestions].filter(Boolean);

  return { available, suggestions, fromApi: true };
};

export const checkUsername = async (
  username: string,
  firstName?: string,
  lastName?: string
): Promise<UsernameCheckResult> => {
  const clean = (username || "").trim().toLowerCase();
  if (!clean) throw new Error("Username inválido");

  const payload = { username: clean, firstName, lastName };

  const fallbackSuggestions = [
    `${clean}1`,
    `${clean}_${Math.floor(Math.random() * 90 + 10)}`,
    `${clean}.${Math.floor(Math.random() * 900 + 100)}`,
  ];

  const endpoints: { url: string; method: "post" | "get" }[] = [
    { url: "/auth/check-username", method: "post" },
    { url: "/users/check-username", method: "post" },
    { url: "/check-username", method: "post" },
    { url: "/users/validate-username", method: "get" },
  ];

  for (const endpoint of endpoints) {
    try {
      const res =
        endpoint.method === "get"
          ? await api.get(endpoint.url, { params: payload })
          : await api.post(endpoint.url, payload);

      const parsed = parseUsernameCheck(res.data?.data ?? res.data);
      if (parsed) return parsed;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429 || status === 503) continue;
      if (status === 401 || status === 403) continue;
      if (status === 404 || status === 405) continue;
      if (status === 400) continue;
      throw err;
    }
  }

  return { available: false, suggestions: fallbackSuggestions, fromApi: false };
};

export const apiCheckUsername = checkUsername;

// ======================================================
// 📧 EMAIL CHECK
// ======================================================
export const checkEmail = async (email: string): Promise<EmailCheckResult> => {
  const clean = (email || "").trim().toLowerCase();
  if (!clean) throw new Error("Email inválido");

  const endpoints = [
    { url: "/auth/check-email", method: "get" as const },
    { url: "/auth/check-email", method: "post" as const },
    { url: "/check-email", method: "post" as const },
  ];

  for (const endpoint of endpoints) {
    try {
      const res =
        endpoint.method === "get"
          ? await api.get(endpoint.url, { params: { email: clean } })
          : await api.post(endpoint.url, { email: clean });

      const payload = res.data?.data ?? res.data;
      const available =
        payload?.available ??
        (typeof payload?.exists === "boolean" ? !payload.exists : undefined);

      if (typeof available === "boolean") return { available };
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404 || status === 405) continue;
      continue;
    }
  }

  return { available: false };
};

// ======================================================
// 🧍‍♂️ UPDATE PROFILE (avatarData / backgroundData)
// ======================================================
let legacyProfileUpdate = false;

export const updateUserProfile = async (
  data: {
    firstName?: string;
    lastName?: string;
    username: string;
    bio?: string;
  },
  avatarFile?: { uri: string; name: string; type: string },
  backgroundFile?: { uri: string; name: string; type: string }
) => {
  const form = new FormData();

  // 🔤 Campos de texto (match con backend)
  form.append("firstName", data.firstName ?? "");
  form.append("lastName", data.lastName ?? "");
  form.append("username", data.username);
  form.append("bio", data.bio ?? "");

  // 📦 Normalizador seguro para React Native
  const normalizeFile = (
    file?: { uri: string; name: string; type: string }
  ) => {
    if (!file || !file.uri) return null;

    const rawUri = String(file.uri);
    const safeUri =
      rawUri.startsWith("file://") || rawUri.startsWith("content://")
        ? rawUri
        : `file://${rawUri}`;

    const name = file.name || "file.jpg";
    const type = file.type || "image/jpeg";

    return { uri: safeUri, name, type };
  };

  const avatarNorm = normalizeFile(avatarFile);
  const bgNorm = normalizeFile(backgroundFile);

  // ⬅️ IMPORTANTE: nombres de campo esperados por tu backend
  if (avatarNorm) {
    form.append("avatarData", avatarNorm as any);
  }

  if (bgNorm) {
    form.append("backgroundData", bgNorm as any);
  }

  const primary = "/profile/update";
  const fallback = "/posts/user/update";

  try {
    const endpoint = legacyProfileUpdate ? fallback : primary;

    const res = await api.put(endpoint, form, {
      headers: { "Content-Type": "multipart/form-data" },
      transformRequest: (data) => data, // no tocamos defaults globales
    });

    const rawUser = res.data?.user || res.data?.data?.user || res.data;
    const user = {
      ...rawUser,
      avatarUrl: resolveImage(rawUser?.avatarUrl),
      backgroundUrl: resolveImage(rawUser?.backgroundUrl),
    };

    return { ...res.data, user };
  } catch (err: any) {
    const status = err?.response?.status;

    // Fallback legacy si /profile/update no existe o no soporta multipart
    if (!legacyProfileUpdate && (status === 404 || status === 415)) {
      legacyProfileUpdate = true;

      const res = await api.put(fallback, form, {
        headers: { "Content-Type": "multipart/form-data" },
        transformRequest: (data) => data,
      });

      const rawUser = res.data?.user || res.data?.data?.user || res.data;
      const user = {
        ...rawUser,
        avatarUrl: resolveImage(rawUser?.avatarUrl),
        backgroundUrl: resolveImage(rawUser?.backgroundUrl),
      };

      return { ...res.data, user };
    }

    throw err;
  }
};

// ======================================================
// 👤 GET PROFILE — v3 (siempre devuelve { data: { user, data:{posts} } })
// ======================================================
let legacyProfile = false;
export const getUserProfile = async (id?: string) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error("Sesión inválida");

  const storedUserStr = await AsyncStorage.getItem(USER_KEY);
  const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
  const storedId = storedUser?._id || storedUser?.id;

  const mine =
    !id ||
    id === "me" ||
    id === "self" ||
    (storedId && String(id) === String(storedId));

  const normalizeUser = (user: any = {}) => ({
    ...user,
    avatarUrl: resolveImage(user?.avatarUrl || user?.avatar),
    backgroundUrl: resolveImage(
      user?.backgroundUrl ||
        user?.background ||
        user?.cover ||
        user?.coverUrl
    ),
  });

  const wrap = (payload: any) => ({ data: payload });

  const extractPosts = (raw: any) =>
    raw?.data?.posts ||
    raw?.posts ||
    raw?.data ||
    (Array.isArray(raw) ? raw : []) ||
    [];

  const buildPayload = (rawUser: any, posts: any[]) => {
    const baseUser = normalizeUser({
      ...(storedUser || {}),
      ...(rawUser || {}),
    });
    const postsCount =
      typeof baseUser.postsCount === "number"
        ? baseUser.postsCount
        : Array.isArray(posts)
        ? posts.length
        : 0;

    return wrap({
      user: { ...baseUser, postsCount },
      data: { posts: Array.isArray(posts) ? posts : [] },
    });
  };

  const normalizePrimary = (raw: any) => {
    // Acepta formatos: { data: { user, posts } }, { user, posts }, { posts }, array
    const postsRaw =
      raw?.data?.posts ||
      raw?.posts ||
      (Array.isArray(raw?.data) ? raw.data : []) ||
      extractPosts(raw);

    let userRaw =
      raw?.data?.user ||
      raw?.user ||
      (!Array.isArray(raw) && !Array.isArray(raw?.data) ? raw : null) ||
      null;

    // Fallback: si no hay user o es un array, usa el almacenado
    if (!userRaw || Array.isArray(userRaw)) {
      userRaw = storedUser || {};
    }

    return buildPayload(userRaw, postsRaw);
  };

  const isOid = isLikelyObjectId(id || "");

  // 1) Nueva API /users/*
  try {
    if (!legacyProfile) {
      const primary = mine
        ? "/users/me"
        : isOid
        ? `/users/${id}`
        : `/users/${id}`;

      // Si no hay id y no es mine, esto fallará y caerá a fallback
      if (mine || isOid) {
        const res = await api.get(primary);
        let payload = normalizePrimary(res.data);

        const userId =
          payload?.data?.user?._id ||
          payload?.data?.user?.id ||
          storedId ||
          id;

        if (
          (!payload?.data?.posts || payload.data.posts.length === 0) &&
          userId
        ) {
          try {
            const fallbackPosts = await api.get(
              mine ? "/posts/user/me" : `/posts/user/${userId}`
            );
            const postsArr = extractPosts(fallbackPosts.data);
            payload = buildPayload(payload.data.user, postsArr);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (err) {
            // ignoramos y devolvemos el payload original
          }
        }

        return payload;
      }
    }
  } catch (err: any) {
    const status = err.response?.status;
    if (status === 404 || status === 400 || status === 405 || status === 500) {
      legacyProfile = true;
    } else if (!mine && status === 400) {
      const resMe = await api.get("/users/me");
      return normalizePrimary(resMe.data);
    } else {
      throw err;
    }
  }

  // 2) Fallbacks múltiples para perfil (por id o por username)
  const fallbackEndpoints: { url: string; params?: Record<string, any> }[] = [
    ...(isOid
      ? [
          { url: mine ? "/posts/user/me" : `/posts/user/${id}` },
          { url: mine ? "/users/profile/me" : `/users/profile/${id}` },
          { url: mine ? "/profile/me" : `/profile/${id}` },
        ]
      : []),
    { url: `/users/by-username/${id}` },
    { url: `/users/username/${id}` },
    { url: `/profile/username/${id}` },
    { url: `/users/search`, params: { username: id } },
    { url: `/users`, params: { username: id } },
  ];

  for (const ep of fallbackEndpoints) {
    try {
      const res = await api.get(
        ep.url,
        ep.params ? { params: ep.params } : undefined
      );
      const raw = res.data;

      const posts = extractPosts(raw);

      if (raw?.user) {
        return buildPayload(raw.user, posts);
      }

      if (raw && (raw._id || raw.id || raw.username)) {
        const postsFromRaw = raw.posts || posts;
        return buildPayload(raw, postsFromRaw || []);
      }

      if (Array.isArray(raw)) {
        return buildPayload(storedUser || {}, raw);
      }

      return buildPayload(storedUser || {}, []);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 400 || status === 404 || status === 405 || status === 500)
        continue;
      throw err;
    }
  }

  if (mine && storedUser) {
    console.log("⚠️ getUserProfile fallback local: usando usuario de AsyncStorage");
    return buildPayload(storedUser, []);
  }

  const safeId = id ? String(id) : "usuario";
  return wrap({
    user: normalizeUser({
      id: safeId,
      _id: safeId,
      username: safeId,
      postsCount: 0,
    }),
    data: { posts: [] },
  });
};

// ======================================================
// 📌 GET POST BY ID — helper para detalle / repost (multi-endpoint)
// ======================================================
export const getPostById = async (postId: string) => {
  if (!postId) throw new Error("postId requerido");

  const endpoints = [
    `/posts/${postId}`,
    `/post/${postId}`,
    `/posts/by-id/${postId}`,
  ];

  let lastErr: any = null;

  for (const url of endpoints) {
    try {
      const res = await api.get(url);
      let post = res.data?.data ?? res.data ?? null;

      if (post && !post.id && post._id) {
        post = { ...post, id: String(post._id) };
      }

      // Normalizamos media → url absoluta como en otros sitios
      if (post?.media && Array.isArray(post.media)) {
        post.media = post.media.map((m: any) => ({
          ...m,
          url: resolveImage(m.url || m.path),
        }));
      }

      return post;
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;
      if (status === 404 || status === 405) {
        continue; // probamos siguiente endpoint
      }
      throw err;
    }
  }

  throw (
    lastErr ||
    new Error("No se pudo obtener el post: ruta no encontrada en el backend")
  );
};

// ======================================================
// 📝 CREATE POST — compatible con backend híbrido
// ======================================================
export type CreatePostMedia = {
  uri: string;
  type?: string;
  name?: string;
  durationSec?: number;
  sizeMb?: number;
  wasTrimmed?: boolean;
  isVideo?: boolean; // nuevo, opcional
};

export const createPost = async (
  content: string,
  media?: CreatePostMedia | CreatePostMedia[] | null
) => {
  const form = new FormData();

  const safeContent = (content ?? "").trim();
  if (!safeContent) {
    throw new Error("El contenido no puede estar vacío.");
  }
  form.append("content", safeContent);

  // Normalizamos a array
  const filesArrayRaw: CreatePostMedia[] = !media
    ? []
    : Array.isArray(media)
    ? media
    : [media];

  // 🧹 De-dupe por URI + name para evitar duplicados
  const seen = new Set<string>();
  const filesArray: CreatePostMedia[] = [];

  for (const file of filesArrayRaw) {
    if (!file?.uri) continue;
    const key = `${file.uri}::${file.name || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    filesArray.push(file);
  }

  filesArray.forEach((file, index) => {
    if (!file?.uri) return;

    const isVideo =
      file.isVideo ||
      file.type?.startsWith("video/") ||
      file.name?.toLowerCase().endsWith(".mp4") ||
      file.uri.toLowerCase().endsWith(".mp4");

    const safeName =
      file.name || `media_${index}.${isVideo ? "mp4" : "jpg"}`;

    const safeType =
      file.type || (isVideo ? "video/mp4" : "image/jpeg");

    const rawUri = String(file.uri);
    const safeUri =
      rawUri.startsWith("file://") || rawUri.startsWith("content://")
        ? rawUri
        : `file://${rawUri}`;

    const filePart = {
      uri: safeUri,
      type: safeType,
      name: safeName,
    } as any;

    // Tu backend híbrido espera "files" como array de archivos
    form.append("files", filePart);

    // Compat: algunos backends esperan el primer archivo en "file"
    if (filesArray.length === 1 && index === 0) {
      form.append("file", filePart);
    }

    // Metadata opcional (duración, tamaño, recorte)
    if (typeof file.durationSec === "number") {
      form.append("durationSec[]", String(file.durationSec));
    }
    if (typeof file.sizeMb === "number") {
      form.append("sizeMb[]", String(file.sizeMb));
    }
    if (typeof file.wasTrimmed === "boolean") {
      form.append("wasTrimmed[]", String(file.wasTrimmed));
    }
  });

  console.log("📤 Enviando nuevo post:", {
    content,
    files: filesArray.length,
  });

  const res = await api.post("/posts/create", form, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 880000, // subir a varios minutos para videos grandes
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    transformRequest: (data) => data,
  });

  const post = res.data?.data || res.data;
  if (post?.media)
    post.media = post.media.map((m: any) => ({
      ...m,
      url: resolveImage(m.url || m.path),
    }));

  return post;
};

// ======================================================
// 🔁 REPOST — crear referencia a otro post (multi-endpoint)
// ======================================================
export const repostPost = async (
  postId: string,
  note?: string,
  originalUrl?: string
) => {
  if (!postId) {
    throw new Error("postId requerido para repostear");
  }

  const basePayload: Record<string, any> = { postId };
  if (note) basePayload.note = note;
  if (originalUrl) basePayload.originalUrl = originalUrl;

  // Intentamos varias rutas “típicas” de backends de posts (y noticias)
  const endpoints: { url: string; method: "post"; body: any }[] = [
    // 🔹 Ruta principal que estás usando ahora
    { url: "/posts/repost", method: "post", body: basePayload },

    // 🔹 Variantes muy comunes
    { url: `/posts/${postId}/repost`, method: "post", body: { note, originalUrl } },
    { url: "/reposts", method: "post", body: basePayload },
    { url: "/repost", method: "post", body: basePayload },

    // 🔹 Rutas para noticias (por si el backend las separa)
    { url: "/news/repost", method: "post", body: basePayload },
    { url: `/news/${postId}/repost`, method: "post", body: { note, originalUrl } },
  ];

  let lastErr: any = null;

  for (const ep of endpoints) {
    try {
      const res = await api.post(ep.url, ep.body);
      const data = res.data?.data || res.data;

      // normalizamos media del repost, si viene embebida
      if (data?.media && Array.isArray(data.media)) {
        data.media = data.media.map((m: any) => ({
          ...m,
          url: resolveImage(m.url || m.path),
        }));
      }

      return data;
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;

      // 404 / 405 → probamos la siguiente ruta
      if (status === 404 || status === 405) {
        continue;
      }

      // Otros errores (401, 500, etc.) → se propagan
      throw err;
    }
  }

  // Si llegamos aquí, ninguna ruta respondió bien
  if (lastErr?.response?.status === 404 || lastErr?.response?.status === 405) {
    throw new Error(
      "El servidor no tiene configurado el endpoint para repostear publicaciones."
    );
  }

  throw lastErr || new Error("No se pudo crear el repost.");
};

// ======================================================
// 📰 FEED — posts-only (compatibilidad legacy)
// ======================================================
export const getPostsFeed = async (page = 1, limit = 20) => {
  const res = await api.get("/posts/feed", { params: { page, limit } });
  const data = res.data?.data || [];

  const normalized = data.map((post: any) => ({
    ...post,
    media: Array.isArray(post.media)
      ? post.media.map((m: any) => ({
          ...m,
          url: resolveImage(m.url || m.path),
        }))
      : [],
  }));

  return { ...res.data, data: normalized };
};

// ======================================================
// 📰 NEWS ONLY — /api/news/latest (para NewsList)
// ======================================================
export const getNews = async (limit = 50) => {
  const res = await api.get("/news/latest", {
    params: { count: limit },
  });

  const payload = res.data || {};
  const raw =
    Array.isArray(payload) ? payload : payload.data || payload.items || [];

  const items = Array.isArray(raw) ? raw : [];

  const normalized = items.map((item: any) => {
    const sourceName =
      typeof item.source === "string"
        ? item.source
        : item.source?.name || "QuickChat News";

    return {
      ...item,
      image: resolveImage(item.image),
      source: { name: sourceName },
    };
  });

  return normalized;
};

// ======================================================
// 📰 FEED UNIFICADO (posts + news)
// ======================================================
export const getUnifiedFeed = async (_limit?: number) => {
  const res = await api.get("/feed");
  const payload = res.data || {};
  const items = payload.data || [];

  const normalized = (Array.isArray(items) ? items : []).map(
    (item: any, index: number) => {
      const isPost = item.type === "post" || (!item.type && item.media);

      if (isPost) {
        const post = {
          ...item,
          type: "post",
          media: Array.isArray(item.media)
            ? item.media.map((m: any) => ({
                ...m,
                url: resolveImage(m.url || m.path),
              }))
            : [],
        };

        const rawDate =
          post.publishedAt ||
          post.createdAt ||
          post.timestamp ||
          post.date ||
          post.updatedAt ||
          null;

        const sortTime = rawDate ? new Date(rawDate).getTime() : 0;

        return {
          ...post,
          _sortTime: Number.isFinite(sortTime) ? sortTime : 0,
          __baseId: String(
            post._id || post.id || post.postId || `post-${index}`
          ),
        };
      }

      const news = {
        ...item,
        type: item.type || "news",
        image: resolveImage(item.image),
      };

      const rawDate =
        news.publishedAt ||
        news.createdAt ||
        news.timestamp ||
        news.date ||
        news.updatedAt ||
        null;

      const sortTime = rawDate ? new Date(rawDate).getTime() : 0;

      return {
        ...news,
        _sortTime: Number.isFinite(sortTime) ? sortTime : 0,
        __baseId: String(
          news.newsId || news._id || news.id || `news-${index}`
        ),
      };
    }
  );

  return { ...payload, data: normalized };
};

// ======================================================
// 🔁 FEED UNIFICADO — refresh
// ======================================================
export const refreshUnifiedFeed = async (since: string, limit = 20) => {
  const res = await api.get("/feed/refresh", {
    params: { since, limit },
  });

  const payload = res.data || {};
  const items = payload.data || [];

  const normalized = (Array.isArray(items) ? items : []).map(
    (item: any, index: number) => {
      const isPost = item.type === "post" || (!item.type && item.media);

      if (isPost) {
        const post = {
          ...item,
          type: "post",
          media: Array.isArray(item.media)
            ? item.media.map((m: any) => ({
                ...m,
                url: resolveImage(m.url || m.path),
              }))
            : [],
        };

        const rawDate =
          post.publishedAt ||
          post.createdAt ||
          post.timestamp ||
          post.date ||
          post.updatedAt ||
          null;

        const sortTime = rawDate ? new Date(rawDate).getTime() : 0;

        return {
          ...post,
          _sortTime: Number.isFinite(sortTime) ? sortTime : 0,
          __baseId: String(
            post._id || post.id || post.postId || `post-ref-${index}`
          ),
        };
      }

      const news = {
        ...item,
        type: item.type || "news",
        image: resolveImage(item.image),
      };

      const rawDate =
        news.publishedAt ||
        news.createdAt ||
        news.timestamp ||
        news.date ||
        news.updatedAt ||
        null;

      const sortTime = rawDate ? new Date(rawDate).getTime() : 0;

      return {
        ...news,
        _sortTime: Number.isFinite(sortTime) ? sortTime : 0,
        __baseId: String(
          news.newsId || news._id || news.id || `news-ref-${index}`
        ),
      };
    }
  );

  return { ...payload, data: normalized };
};

// ======================================================
// 🎯 FEED PERSONALIZADO
// ======================================================
export const getPersonalizedFeed = async (limit = 20) => {
  const res = await api.get("/feed/personalized", { params: { limit } });
  const payload = res.data || {};
  const items = payload.data || [];

  const normalized = (Array.isArray(items) ? items : []).map(
    (item: any, index: number) => {
      const post = {
        ...item,
        type: "post",
        media: Array.isArray(item.media)
          ? item.media.map((m: any) => ({
              ...m,
              url: resolveImage(m.url || m.path),
            }))
          : [],
      };

      const rawDate =
        post.publishedAt ||
        post.createdAt ||
        post.timestamp ||
        post.date ||
        post.updatedAt ||
        null;

      const sortTime = rawDate ? new Date(rawDate).getTime() : 0;

      return {
        ...post,
        _sortTime: Number.isFinite(sortTime) ? sortTime : 0,
        __baseId: String(post._id || post.id || `pers-post-${index}`),
      };
    }
  );

  return { ...payload, data: normalized };
};

// ======================================================
// 🗑️ POSTS — eliminar / restaurar
// ======================================================
export const deletePost = async (
  id: string,
  opts: { force?: boolean } = { force: true }
) => {
  const res = await api.delete(`/posts/${id}`, {
    params: opts?.force ? { force: true } : undefined,
  });
  return res.data;
};

export const restorePost = async (id: string) => {
  const res = await api.patch(`/posts/restore/${id}`);
  return res.data;
};

// ======================================================
// 👁 REGISTER POST VIEW (viewsCount++)
// ======================================================
export const registerPostView = async (postId: string) => {
  if (!postId) return null;

  try {
    const res = await api.post(`/posts/${postId}/view`);
    // Backend: { success: true, data: { id, viewsCount } }
    const payload = res.data?.data ?? res.data;
    return payload;
  } catch (err) {
    console.warn("[registerPostView] Error registrando view:", err);
    // No rompemos la UI por un fallo de analytics
    return null;
  }
};

// ======================================================
// 💬 COMMENTS
// ======================================================
export const getComments = async (
  id: string,
  targetType?: "post" | "news" | "youtube"
) => {
  const params: any = {};
  if (targetType) params.targetType = targetType;

  const res = await api.get(`/comments/${id}`, { params });
  const payload = res.data;
  return Array.isArray(payload) ? payload : payload?.data || [];
};

export const addComment = async (
  targetId: string,
  targetType: "post" | "news" | "youtube" = "post",
  content: string,
  parentId?: string | null
) => {
  const res = await api.post("/comments/add", {
    targetId,
    targetType,
    content: content.trim(),
    parentId: parentId || null,
  });
  const payload = res.data;
  return payload?.data ?? payload;
};

export const deleteComment = async (id: string) => {
  const res = await api.delete(`/comments/${id}`);
  return res.data;
};

export const toggleCommentLike = async (id: string) => {
  const res = await api.post(`/comments/like/${id}`);
  const payload = res.data;
  return payload?.data ?? payload;
};

// ======================================================
// 👥 FOLLOW SYSTEM
// ======================================================
export const getFollowState = async (userId: string) => {
  const isOid = isLikelyObjectId(userId);

  const endpoints: { method: "get" | "post"; url: string; body?: any }[] = [];

  if (!isOid) {
    endpoints.push(
      { method: "post", url: "/users/follow-state", body: { username: userId } },
      { method: "post", url: "/follow/state", body: { username: userId } },
      { method: "get", url: `/users/by-username/${userId}/follow-state` },
      { method: "get", url: `/users/username/${userId}/follow-state` }
    );
  }

  if (isOid) {
    endpoints.push(
      { method: "get", url: `/users/${userId}/follow-state` },
      { method: "get", url: `/users/follow-state/${userId}` },
      { method: "get", url: `/follow/state/${userId}` },
      { method: "post", url: "/users/follow-state", body: { userId } },
      { method: "post", url: "/follow/state", body: { userId } }
    );
  }

  let lastErr: any = null;

  for (const ep of endpoints) {
    try {
      const res =
        ep.method === "get"
          ? await api.get(ep.url)
          : await api.post(ep.url, ep.body);
      return res.data;
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;
      if (status === 400 || status === 404 || status === 405 || status === 500)
        continue;
      throw err;
    }
  }

  if (lastErr?.response?.status === 404) {
    return {};
  }

  throw lastErr || new Error("No se pudo obtener follow-state");
};

export const followUser = async (userId: string) => {
  const isOid = isLikelyObjectId(userId);
  const endpoints: { method: "post" | "put"; url: string; body?: any }[] = [];

  if (!isOid) {
    endpoints.push(
      { method: "post", url: "/users/follow", body: { username: userId } },
      { method: "post", url: "/follow", body: { username: userId } },
      {
        method: "post",
        url: "/follow/toggle",
        body: { username: userId, follow: true },
      },
      { method: "post", url: `/users/username/${userId}/follow` },
      { method: "post", url: `/users/by-username/${userId}/follow` }
    );
  }

  if (isOid) {
    endpoints.push(
      { method: "post", url: `/users/${userId}/follow` },
      { method: "post", url: `/follow/${userId}` },
      { method: "post", url: `/users/follow/${userId}` },
      { method: "put", url: `/users/${userId}/follow` },
      { method: "post", url: "/users/follow", body: { userId } },
      { method: "post", url: "/follow", body: { userId } },
      { method: "post", url: "/follow/toggle", body: { userId, follow: true } }
    );
  }

  let lastErr: any = null;
  for (const ep of endpoints) {
    try {
      const res =
        ep.method === "post"
          ? await api.post(ep.url, ep.body)
          : await api.put(ep.url, ep.body);
      return res.data;
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;
      if (status === 400 || status === 404 || status === 405 || status === 500)
        continue;
      throw err;
    }
  }
  if (lastErr?.response?.status === 400 || lastErr?.response?.status === 404) {
    return {};
  }
  throw lastErr || new Error("No se pudo seguir al usuario");
};

export const unfollowUser = async (userId: string) => {
  const isOid = isLikelyObjectId(userId);
  const endpoints: { method: "delete" | "post"; url: string; body?: any }[] =
    [];

  if (!isOid) {
    endpoints.push(
      { method: "post", url: "/users/unfollow", body: { username: userId } },
      { method: "post", url: "/unfollow", body: { username: userId } },
      {
        method: "post",
        url: "/follow/toggle",
        body: { username: userId, follow: false },
      },
      { method: "delete", url: `/users/username/${userId}/follow` }
    );
  }

  if (isOid) {
    endpoints.push(
      { method: "delete", url: `/users/${userId}/follow` },
      { method: "delete", url: `/users/follow/${userId}` },
      { method: "delete", url: `/follow/${userId}` },
      { method: "post", url: "/users/unfollow", body: { userId } },
      { method: "post", url: "/unfollow", body: { userId } },
      {
        method: "post",
        url: "/follow/toggle",
        body: { userId, follow: false },
      }
    );
  }

  let lastErr: any = null;
  for (const ep of endpoints) {
    try {
      const res =
        ep.method === "delete"
          ? await api.delete(ep.url)
          : await api.post(ep.url, ep.body);
      return res.data;
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;
      if (status === 400 || status === 404 || status === 405 || status === 500)
        continue;
      throw err;
    }
  }
  if (lastErr?.response?.status === 400 || lastErr?.response?.status === 404) {
    return {};
  }
  throw lastErr || new Error("No se pudo dejar de seguir al usuario");
};

// ======================================================
// 📊 ANALYTICS
// ======================================================
export type FeedExperimentSummaryVariant = {
  variant: string;
  exposures: number;
  impressions: number;
  uniqueUsers: number;
  ctr: number;
  likeRate: number;
  commentRate: number;
};

export type FeedExperimentSummaryResponse = {
  success: boolean;
  experimentKey: string;
  window: { from: string; to: string };
  variants: FeedExperimentSummaryVariant[];
};

export const getFeedExperimentSummary = async (params?: {
  from?: string;
  to?: string;
  variants?: string[];
}): Promise<FeedExperimentSummaryResponse> => {
  const query: any = {};
  if (params?.from) query.from = params.from;
  if (params?.to) query.to = params.to;
  if (params?.variants?.length)
    query.variants = params.variants.join(",");

  const res = await api.get("/analytics/feed/app-summary", {
    params: query,
  });

  return res.data as FeedExperimentSummaryResponse;
};

// ======================================================
// 📡 WebRTC (multimedia Cloudflare u otro proveedor)
// ======================================================
export type WebrtcConfig = {
  provider: string;
  appId?: string;
  iceServers?: any[];
  ttlSeconds?: number;
  hasApiToken?: boolean;
  expiresAt?: string;
};

export type WebrtcSession = {
  roomId: string;
  clientId: string;
  username?: string;
  iceServers?: any[];
  appId?: string;
  ttlSeconds?: number;
  expiresAt?: string;
};

export const getWebrtcConfig = async (): Promise<WebrtcConfig> => {
  const res = await api.get("/webrtc/config");
  const payload = res?.data?.data || res?.data || {};
  return payload as WebrtcConfig;
};

export const createWebrtcSession = async (
  roomId?: string | null
): Promise<WebrtcSession> => {
  const body = roomId ? { roomId } : undefined;
  const res = await api.post("/webrtc/session", body);
  const payload = res?.data?.data || res?.data || {};
  return payload as WebrtcSession;
};

// ======================================================
// 📞 Calls / Videocalls
// ======================================================
export type CallStartPayload = {
  receiverId: string;
  type: "audio" | "video";
};

export type Call = {
  _id: string;
  caller: string;
  receiver?: string | null;
  participants: string[];
  type: "audio" | "video";
  status:
    | "ringing"
    | "active"
    | "rejected"
    | "cancelled"
    | "ended"
    | "missed";
  startedAt?: string;
  acceptedAt?: string | null;
  endedAt?: string | null;
  endedBy?: string | null;
  duration?: number;
};

export type CallLog = {
  _id: string;
  callId: string;
  caller: string;
  receivers: string[];
  type: "audio" | "video";
  duration: number;
  status: "completed" | "missed" | "cancelled" | "rejected";
  startedAt?: string;
  endedAt?: string;
  endedBy?: string | null;
};

export const startCall = async (
  receiverId: string,
  type: "audio" | "video"
): Promise<Call> => {
  const res = await api.post("/calls/start", { receiverId, type });
  return res?.data?.data || res?.data;
};

export const acceptCall = async (callId: string): Promise<Call> => {
  const res = await api.post(`/calls/${callId}/accept`);
  return res?.data?.data || res?.data;
};

export const rejectCall = async (callId: string): Promise<Call> => {
  const res = await api.post(`/calls/${callId}/reject`);
  return res?.data?.data || res?.data;
};

export const endCall = async (callId: string): Promise<Call> => {
  const res = await api.post(`/calls/${callId}/end`);
  return res?.data?.data || res?.data;
};

export const getCallHistory = async (): Promise<CallLog[]> => {
  const res = await api.get("/calls/history");
  const payload = res?.data?.data || res?.data || [];
  return Array.isArray(payload) ? payload : [];
};

export default api;
