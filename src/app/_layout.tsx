import "../../global.css";

import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from "@expo-google-fonts/playfair-display";
import { DefaultTheme, Slot, ThemeProvider, usePathname } from "expo-router";
import Head from "expo-router/head";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";

import AppTabs from "@/components/app-tabs";
import { AppShell } from "@/modules/ledger";

SplashScreen.preventAutoHideAsync();

/** Public pages: no ledger, no sign-in and no menu. */
const PUBLIC_PATHS = new Set(["/entrada", "/entrada2", "/entrada3"]);

export default function RootLayout() {
  const pathname = usePathname();
  const [loaded, error] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return (
      <Head>
        <title>HippoPro</title>
      </Head>
    );
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <Head>
        <title>HippoPro</title>
      </Head>
      <StatusBar style="light" />
      <View className="flex-1 bg-canvas font-sans">
        {PUBLIC_PATHS.has(pathname) ? (
          <Slot />
        ) : (
          <AppShell>
            <AppTabs />
          </AppShell>
        )}
      </View>
    </ThemeProvider>
  );
}
