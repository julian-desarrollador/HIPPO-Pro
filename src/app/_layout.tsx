import "../../global.css";

import { useEffect } from "react";
import { DefaultTheme, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

import AppTabs from "@/components/app-tabs";
import { LedgerProvider } from "@/modules/ledger";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <LedgerProvider>
      <ThemeProvider value={DefaultTheme}>
        <StatusBar style="dark" />
        <AppTabs />
      </ThemeProvider>
    </LedgerProvider>
  );
}
