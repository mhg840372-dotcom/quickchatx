import { ScrollProvider } from "../../contexts/ScrollContext";
import { useAuth } from "../../hooks/useAuth";
import { Pacifico_400Regular, useFonts } from "@expo-google-fonts/pacifico";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Easing, 
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ======================================================
   🔐 AuthWrapper — usa el contexto dentro del árbol Tabs
   ====================================================== */
function AuthWrapper({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/(auth)/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return <>{children}</>;
}

/* ======================================================
   🧱 TabsLayout — corregido para mostrar StatusBar SIEMPRE
   ====================================================== */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const headerAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current; 
  const [fontsLoaded] = useFonts({ Pacifico_400Regular });

  const refreshFeedRef = useRef<(() => void) | null>(null);
  const scrollToTopRef = useRef<(() => void) | null>(null);
  const router = useRouter();

  const handleScrollDirectionChange = useCallback(
    (direction: "up" | "down") => {
      // headerAnim solo moverá la SEGUNDA parte del header
      Animated.timing(headerAnim, {
        toValue: direction === "down" ? -56 : 0, // Mueve hacia arriba la altura del headerContent (56)
        duration: 150,
        useNativeDriver: true,
      }).start();
    },
    [headerAnim]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      refreshFeedRef.current?.();
    }, 60000);

    Animated.loop(
      Animated.sequence([
        Animated.timing(titleAnim, {
          toValue: -5,
          duration: 800,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(titleAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => {
      clearInterval(interval);
      titleAnim.stopAnimation(); 
    };
  }, [titleAnim]);

  if (!fontsLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  /* ======================================================
     ⭐ APP HEADER BACKGROUND — ESTÁTICO (SOLO FONDO)
     ====================================================== */
  const AppHeaderBackground = () => (
    <>
      {/* Mantenemos translucent para que podamos pintar el fondo con nuestra View */}
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <View style={[styles.staticHeaderBackground, { height: insets.top, backgroundColor: "#fff" }]} />
    </>
  );

  /* ======================================================
     ⭐ APP HEADER — ANIMADO (CONTENIDO PRINCIPAL)
     ====================================================== */
  const AppHeader = () => (
    <Animated.View
      style={[
        styles.animatedHeaderContainer, // MODIFICADO: Nueva propiedad para position: 'absolute' solo aquí
        {
          // ELIMINADO: Ya no gestionamos insets.top aquí, la vista estática lo hace.
          backgroundColor: "#fff",
          borderBottomWidth: 0.5,
          borderBottomColor: "#ddd",
          transform: [{ translateY: headerAnim }], // Animación para esconder/mostrar este header
          top: insets.top, // MODIFICADO: Se posiciona justo debajo del fondo estático.
        },
      ]}
    >
      <View style={styles.headerContent}>
        <Animated.Text style={[styles.appTitleAnimated, { transform: [{ translateY: titleAnim }] }]}>
          QuickChatX
        </Animated.Text>
        <Ionicons
          name="settings-outline"
          size={26}
          color="#111"
          onPress={() => router.push("/(tabs)/settings")}
        />
      </View>
    </Animated.View>
  );

  // ... (Resto del código de InstantIcon) ...
  const InstantIcon = ({
    IconComponent,
    name,
    activeName,
    badge,
    focused,
    activeColor = "#000",
    inactiveColor = "#777",
  }: {
    IconComponent: any;
    name: string;
    activeName?: string;
    badge?: number | null;
    focused: boolean;
    activeColor?: string;
    inactiveColor?: string;
  }) => {
    const color = focused ? activeColor : inactiveColor;
    const scale = useRef(new Animated.Value(1)).current;

    // Pequeño “pop” cuando cambia a enfocado para sentirlo más sensible
    useEffect(() => {
      if (focused) {
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.12, duration: 90, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 90, useNativeDriver: true }),
        ]).start();
      }
    }, [focused, scale]);

    const iconName = focused && activeName ? activeName : name;

    return (
      <Animated.View style={[styles.iconWrapperExpanded, { transform: [{ scale }] }]}>
        <IconComponent name={iconName} size={24} color={color} />
        {typeof badge === "number" && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        )}
      </Animated.View>
    );
  };


  return (
    <ScrollProvider
      onScrollDirectionChange={handleScrollDirectionChange}
      scrollToTop={(fn) => (scrollToTopRef.current = fn)}
      refreshFeed={(fn) => (refreshFeedRef.current = fn)}
    >
      <AuthWrapper>
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          {/* AÑADIDO: El fondo estático de la barra de estado */}
          <AppHeaderBackground />
          {/* HEADER ANIMADO */}
          <AppHeader />

          <Tabs
            detachInactiveScreens={false}
            screenOptions={{
              headerShown: false,
              lazy: false,
              tabBarShowLabel: true,
              tabBarActiveTintColor: "#000",
              tabBarInactiveTintColor: "#888",
              tabBarStyle: {
                backgroundColor: "#fff",
                borderTopWidth: 0.5,
                borderTopColor: "#ddd",
                elevation: 0,
                height: 50 + insets.bottom,
                paddingBottom: insets.bottom > 0 ? insets.bottom - 2 : 8,
                paddingTop: 2,
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
              },
            }}
            screenListeners={{
              tabPress: (e) => {
                const route = e.target?.split("-");
                if (route?.includes("index")) {
                  // Siempre actúa como botón de refresh + scroll-to-top
                  requestAnimationFrame(() => {
                    scrollToTopRef.current?.();
                    refreshFeedRef.current?.();
                  });
                }
              },
            }}
          >
            <Tabs.Screen
            name="index"
            options={{
              title: "Inicio",
            tabBarIcon: ({ focused }) => (
                <InstantIcon IconComponent={Ionicons} name="home-outline" activeName="home" focused={focused} />
            ),
          }}
        />
            <Tabs.Screen
              name="chat"
              options={{
              title: "Chat",
                tabBarIcon: ({ focused }) => (
                  <InstantIcon
                    IconComponent={Ionicons}
                    name="chatbubble-outline"
                    activeName="chatbubble"
                    focused={focused}
                    activeColor="#000"
                    inactiveColor="#777"
                  />
                ),
              }}
            />
            <Tabs.Screen
            name="Calls"
            options={{
              title: "Llamadas",
              tabBarIcon: ({ focused }) => (
                <InstantIcon IconComponent={Ionicons} name="call-outline" activeName="call" focused={focused} />
              ),
            }}
          />
            <Tabs.Screen
            name="profile"
            options={{
              title: "Perfil",
              tabBarIcon: ({ focused }) => (
                <InstantIcon IconComponent={MaterialIcons} name="person-outline" activeName="person" focused={focused} />
              ),
            }}
          />
            <Tabs.Screen
            name="settings"
            options={{
              title: "Ajustes",
              tabBarIcon: ({ focused }) => (
                <InstantIcon IconComponent={Ionicons} name="settings-outline" activeName="settings" focused={focused} />
              ),
            }}
          />
          </Tabs>
        </View>
      </AuthWrapper>
    </ScrollProvider>
  );
}

// Asegúrate de definir tus estilos
const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ESTILO NUEVO para el fondo estático de la barra de estado
  staticHeaderBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 11, // Asegúrate de que esté por encima del header animado
  },
  // ESTILO MODIFICADO para el contenedor animado (ahora solo para el contenido de 56px)
  animatedHeaderContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    // top es dinámico en el componente
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 56, // Altura estándar del contenido del header
    paddingHorizontal: 15,
  },
  appTitleAnimated: {
    fontSize: 25,
    color: "#070707",
    fontFamily: "Pacifico_400Regular",
  },
  iconWrapperExpanded: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: 'red',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
