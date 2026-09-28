import { createContext, useContext, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { usePathname } from "expo-router";
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps, type TabListProps } from "expo-router/ui";

import { desktopBarHeight, mobileBarHeight, wideLayout } from "@/constants/layout";
import { palette } from "@/constants/palette";
import { useLedger, type ViewerRole } from "@/modules/ledger";

type NavMenu = {
  variant: "desktop" | "drawer";
  close: () => void;
};

const NavMenuContext = createContext<NavMenu>({ variant: "desktop", close: () => {} });

export default function AppTabs() {
  const { canViewBalances } = useLedger();

  return (
    <Tabs>
      <TabSlot style={{ height: "100%" }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Inicio</TabButton>
          </TabTrigger>
          <TabTrigger name="carga" href="/carga" asChild>
            <TabButton>Carga</TabButton>
          </TabTrigger>
          <TabTrigger name="depositos" href="/depositos" asChild>
            <TabButton>Depósitos</TabButton>
          </TabTrigger>
          <TabTrigger name="gastos" href="/gastos" asChild>
            <TabButton>Gastos</TabButton>
          </TabTrigger>
          {canViewBalances ? (
            <TabTrigger name="resultado" href="/resultado" asChild>
              <TabButton>Resultado</TabButton>
            </TabTrigger>
          ) : null}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const menu = useContext(NavMenuContext);

  return (
    <Pressable
      {...props}
      accessibilityRole="link"
      onPress={(event) => {
        props.onPress?.(event);
        menu.close();
      }}
      className={
        menu.variant === "drawer"
          ? isFocused
            ? "flex-row items-center justify-between rounded-xl bg-tint px-4 py-3.5"
            : "flex-row items-center justify-between rounded-xl px-4 py-3.5"
          : isFocused
            ? "rounded-lg bg-tint px-3.5 py-2"
            : "rounded-lg px-3.5 py-2"
      }
      style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
      <Text
        className={
          menu.variant === "drawer"
            ? isFocused
              ? "text-base font-semibold text-navy"
              : "text-base text-ink"
            : isFocused
              ? "text-sm font-semibold text-navy"
              : "text-sm font-medium text-muted"
        }>
        {children}
      </Text>
      {menu.variant === "drawer" && isFocused ? <View className="h-2 w-2 rounded-full bg-navy" /> : null}
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const { role, setRole } = useLedger();
  const { width, height } = useWindowDimensions();
  const wide = width >= wideLayout;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const menu: NavMenu = {
    variant: wide ? "desktop" : "drawer",
    close: () => setOpen(false),
  };

  return (
    <NavMenuContext.Provider value={menu}>
      <View
        {...props}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: !wide && open ? height : undefined,
          zIndex: 20,
        }}>
        <View
          style={{
            backgroundColor: palette.card,
            borderBottomWidth: !wide && open ? 0 : 1,
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
              gap: 28,
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
              {wide ? (
                <RoleSwitch role={role} onChange={setRole} />
              ) : (
                <MenuButton open={open} onPress={() => setOpen((current) => !current)} />
              )}
            </View>
          </View>
        </View>

        {wide ? null : (
          <View
            accessibilityElementsHidden={!open}
            style={{
              display: open ? "flex" : "none",
              position: "absolute",
              top: mobileBarHeight,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: palette.card,
              pointerEvents: open ? "auto" : "none",
            }}>
            <View className="flex-1 px-3 pt-2" style={{ gap: 4 }}>
              <Text className="px-4 pb-1 text-xs font-medium text-muted">Navegación</Text>
              {props.children}
            </View>
            <View className="gap-2 border-t border-line px-3 pb-8 pt-4">
              <Text className="px-4 text-xs font-medium text-muted">Vista</Text>
              <RoleSwitch role={role} onChange={setRole} fill />
            </View>
          </View>
        )}
      </View>
    </NavMenuContext.Provider>
  );
}

function Brand() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View className="h-9 w-9 items-center justify-center rounded-lg bg-navy">
        <Text className="text-base font-bold text-white">H</Text>
      </View>
      <View>
        <Text className="text-sm font-semibold text-ink">HIPPO Pro</Text>
        <Text className="text-xs text-muted">Agencia Dolores</Text>
      </View>
    </View>
  );
}

function MenuButton({ open, onPress }: { open: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={open ? "Cerrar menú" : "Abrir menú"}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-lg border border-line bg-card">
      {open ? (
        <Text className="text-lg font-semibold text-navy">×</Text>
      ) : (
        <View className="gap-1">
          <View className="h-0.5 w-4 rounded-full bg-navy" />
          <View className="h-0.5 w-4 rounded-full bg-navy" />
          <View className="h-0.5 w-4 rounded-full bg-navy" />
        </View>
      )}
    </Pressable>
  );
}

function RoleSwitch({
  role,
  onChange,
  fill = false,
}: {
  role: ViewerRole;
  onChange: (role: ViewerRole) => void;
  fill?: boolean;
}) {
  return (
    <View className="flex-row rounded-lg border border-line bg-canvas p-0.5">
      <RoleOption label="Dueño" selected={role === "owner"} fill={fill} onPress={() => onChange("owner")} />
      <RoleOption label="Operador" selected={role === "operator"} fill={fill} onPress={() => onChange("operator")} />
    </View>
  );
}

function RoleOption({
  label,
  selected,
  fill,
  onPress,
}: {
  label: string;
  selected: boolean;
  fill: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`${fill ? "flex-1 items-center py-2.5" : "px-3 py-1.5"} ${selected ? "rounded-md bg-navy" : "rounded-md"}`}>
      <Text className={selected ? "text-sm font-semibold text-white" : "text-sm text-muted"}>{label}</Text>
    </Pressable>
  );
}
