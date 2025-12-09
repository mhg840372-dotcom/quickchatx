// ======================================================
// 🌍 TranslationProvider.tsx — v3.4 (2025)
// ------------------------------------------------------
// ✔ Compatible con Expo SDK 54
// ✔ Usa expo-localization de forma segura
// ✔ Fallback si Localization falla
// ✔ Detección natural de idioma del sistema
// ======================================================

import * as Localization from "expo-localization";
import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useState,
} from "react";

type Language = "es" | "en";

// ======================================================
// 🗣 Tabla de traducciones
// ======================================================
const translations = {
  es: {
    welcome: "Bienvenido a QuickChatX 💬",
    login: "Iniciar sesión",
    register: "Registrarse",
    contacts: "Contactos",
    explore: "Explorar",
    profile: "Mi Perfil",
    editProfile: "Editar Perfil",
    addContact: "Agregar Contacto",
    chat: "Chat",
    termsTitle: "Términos y Condiciones",
    termsContent: `1. Eres responsable por todo el contenido que publiques en la aplicación.\n
2. Si algún contenido viola derechos de autor, tu cuenta puede ser bloqueada o el contenido eliminado.\n
3. Contenido ilegal, pornografía infantil, terrorismo, amenazas, discriminación o cualquier abuso está estrictamente prohibido.\n
4. Si cometes algún delito a través de la aplicación, puedes ser denunciado a las autoridades.\n
5. El incumplimiento de estas normas puede resultar en la expulsión de la aplicación.\n\n
Al aceptar estos términos, confirmas que entiendes y cumplirás con todas las reglas de uso de QuickChatX.`,
    acceptTerms: "Acepto los términos y condiciones",
    continue: "Continuar",
    mustAccept: "Debes aceptar los términos y condiciones para continuar.",
    saveError: "Ocurrió un error al guardar el perfil.",
  },
  en: {
    welcome: "Welcome to QuickChatX 💬",
    login: "Log In",
    register: "Sign Up",
    contacts: "Contacts",
    explore: "Explore",
    profile: "My Profile",
    editProfile: "Edit Profile",
    addContact: "Add Contact",
    chat: "Chat",
    termsTitle: "Terms and Conditions",
    termsContent: `1. You are responsible for all content you post in the app.\n
2. If any content violates copyrights, your account may be blocked or the content removed.\n
3. Illegal content, child pornography, terrorism, threats, discrimination, or any abuse is strictly prohibited.\n
4. If you commit any crime through the app, you may be reported to authorities.\n
5. Violating these rules may result in expulsion from the app.\n\n
By accepting these terms, you confirm that you understand and will comply with all QuickChatX usage rules.`,
    acceptTerms: "I accept the terms and conditions",
    continue: "Continue",
    mustAccept: "You must accept the terms and conditions to continue.",
    saveError: "An error occurred while saving your profile.",
  },
};

type Translations = typeof translations.es;

// ======================================================
// 🧩 Contexto
// ======================================================
interface TranslationContextProps {
  t: (key: keyof Translations) => string;
  language: Language;
  setLanguage: (lang: Language) => void;
}

const TranslationContext = createContext<TranslationContextProps>({
  t: (key) => String(key),
  language: "es",
  setLanguage: () => {},
});

export const useTranslation = () => useContext(TranslationContext);

interface TranslationProviderProps {
  children: ReactNode;
  defaultLanguage?: Language;
}

// ======================================================
// 🌍 Provider
// ======================================================
export const TranslationProvider = ({
  children,
  defaultLanguage = "es",
}: TranslationProviderProps) => {
  const [language, setLanguage] = useState<Language>(defaultLanguage);

  // Detectar idioma del dispositivo de forma segura
  useEffect(() => {
    try {
      // Expo SDK 54: Localization.getLocales()[0].languageCode
      const systemLocales = Localization.getLocales?.();

      let deviceLang: string | undefined;

      if (Array.isArray(systemLocales) && systemLocales.length > 0) {
        deviceLang = systemLocales[0].languageCode;
      } else if (typeof Localization.locale === "string") {
        deviceLang = Localization.locale.split("-")[0];
      }

      const normalized =
        deviceLang === "en" ? "en" : deviceLang === "es" ? "es" : defaultLanguage;

      setLanguage(normalized);
    } catch (err) {
      console.warn(
        "⚠️ Error detectando idioma, usando idioma por defecto:",
        err
      );
      setLanguage(defaultLanguage);
    }
  }, [defaultLanguage]);

  // Hook de traducción
  const t = (key: keyof Translations): string => {
    const pack = translations[language];
    const value = pack?.[key];
    return typeof value === "string" ? value : key;
  };

  return (
    <TranslationContext.Provider value={{ t, language, setLanguage }}>
      {children}
    </TranslationContext.Provider>
  );
};
