import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { usePathname, type Href } from "expo-router";
import {
  TabList,
  Tabs,
  TabSlot,
  TabTrigger,
  type TabListProps,
  type TabTriggerSlotProps,
} from "expo-router/ui";
import { createContext, useContext } from "react";
import { Platform, Pressable, Text, useWindowDimensions, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  desktopTopbarHeight,
  mobileBarHeight,
  sidebarWidth,
  wideLayout,
} from "@/constants/layout";
import { palette } from "@/constants/palette";
import { useLedger, type ViewerRole } from "@/modules/ledger";

const TAB_ICONS = {
  home: "home",
  carga: "create",
  depositos: "swap-horizontal",
  gastos: "receipt",
  cuentas: "people",
  historial: "time",
  resultado: "stats-chart",
} as const;

type TabIcon = keyof typeof TAB_ICONS;

const PAGE_TITLES: Record<string, string> = {
  "/": "Inicio",
  "/carga": "Carga del día",
  "/depositos": "Depósitos",
  "/gastos": "Gastos",
  "/cuentas": "Cuentas corrientes",
  "/cuentas/index": "Cuentas corrientes",
  "/historial": "Historial",
  "/resultado": "Resultado",
};

function bettorPageTitle(
  pathname: string,
  bettors: { id: string; name: string }[] | undefined,
): string | null {
  if (
    !pathname.startsWith("/cuentas/") ||
    pathname === "/cuentas/" ||
    pathname === "/cuentas/index"
  ) {
    return null;
  }
  const id = pathname.slice("/cuentas/".length);
  return (
    bettors?.find((bettor) => bettor.id === id)?.name ?? "Cuentas corrientes"
  );
}

const NavChromeContext = createContext<"sidebar" | "bottom">("sidebar");

const pinnedToViewport = (
  Platform.OS === "web" ? { position: "fixed" } : { position: "absolute" }
) as ViewStyle;

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
          <TabTrigger name="cuentas" href={"/cuentas" as Href} asChild>
            <TabButton icon="cuentas">Cuentas</TabButton>
          </TabTrigger>
          <TabTrigger name="historial" href="/historial" asChild>
            <TabButton icon="historial">Historial</TabButton>
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

export function TabButton({
  icon,
  children,
  isFocused,
  ...props
}: TabTriggerSlotProps & { icon: TabIcon }) {
  const variant = useContext(NavChromeContext);
  const pathname = usePathname();
  const focused =
    icon === "cuentas"
      ? pathname === "/cuentas" || pathname.startsWith("/cuentas/")
      : Boolean(isFocused);

  if (variant === "bottom") {
    return (
      <Pressable
        {...props}
        accessibilityRole="link"
        className="min-w-0 flex-1 items-center gap-1 py-1"
        style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
      >
        <Ionicons
          name={TAB_ICONS[icon]}
          size={24}
          color={focused ? palette.celeste : palette.chromeMuted}
        />
        <Text
          numberOfLines={1}
          className={
            focused
              ? "text-[12px] font-semibold text-white"
              : "text-[12px] font-medium text-chrome-muted"
          }
        >
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
          borderLeftColor: focused ? palette.celeste : "transparent",
          backgroundColor: focused ? palette.chromeActive : "transparent",
          paddingLeft: 17,
        },
        pressed ? { opacity: 0.7 } : undefined,
      ]}
    >
      <Ionicons
        name={TAB_ICONS[icon]}
        size={20}
        color={focused ? palette.celeste : palette.chromeMuted}
      />
      <Text
        className={
          focused
            ? "text-[15px] font-medium text-white"
            : "text-[15px] font-medium text-chrome-muted"
        }
      >
        {children}
      </Text>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const { children, style: listStyle, ...rest } = props;
  const { role, setRole, signOut, snapshot } = useLedger();
  const wide = useWindowDimensions().width >= wideLayout;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const pageTitle =
    bettorPageTitle(pathname, snapshot.bettors) ??
    PAGE_TITLES[pathname] ??
    "HippoPro";

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
        ]}
      >
        {wide ? (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: sidebarWidth,
              backgroundColor: palette.navy,
              borderRightWidth: 1,
              borderRightColor: palette.chromeActive,
              pointerEvents: "auto",
            }}
          >
            <View
              style={{
                paddingHorizontal: 20,
                paddingVertical: 24,
                borderBottomWidth: 1,
                borderBottomColor: palette.chromeActive,
              }}
            >
              <Brand />
            </View>
            <Text
              className="px-5 pb-1 pt-3 text-[10px] font-semibold uppercase text-chrome-muted"
              style={{ letterSpacing: 1.5 }}
            >
              Agencia
            </Text>
            {children}
          </View>
        ) : null}

        <View
          style={[
            wide ? { position: "absolute" } : pinnedToViewport,
            {
              top: 0,
              left: wide ? sidebarWidth : 0,
              right: 0,
              height: wide ? desktopTopbarHeight : mobileBarHeight,
              backgroundColor: palette.navy,
              borderBottomWidth: 1,
              borderBottomColor: palette.chromeActive,
              justifyContent: "center",
              paddingHorizontal: 16,
              pointerEvents: "auto",
            },
          ]}
        >
          <View className="flex-row items-center justify-between gap-3">
            {wide ? (
              <Text
                className="font-serif text-[22px] text-white"
                numberOfLines={1}
              >
                {pageTitle}
              </Text>
            ) : (
              <Brand compact />
            )}
            {signOut ? (
              <AccountMenu role={role} onSignOut={signOut} />
            ) : (
              <RoleSwitch role={role} onChange={setRole} />
            )}
          </View>
        </View>

        {wide ? null : (
          <View
            style={[
              pinnedToViewport,
              {
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 20,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: palette.navy,
                borderTopWidth: 1,
                borderTopColor: palette.chromeActive,
                paddingTop: 8,
                paddingBottom: Math.max(8, insets.bottom),
                paddingHorizontal: 4,
                pointerEvents: "auto",
              },
            ]}
          >
            {children}
          </View>
        )}
      </View>
    </NavChromeContext.Provider>
  );
}

