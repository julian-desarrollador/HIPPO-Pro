import { type ReactNode } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { desktopTopbarHeight, mobileBarHeight, mobileTabBarHeight, sidebarWidth, wideLayout } from "@/constants/layout";
import { useLedger } from "@/modules/ledger";

export function ScreenFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const wide = useWindowDimensions().width >= wideLayout;
  const insets = useSafeAreaInsets();
  const { persistence } = useLedger();
  const persistenceLabel = persistence === "agency" ? "Se guarda en la agencia · agosto 2026" : "Se guarda en este navegador · agosto 2026";

  return (
    <SafeAreaView className="flex-1 bg-canvas" accessibilityLabel={title}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{
          width: "100%",
          paddingLeft: (wide ? sidebarWidth : 0) + (wide ? 32 : 20),
          paddingRight: wide ? 32 : 20,
          paddingTop: (wide ? desktopTopbarHeight : mobileBarHeight) + 20,
          paddingBottom: wide ? 48 : mobileTabBarHeight + insets.bottom + 24,
        }}>
        <View style={{ width: "100%", maxWidth: 1100 }}>
          <View className="flex-row flex-wrap items-center gap-2">
            <View className="rounded-full border border-line bg-card px-3 py-1">
              <Text className="text-[11px] font-medium text-muted">{persistenceLabel}</Text>
            </View>
          </View>
          <View className="mt-5 gap-4">{children}</View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View className="rounded-[14px] border border-line bg-card p-5">{children}</View>;
}

export function SectionTitle({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-[13px] font-semibold uppercase text-muted" style={{ letterSpacing: 1 }}>
        {title}
      </Text>
      <View className="h-px flex-1 bg-line" />
      {trailing}
    </View>
  );
}
