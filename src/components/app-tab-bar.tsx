import { createContext, useContext } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps, type TabListProps } from "expo-router/ui";

import { desktopBarHeight, mobileBarHeight, wideLayout } from "@/constants/layout";
import { palette } from "@/constants/palette";
import { useLedger, type ViewerRole } from "@/modules/ledger";

const TAB_ICONS = {
  home: { outline: "home-outline", filled: "home" },
  carga: { outline: "create-outline", filled: "create" },
  depositos: { outline: "swap-horizontal-outline", filled: "swap-horizontal" },
  gastos: { outline: "receipt-outline", filled: "receipt" },
  resultado: { outline: "stats-chart-outline", filled: "stats-chart" },
} as const;

type TabIcon = keyof typeof TAB_ICONS;

const NavChromeContext = createContext<"desktop" | "bottom">("desktop");

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
  const glyph = TAB_ICONS[icon];

  if (variant === "bottom") {
    return (
      <Pressable
        {...props}
        accessibilityRole="link"
        className="min-w-0 flex-1 items-center gap-1 py-1"
        style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
        <Ionicons name={isFocused ? glyph.filled : glyph.outline} size={22} color={isFocused ? palette.navy : palette.muted} />
        <Text
          numberOfLines={1}
          className={isFocused ? "text-[11px] font-semibold text-navy" : "text-[11px] font-medium text-muted"}>
          {children}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      {...props}
      accessibilityRole="link"
      className={isFocused ? "rounded-lg bg-tint px-3.5 py-2" : "rounded-lg px-3.5 py-2"}
      style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
      <Text className={isFocused ? "text-sm font-semibold text-navy" : "text-sm font-medium text-muted"}>{children}</Text>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const { role, setRole } = useLedger();
  const wide = useWindowDimensions().width >= wideLayout;
  const insets = useSafeAreaInsets();

  return (
    <NavChromeContext.Provider value={wide ? "desktop" : "bottom"}>
      <View
        {...props}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: wide ? undefined : 0,
          zIndex: 20,
          pointerEvents: "box-none",
        }}>
        <View
          style={{
            backgroundColor: palette.card,
            borderBottomWidth: 1,
            borderBottomColor: palette.line,
            height: wide ? desktopBarHeight : mobileBarHeight,
            justifyContent: "center",
          }}>
          <View
            style={{
              width: "100%",
              maxWidth: 1100,
              alignSelf: "center",
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: wide ? 28 : 12,
            }}>
            <Brand />
            {wide ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ flexGrow: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
                {props.children}
              </ScrollView>
            ) : null}
            <View style={{ marginLeft: "auto" }}>
              <RoleSwitch role={role} onChange={setRole} />
            </View>
          </View>
        </View>

        {wide ? null : (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: palette.card,
              borderTopWidth: 1,
              borderTopColor: palette.line,
              paddingTop: 8,
              paddingBottom: Math.max(8, insets.bottom),
              paddingHorizontal: 4,
            }}>
            {props.children}
          </View>
        )}
      </View>
    </NavChromeContext.Provider>
  );
}

function Brand() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
      <View className="h-9 w-9 items-center justify-center rounded-lg bg-navy">
        <Text className="text-base font-bold text-white">H</Text>
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
          HIPPO Pro
        </Text>
        <Text className="text-xs text-muted" numberOfLines={1}>
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
      <Text className={selected ? "text-sm font-semibold text-white" : "text-sm text-muted"}>{label}</Text>
    </Pressable>
  );
}
