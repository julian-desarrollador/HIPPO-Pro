import { type ReactNode } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { monthTitle, shiftMonth } from "@/components/calendar-grid";
import { desktopTopbarHeight, mobileBarHeight, mobileTabBarHeight, sidebarWidth, wideLayout } from "@/constants/layout";
import { palette } from "@/constants/palette";
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
  const { viewMonth, setViewMonth } = useLedger();

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
            <View className="flex-row items-center rounded-full border border-line bg-card">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mes anterior"
                onPress={() => setViewMonth(shiftMonth(viewMonth, -1))}
                className="h-8 w-8 cursor-pointer items-center justify-center">
                <Ionicons name="chevron-back" size={18} color={palette.accent} />
              </Pressable>
              <Text className="min-w-[128px] text-center text-[15px] font-semibold text-navy">{monthTitle(viewMonth)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mes siguiente"
                onPress={() => setViewMonth(shiftMonth(viewMonth, 1))}
                className="h-8 w-8 cursor-pointer items-center justify-center">
                <Ionicons name="chevron-forward" size={18} color={palette.accent} />
              </Pressable>
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
      <Text className="text-[15px] font-semibold uppercase text-muted" style={{ letterSpacing: 1 }}>
        {title}
      </Text>
      <View className="h-px flex-1 bg-line" />
      {trailing}
    </View>
  );
}