const mark = require("../../assets/images/brand-mark.png");

function Brand({ compact = false }: { compact?: boolean }) {
  const size = compact ? 40 : 52;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        flexShrink: 1,
      }}
    >
      <Image
        source={mark}
        contentFit="contain"
        accessibilityLabel="HippoPro"
        style={{ height: size, width: size, borderRadius: 12 }}
      />
      <View style={{ flexShrink: 1 }}>
        <Text
          className="text-white"
          numberOfLines={1}
          style={{ fontFamily: "DMSans_700Bold", fontSize: compact ? 18 : 20, letterSpacing: -0.4 }}
        >
          Hippo
          <Text style={{ color: palette.brand }}>Pro</Text>
        </Text>
        <Text className="text-[11px] text-chrome-muted" numberOfLines={1}>
          Agencia Dolores
        </Text>
      </View>
    </View>
  );
}

function AccountMenu({
  role,
  onSignOut,
}: {
  role: ViewerRole;
  onSignOut: () => void;
}) {
  const label = role === "owner" ? "Dueño" : "Operador";
  return (
    <View className="flex-row items-center gap-2">
      <View className="rounded-md bg-chrome-active px-3 py-1.5">
        <Text className="text-[13px] font-semibold text-white">{label}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Salir"
        onPress={onSignOut}
        className="rounded-md px-2 py-1.5"
      >
        <Text className="text-[13px] font-semibold text-white">Salir</Text>
      </Pressable>
    </View>
  );
}

function RoleSwitch({
  role,
  onChange,
}: {
  role: ViewerRole;
  onChange: (role: ViewerRole) => void;
}) {
  return (
    <View className="flex-row rounded-lg bg-chrome-active p-0.5">
      <RoleOption
        label="Dueño"
        selected={role === "owner"}
        onPress={() => onChange("owner")}
      />
      <RoleOption
        label="Operador"
        selected={role === "operator"}
        onPress={() => onChange("operator")}
      />
    </View>
  );
}

function RoleOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={
        selected
          ? "rounded-md bg-celeste px-3 py-1.5"
          : "rounded-md px-3 py-1.5"
      }
    >
      <Text
        className={
          selected
            ? "text-[13px] font-semibold text-navy"
            : "text-[13px] text-chrome-muted"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
