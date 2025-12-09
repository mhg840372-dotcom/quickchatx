// ======================================================
// 📜 TermsScreen.tsx — Aceptación de Términos
// 🚀 QuickChatX v9.6 — Términos ampliados + flujo intacto
// ======================================================

import { LinearGradient } from "expo-linear-gradient";
import {
    useLocalSearchParams,
    useNavigation,
    useRouter,
} from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { registerUser as apiRegisterUser } from "../../services/api";
import { useTheme } from "../../theme/themes";
// GlobalHeader no se usa en pantallas de auth

export default function TermsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ data: string }>();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // 📌 Recibimos datos enviados desde RegisterScreen
  const userData = params?.data ? JSON.parse(decodeURIComponent(params.data)) : {};

  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forzamos contraste alto para evitar texto oscuro sobre fondos vibrantes
  const primaryColor = "#4DA8FF";
  const textColor = "#FFFFFF";

  // Oculta el header y limpia el fondo del stack
  useEffect(() => {
    navigation?.setOptions?.({
      headerShown: false,
      contentStyle: { backgroundColor: "#0c0f1a" },
    });
  }, [navigation]);

  // ======================================================
  // 🚀 Aceptar → Registrar → Enviar a SuccessScreen
  // ⚠️ NO TOCADO: lógica de conexión y token
  // ======================================================
  const handleAcceptTerms = async () => {
    if (!accepted) {
      Alert.alert("Aviso", "Debes aceptar los Términos antes de continuar.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...userData,
        acceptedTerms: true,
        birthDate: userData?.birthDate,
        birthdate: userData?.birthDate,
      };

      console.log("📤 Enviando registro:", payload);

      // Usar client de servicios con BASE_URL/ENV
      const res = await apiRegisterUser(
        payload.firstName,
        payload.lastName,
        payload.username,
        payload.email,
        payload.password,
        payload.confirmPassword,
        payload.birthDate
      );

      if (!res?.token || !res?.user) {
        throw new Error("Respuesta inválida del servidor.");
      }

      console.log("✅ Registro OK:", res);

      // ======================================================
      // 🚀 Mandamos a SuccessScreen con token y user
      // ======================================================
      router.replace({
        pathname: "/(auth)/SuccessScreen",
        params: {
          token: res.token,
          user: JSON.stringify(res.user),
        },
      });

    } catch (err: any) {
      console.error("❌ Error en registro:", err.response?.data || err.message);

      const message =
        err.response?.data?.error ||
        err.message ||
        "Ocurrió un error durante el registro.";

      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // 🧩 UI
  // ======================================================
  const paddingTop = insets.top + 16;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "right", "bottom", "left"]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {/* 🌈 Fondo animado */}
      <View style={StyleSheet.absoluteFillObject}>
        <LottieView
          source={require("@/assets/lottie/App Background.json")}
          autoPlay
          loop
          style={StyleSheet.absoluteFillObject}
        />
        {/* Overlay para oscurecer el fondo y dar contraste al texto */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: "rgba(0,0,0,0.72)" },
          ]}
        />
      </View>

      {/* 📜 Contenido */}
      <View
        style={[
          styles.container,
          {
            backgroundColor: "rgba(0,0,0,0.85)",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop,
            paddingBottom: insets.bottom > 8 ? insets.bottom : 16,
          },
        ]}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingBottom: 140,
            maxWidth: 820,
            alignSelf: "center",
            width: "100%",
            paddingHorizontal: 4,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={[
              styles.title,
              {
                color: textColor,
                fontSize: width < 360 ? 22 : 26,
                letterSpacing: 0.2,
              },
            ]}
          >
            Términos y Condiciones de Uso
          </Text>

          {/* 1. Aceptación del servicio */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            1. Aceptación del servicio
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            Al crear una cuenta en QuickChatX, confirmas que has leído, entendido y
            aceptas estos Términos y Condiciones, así como la política de privacidad
            asociada al servicio. Si no estás de acuerdo con alguna parte de estos
            términos, no debes utilizar la aplicación.
          </Text>

          {/* 2. Comportamiento del usuario */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            2. Comportamiento del usuario
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            Está estrictamente prohibido utilizar QuickChatX para actividades abusivas,
            ilegales o que puedan causar daño a otras personas o a la plataforma.
          </Text>

          <View style={styles.list}>
            {[
              "Acoso, amenazas, bullying o discurso de odio por motivos de raza, religión, género, orientación sexual u otros.",
              "Suplantación de identidad de personas, empresas o entidades.",
              "Compartir contenido extremadamente violento, gráfico o que incite al odio.",
              "Difusión de spam, estafas, enlaces maliciosos o software dañino.",
              "Uso de bots, automatizaciones o scraping sin autorización.",
              "Intentos de hackeo, ingeniería social o vulneración de cuentas ajenas.",
              "Compartir datos personales de terceros sin su consentimiento.",
            ].map((item, i) => (
              <Text key={i} style={[styles.bullet, { color: textColor }]}>
                • {item}
              </Text>
            ))}
          </View>

          {/* 3. Privacidad y datos personales */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            3. Privacidad y datos personales
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            QuickChatX almacena la información necesaria para poder ofrecerte el servicio,
            mejorar la experiencia y mantener la seguridad de la plataforma. Esto incluye,
            de forma enunciativa pero no limitativa, datos de registro, actividad básica,
            dispositivo y ciertos metadatos técnicos.
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            Nunca venderemos tus datos personales a terceros. Sin embargo, podremos
            compartir cierta información de manera anonimizada o agregada para fines
            estadísticos, de seguridad o cumplimiento legal cuando sea requerido.
          </Text>

          {/* 4. Contenido generado por el usuario */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            4. Contenido generado por el usuario
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            Eres responsable del contenido que compartes en QuickChatX. Al publicar,
            garantizas que tienes los derechos necesarios sobre dicho contenido y que no
            infringe derechos de terceros (derechos de autor, marca, privacidad, etc.).
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            QuickChatX se reserva el derecho de eliminar cualquier contenido que vulnere
            estos Términos, las políticas de las tiendas (Google Play / App Store) o
            cualquier ley aplicable, sin previo aviso.
          </Text>

          {/* 5. Riesgos en redes sociales y plataformas externas */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            5. Riesgos en redes sociales y plataformas externas
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            QuickChatX puede interactuar con servicios externos como Google, tiendas de
            aplicaciones, servicios de notificaciones o redes de terceros. Es importante
            que entiendas que:
          </Text>

          <View style={styles.list}>
            {[
              "Google, las redes sociales y las tiendas de apps aplican sus propias políticas y algoritmos de moderación.",
              "Si publicas contenido que viole las normas de esas plataformas, tu cuenta podría ser limitada, bloqueada o denunciada.",
              "QuickChatX no controla las decisiones automatizadas o manuales que tomen Google u otras plataformas externas.",
              "El uso inadecuado de la app (por ejemplo, compartir contenido sensible o ilegal) puede generar reportes, bloqueos o acciones disciplinarias externas a QuickChatX.",
            ].map((item, i) => (
              <Text key={`g-${i}`} style={[styles.bullet, { color: textColor }]}>
                • {item}
              </Text>
            ))}
          </View>

          <Text style={[styles.text, { color: textColor }]}>
            Al aceptar estos términos, reconoces que comprendes estos riesgos y que el
            uso que hagas de QuickChatX en combinación con otras redes o servicios es
            bajo tu propia responsabilidad.
          </Text>

          {/* 6. Suspensión y eliminación de cuentas */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            6. Suspensión y eliminación de cuentas
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            QuickChatX podrá suspender temporalmente o cerrar de forma permanente tu
            cuenta si:
          </Text>

          <View style={styles.list}>
            {[
              "Se detecta uso abusivo, ilegal o que viole gravemente estos Términos.",
              "Se reciben múltiples reportes verificados de otros usuarios.",
              "Se detectan intentos de fraude, estafa o hackeo.",
              "Lo exija una autoridad competente o una obligación legal.",
            ].map((item, i) => (
              <Text key={`s-${i}`} style={[styles.bullet, { color: textColor }]}>
                • {item}
              </Text>
            ))}
          </View>

          <Text style={[styles.text, { color: textColor }]}>
            En casos graves, podremos colaborar con autoridades o con las plataformas
            implicadas (por ejemplo, Google o redes sociales) para investigar posibles
            abusos o delitos.
          </Text>

          {/* 7. Eliminación de cuenta */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            7. Eliminación de cuenta por parte del usuario
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            Puedes solicitar la eliminación de tu cuenta en cualquier momento desde la
            configuración de la aplicación o contactando con el soporte. La eliminación
            es permanente y no garantiza que el contenido ya compartido con otras
            personas o servicios externos pueda ser eliminado de todos los lugares.
          </Text>

          {/* 8. Seguridad de la cuenta */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            8. Seguridad de la cuenta
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            Eres responsable de mantener la confidencialidad de tu contraseña y de no
            compartir tus credenciales con terceros. Si detectas acceso no autorizado,
            debes cambiar la contraseña de inmediato y, si es necesario, contactar con
            el soporte de QuickChatX.
          </Text>

          {/* 9. Limitación de responsabilidad */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            9. Limitación de responsabilidad
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            QuickChatX no será responsable por daños indirectos, incidentales o
            consecuentes derivados del uso o imposibilidad de uso de la aplicación, ni
            por decisiones de terceros como Google, redes sociales, operadores de red o
            tiendas de aplicaciones.
          </Text>

          {/* 10. Cambios en los términos */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            10. Cambios en estos Términos
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            Podemos actualizar estos Términos y Condiciones para adaptarlos a cambios
            legales, técnicos o funcionales del servicio. En caso de cambios
            significativos, se te notificará dentro de la app. Si continúas utilizando
            QuickChatX después de dichos cambios, se considerará que aceptas la versión
            actualizada.
          </Text>

          {/* 11. Propiedad del contenido y licencias */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            11. Propiedad del contenido y licencias
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            Eres titular del contenido que publiques. Concedes a QuickChatX una licencia
            mundial, no exclusiva y revocable para alojar, procesar, mostrar y distribuir
            tu contenido dentro del servicio, solo con el fin de operar la plataforma.
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            No subas contenido con derechos de autor de terceros sin permiso. Podemos
            eliminar contenido que infrinja propiedad intelectual, privacidad o marcas.
          </Text>

          {/* 12. Moderación, reportes y suspensión */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            12. Moderación, reportes y suspensión
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            QuickChatX puede moderar, limitar el alcance, ocultar o eliminar contenido que
            viole las normas. Las cuentas pueden ser suspendidas temporal o
            permanentemente ante infracciones graves o repetidas.
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            Puedes reportar contenido o usuarios; revisaremos los casos según gravedad y
            repetición. El proceso puede incluir bloqueo, limitaciones y notificación a
            autoridades cuando corresponda.
          </Text>

          {/* 13. Derechos de autor y notificaciones */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            13. Derechos de autor y notificaciones
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            Si crees que tu contenido protegido se usa sin autorización, puedes enviar un
            reclamo detallado (incluyendo prueba de titularidad y enlaces precisos). Tras
            verificarlo, podemos retirar el contenido y, si procede, suspender la cuenta
            infractora.
          </Text>

          {/* 14. Comunicaciones y notificaciones */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            14. Comunicaciones y notificaciones
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            Podemos enviarte avisos de seguridad, cambios de términos, actividad de
            cuenta o mensajes transaccionales vía email, push o dentro de la app. Puedes
            gestionar ciertas preferencias, pero algunos avisos (seguridad/legales) son
            obligatorios.
          </Text>

          {/* 15. Permisos, ubicaciones y dispositivos */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            15. Permisos, ubicaciones y dispositivos
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            Algunas funciones pueden solicitar permisos (cámara, micrófono, ubicación,
            notificaciones). Puedes revocarlos en ajustes del sistema, pero ciertas
            características podrían dejar de funcionar. No compartas datos sensibles de
            terceros sin su consentimiento.
          </Text>

          {/* 16. Publicidad, métricas y terceros */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            16. Publicidad, métricas y terceros
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            Podemos mostrar anuncios o contenido patrocinado identificado. Usamos métricas
            agregadas y anónimas para mejorar el servicio. Integraciones de terceros
            (por ejemplo, pasarelas de pago o mapas) tienen sus propias políticas; al
            usarlas, aceptas sus términos.
          </Text>

          {/* 17. Disponibilidad del servicio */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            17. Disponibilidad del servicio
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            QuickChatX puede experimentar interrupciones, mantenimiento o cambios en
            funcionalidades. Intentaremos notificar cortes relevantes, pero no garantizamos
            disponibilidad ininterrumpida. Guarda copias de contenido importante si lo
            necesitas.
          </Text>

          {/* 18. Usuarios menores */}
          <Text style={[styles.sectionTitle, { color: primaryColor }]}>
            18. Usuarios menores
          </Text>
          <Text style={[styles.text, { color: textColor }]}>
            El servicio está dirigido a mayores de 13 años (o la edad mínima aplicable en
            tu país). Si detectamos cuentas de menores de la edad permitida, podrán ser
            suspendidas o eliminadas.
          </Text>

          {/* Checkbox */}
          <TouchableOpacity
            onPress={() => setAccepted(!accepted)}
            style={styles.checkboxContainer}
          >
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: accepted ? primaryColor : "transparent",
                  borderColor: primaryColor,
                },
              ]}
            />
            <Text style={[styles.checkboxLabel, { color: textColor }]}>
              He leído y acepto los Términos y Condiciones
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Botón */}
        <TouchableOpacity
          onPress={handleAcceptTerms}
          disabled={!accepted || loading}
          style={{ marginBottom: 25 }}
        >
          <LinearGradient
            colors={[String(primaryColor), "#00BFFF"]}
            style={[styles.button, { opacity: !accepted ? 0.6 : 1 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Aceptar y continuar</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ======================================================
// 💅 Estilos
// ======================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    justifyContent: "space-between",
  },
  scroll: { flex: 1 },
  title: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 8,
    letterSpacing: 0.2,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    opacity: 1,
    fontWeight: "500",
  },
  list: { marginLeft: 12, marginBottom: 14 },
  bullet: { fontSize: 15, marginBottom: 8, lineHeight: 22, opacity: 1, fontWeight: "500" },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 6,
    marginRight: 10,
  },
  checkboxLabel: { fontSize: 17 },
  button: {
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },
});
