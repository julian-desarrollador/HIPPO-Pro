import { type ReactNode } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { desktopBarHeight, mobileBarHeight, mobileTabBarHeight, wideLayout } from "@/constants/layout";

export function ScreenFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const wide = useWindowDimensions().width >= wideLayout;
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          width: "100%",
          maxWidth: 1100,
          alignSelf: "center",
          paddingHorizontal: 20,
          paddingTop: (wide ? desktopBarHeight : mobileBarHeight) + 20,
          paddingBottom: wide ? 48 : mobileTabBarHeight + insets.bottom + 24,
        }}>
        <View className="flex-row flex-wrap items-center gap-3">
          <Text className="text-3xl font-semibold text-ink">{title}</Text>
          <View className="rounded-full bg-amber-soft px-3 py-1">
            <Text className="text-xs font-medium text-amber-ink">Vista previa · agosto 2026</Text>
          </View>
        </View>
        {subtitle ? <Text className="mt-2 text-base text-muted">{subtitle}</Text> : null}
        <Text className="mt-1 text-sm text-muted">Si recargás la página, vuelve la planilla. Todavía no guarda.</Text>
        <View className="mt-6 gap-4">{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View className="rounded-2xl border border-line bg-card p-4">{children}</View>;
}

export function SectionTitle({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <View className="flex-row items-end justify-between gap-3">
      <Text className="text-lg font-semibold text-ink">{title}</Text>
      {trailing}
    </View>
  );
}
