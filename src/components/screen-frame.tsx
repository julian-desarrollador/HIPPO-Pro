import { type ReactNode } from "react";
import { Animated, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { monthTitle, shiftMonth } from "@/components/calendar-grid";
import { useDesktopSidebarWidth } from "@/components/sidebar-menu";
import { desktopTopbarHeight, mobileBarHeight, mobileTabBarHeight, wideLayout } from "@/constants/layout";
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
  const menuWidth = useDesktopSidebarWidth();
  const insets = useSafeAreaInsets();
  const { viewMonth, setViewMonth } = useLedger();
  const gutter = wide ? 32 : 20;

  return (
    <SafeAreaView className="flex-1 bg-canvas" accessibilityLabel={title}>
      <View style={{ flex: 1, flexDirection: "row", minWidth: 0 }}>
        {menuWidth === 0 ? null : (
          <Animated.View style={{ width: menuWidth, flexShrink: 0 }} />
        )}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, minWidth: 0 }}
          contentContainerStyle={{
            width: "100%",
            paddingLeft: gutter,
            paddingRight: gutter,
            paddingTop: (wide ? desktopTopbarHeight : mobileBarHeight) + 20,
            paddingBottom: wide ? 48 : mobileTabBarHeight + insets.bottom + 24,
          }}>
          <View style={{ width: "100%", minWidth: 0 }}>
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
      </View>
    </SafeAreaView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View className="rounded-[14px] border border-line bg-card p-5">{children}</View>;
}

export function NoRacetracksCard() {
  const { canViewBalances } = useLedger();
  return (
    <Card>
      <Text className="font-sans text-[24px] font-semibold text-navy">Todavía no hay hipódromos</Text>
      <Text className="mt-2 text-[17px] leading-6 text-ink">
        {canViewBalances
          ? "Agregá el primero en Inicio, con su comisión. Después se carga acá."
          : "El dueño los agrega en Inicio. Después se carga acá."}
      </Text>
    </Card>
  );
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
