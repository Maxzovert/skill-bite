import { useEffect, useState } from "react";
import { StatusBar, StyleSheet } from "react-native";
import { useFonts, Quicksand_600SemiBold } from "@expo-google-fonts/quicksand";
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";
import * as SplashScreenNative from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppNavigation } from "./src/navigation";
import { loadOnboardingDone } from "./src/onboardingStore";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { SplashScreen } from "./src/screens/SplashScreen";
import { SessionProvider } from "./src/session";
import { colors } from "./src/theme";

void SplashScreenNative.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const [booting, setBooting] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Quicksand_600SemiBold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    let active = true;
    async function boot() {
      const [done] = await Promise.all([
        loadOnboardingDone(),
        SplashScreenNative.hideAsync().catch(() => undefined),
      ]);
      if (!active || (!fontsLoaded && !fontError)) return;
      setOnboardingDone(done);
      setBooting(false);
    }
    void boot();
    return () => {
      active = false;
    };
  }, [fontsLoaded, fontError]);

  return (
    <SafeAreaProvider style={styles.root}>
      <SessionProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        {booting ? (
          <SplashScreen onFinished={() => undefined} />
        ) : !onboardingDone ? (
          <OnboardingScreen onDone={() => setOnboardingDone(true)} />
        ) : (
          <AppNavigation />
        )}
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
