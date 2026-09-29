import { createContext, useContext } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { usePathname } from "expo-router";
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps, type TabListProps } from "expo-router/ui";

import { desktopTopbarHeight, mobileBarHeight, sidebarWidth, wideLayout } from "@/constants/layout";
import { palette } from "@/constants/palette";
import { useLedger, type ViewerRole } from "@/modules/ledger";

const TAB_ICONS = {
  home: "home",
  carga: "create",
  depositos: "swap-horizontal",
  gastos: "receipt",
  cuentas: "people",
  resultado: "stats-chart",
} as const;

type TabIcon = keyof typeof TAB_ICONS;

const PAGE_TITLES: Record<string, string> = {
  "/": "Inicio",
  "/carga": "Carga del día",
  "/depositos": "Depósitos",
  "/gastos": "Gastos",
  "/cuentas": "Cuentas corrientes",
  "/resultado": "Resultado",
};

const NavChromeContext = createContext<"sidebar" | "bottom">("sidebar");

export default function AppTabs() {
  const { canViewBalances } = useLedger();

  return (
    <Tabs>
      <TabSlot style={{ height: "100%" }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon="home">Inicio</TabButton>
          </TabTrigger>
          <TabTrigger name="carga" href="/carga" asChild>
            <TabButton icon="carga">Carga</TabButton>
          </TabTrigger>
          <TabTrigger name="depositos" href="/depositos" asChild>
            <TabButton icon="depositos">Depósitos</TabButton>
          </TabTrigger>
          <TabTrigger name="gastos" href="/gastos" asChild>
            <TabButton icon="gastos">Gastos</TabButton>
          </TabTrigger>
          <TabTrigger name="cuentas" href="/cuentas" asChild>
            <TabButton icon="cuentas">Cuentas</TabButton>
          </TabTrigger>
          {canViewBalances ? (
            <TabTrigger name="resultado" href="/resultado" asChild>
              <TabButton icon="resultado">Resultado</TabButton>
            </TabTrigger>
          ) : null}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ icon, children, isFocused, ...props }: TabTriggerSlotProps & { icon: TabIcon }) {
  const variant = useContext(NavChromeContext);

  if (variant === "bottom") {
    return (
      <Pressable
        {...props}
        accessibilityRole="link"
        className="min-w-0 flex-1 items-center gap-1 py-1"
        style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
        <Ionicons name={TAB_ICONS[icon]} size={24} color={isFocused ? palette.navy : palette.muted} />
        <Text
          numberOfLines={1}
          className={isFocused ? "text-[12px] font-semibold text-navy" : "text-[12px] font-medium text-muted"}>
          {children}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      {...props}
      accessibilityRole="link"
      className="w-full flex-row items-center gap-2.5 py-3 pr-5"
      style={({ pressed }) => [
        {
          borderLeftWidth: 3,
          borderLeftColor: isFocused ? palette.navy : "transparent",
          backgroundColor: isFocused ? palette.tint : "transparent",
          paddingLeft: 17,
        },
        pressed ? { opacity: 0.7 } : undefined,
      ]}>
      <Ionicons name={TAB_ICONS[icon]} size={20} color={isFocused ? palette.navy : palette.muted} />
      <Text className={isFocused ? "text-[15px] font-medium text-navy" : "text-[15px] font-medium text-ink"}>{children}</Text>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const { children, style: listStyle, ...rest } = props;
  const { role, setRole } = useLedger();
  const wide = useWindowDimensions().width >= wideLayout;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const pageTitle = PAGE_TITLES[pathname] ?? "HIPPO Pro";

  return (
    <NavChromeContext.Provider value={wide ? "sidebar" : "bottom"}>
      <View
        {...rest}
        pointerEvents="box-none"
        style={[
          listStyle,
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            pointerEvents: "none",
          },
        ]}>
        {wide ? (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: sidebarWidth,
              backgroundColor: palette.card,
              borderRightWidth: 1,
              borderRightColor: palette.line,
              pointerEvents: "auto",
            }}>
            <View
              style={{
                paddingHorizontal: 20,
                paddingVertical: 24,
                borderBottomWidth: 1,
                borderBottomColor: palette.line,
              }}>
              <Brand />
            </View>
            <Text
              className="px-5 pb-1 pt-3 text-[10px] font-semibold uppercase text-muted"
              style={{ letterSpacing: 1.5 }}>
              Agencia
            </Text>
            {children}
          </View>
        ) : null}

        <View
          style={{
            position: "absolute",
            top: 0,
            left: wide ? sidebarWidth : 0,
            right: 0,
            height: wide ? desktopTopbarHeight : mobileBarHeight,
            backgroundColor: palette.card,
            borderBottomWidth: 1,
            borderBottomColor: palette.line,
            justifyContent: "center",
            paddingHorizontal: 16,
            pointerEvents: "auto",
          }}>
          <View className="flex-row items-center justify-between gap-3">
            {wide ? (
              <Text className="font-serif text-[22px] text-navy" numberOfLines={1}>
                {pageTitle}
              </Text>
            ) : (
              <Brand />
            )}
            <RoleSwitch role={role} onChange={setRole} />
          </View>
        </View>

        {wide ? null : (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 20,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: palette.card,
              borderTopWidth: 1,
              borderTopColor: palette.line,
              paddingTop: 8,
              paddingBottom: Math.max(8, insets.bottom),
              paddingHorizontal: 4,
              pointerEvents: "auto",
            }}>
            {children}
          </View>
        )}
      </View>
    </NavChromeContext.Provider>
  );
}

function Brand() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-navy">
        <Text className="font-serif text-lg text-white">H</Text>
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text className="font-serif text-base text-navy" numberOfLines={1}>
          HIPPO Pro
        </Text>
        <Text className="text-[11px] text-muted" numberOfLines={1}>
          Agencia Dolores
        </Text>
      </View>
    </View>
  );
}

function RoleSwitch({ role, onChange }: { role: ViewerRole; onChange: (role: ViewerRole) => void }) {
  return (
    <View className="flex-row rounded-lg border border-line bg-canvas p-0.5">
      <RoleOption label="Dueño" selected={role === "owner"} onPress={() => onChange("owner")} />
      <RoleOption label="Operador" selected={role === "operator"} onPress={() => onChange("operator")} />
    </View>
  );
}

function RoleOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={selected ? "rounded-md bg-navy px-3 py-1.5" : "rounded-md px-3 py-1.5"}>
      <Text className={selected ? "text-[13px] font-semibold text-white" : "text-[13px] text-muted"}>{label}</Text>
    </Pressable>
  );
}
