// ======================================================
// 🧠 useUsernameCheck.ts — Hook de verificación de username
// ✅ Con cooldown + debounce + sugerencias automáticas
// ✅ Compatible con QuickChatX v8.6.1 (apiCheckUsername)
// ======================================================

import { useEffect, useState, useCallback } from "react";
import { apiCheckUsername } from "../services/api";

const DEBOUNCE_MS = 600; // Espera 600ms tras dejar de escribir
const COOLDOWN_MS = 5000; // Anti-spam local adicional

export function useUsernameCheck(firstName?: string, lastName?: string) {
  const [username, setUsername] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastRequestTime, setLastRequestTime] = useState(0);

  // ======================================================
  // 🧭 Función de verificación
  // ======================================================
  const checkUsername = useCallback(
    async (name: string) => {
      if (!name || name.length < 3) {
        setAvailable(null);
        setSuggestions([]);
        return;
      }

      const now = Date.now();
      if (now - lastRequestTime < COOLDOWN_MS) {
        console.warn("⚠️ Evitado check repetido (cooldown local).");
        return;
      }

      setLastRequestTime(now);
      setChecking(true);
      setError(null);

      try {
        const result = await apiCheckUsername(name, firstName, lastName);
        setAvailable(result.available);
        setSuggestions(result.suggestions || []);
      } catch (err: any) {
        setError("Error verificando disponibilidad.");
        setAvailable(null);
        setSuggestions([]);
      } finally {
        setChecking(false);
      }
    },
    [firstName, lastName, lastRequestTime]
  );

  // ======================================================
  // ⏱️ Debounce (espera mientras el usuario escribe)
  // ======================================================
  useEffect(() => {
    if (!username) {
      setAvailable(null);
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(() => {
      checkUsername(username);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [username, checkUsername]);

  return {
    username,
    setUsername,
    available,
    checking,
    suggestions,
    error,
  };
}
