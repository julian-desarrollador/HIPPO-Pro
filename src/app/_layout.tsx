import "../../global.css";

import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";
import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from "@expo-google-fonts/playfair-display";
import { DefaultTheme, ThemeProvider } from "expo-router";
import Head from "expo-router/head";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";

import AppTabs from "@/components/app-tabs";
import { AppShell } from "@/modules/ledger";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
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
        <title>HIPPO Pro</title>
      </Head>
    );
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <Head>
        <title>HIPPO Pro</title>
      </Head>
      <StatusBar style="light" />
      <View className="flex-1 bg-canvas font-sans">
        <AppShell>
          <AppTabs />
        </AppShell>
      </View>
    </ThemeProvider>
  );
}
