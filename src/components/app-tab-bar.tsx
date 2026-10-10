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
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, Platform, Pressable, Text, useWindowDimensions, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  desktopTopbarHeight,
  mobileBarHeight,
  sidebarRailWidth,
  sidebarWidth,
  wideLayout,
} from "@/constants/layout";
import { palette } from "@/constants/palette";
import { AgenciesPanel } from "@/components/agencies-panel";
import { ConfirmDialog, Dialog, SecondaryButton } from "@/components/form-controls";
import { OperatorsPanel } from "@/components/operators-panel";
import { SidebarContext } from "@/components/sidebar-menu";
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
  const [collapsed, setCollapsed] = useState(false);
  const [railOnly, setRailOnly] = useState(false);
  const width = useRef(new Animated.Value(sidebarWidth)).current;
  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      if (!next) {
        setRailOnly(false);
      }
      Animated.timing(width, {
        toValue: next ? sidebarRailWidth : sidebarWidth,
        duration: 200,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished && next) {
          setRailOnly(true);
        }
      });
      return next;
    });
  }, [width]);

  return (
    <SidebarContext.Provider value={{ collapsed, railOnly, toggle, width }}>
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
    </SidebarContext.Provider>
  );
}

export function TabButton({
  icon,
  children,
  isFocused,
  ...props
}: TabTriggerSlotProps & { icon: TabIcon }) {
  const variant = useContext(NavChromeContext);
  const { collapsed } = useContext(SidebarContext);
  const iconOnly = variant === "sidebar" && collapsed;
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
              ? "text-[14px] font-semibold text-white"
              : "text-[14px] font-medium text-chrome-muted"
          }
        >
          {children}
        </Text>
      </Pressable>
    );
  }

  const label = typeof children === "string" ? children : undefined;

  return (
    <Pressable
      {...props}
      accessibilityRole="link"
      accessibilityLabel={label}
      className={
        iconOnly
          ? "w-full items-center justify-center py-3"
          : "w-full flex-row items-center gap-2.5 py-3 pr-5"
      }
      style={({ pressed }) => [
        {
          borderLeftWidth: 3,
          borderLeftColor: focused ? palette.celeste : "transparent",
          backgroundColor: focused ? palette.chromeActive : "transparent",
          paddingLeft: iconOnly ? 0 : 17,
        },
        pressed ? { opacity: 0.7 } : undefined,
      ]}
    >
      <Ionicons
        name={TAB_ICONS[icon]}
        size={iconOnly ? 22 : 20}
        color={focused ? palette.celeste : palette.chromeMuted}
      />
      {iconOnly ? null : (
        <Text
          className={
            focused
              ? "text-[17px] font-medium text-white"
              : "text-[17px] font-medium text-chrome-muted"
          }
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const { children, style: listStyle, ...rest } = props;
  const { role, displayName, agencyName, userId, canInviteOwners, canCreateAgencies, setRole, signOut, snapshot, readOnly } = useLedger();
  const [operatorsOpen, setOperatorsOpen] = useState(false);
  const [agenciesOpen, setAgenciesOpen] = useState(false);
  const wide = useWindowDimensions().width >= wideLayout;
  const { collapsed, railOnly, toggle, width } = useContext(SidebarContext);
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
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width,
              overflow: "hidden",
              backgroundColor: palette.navy,
              borderRightWidth: 1,
              borderRightColor: palette.chromeActive,
              pointerEvents: "auto",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                height: desktopTopbarHeight,
                justifyContent: railOnly ? "center" : "space-between",
                paddingHorizontal: railOnly ? 0 : 16,
                gap: 8,
                borderBottomWidth: 1,
                borderBottomColor: palette.chromeActive,
              }}
            >
              {railOnly ? null : (
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Brand />
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={collapsed ? "Abrir menú" : "Cerrar menú"}
                onPress={toggle}
                className="h-9 w-9 cursor-pointer items-center justify-center">
                <Ionicons
                  name={collapsed ? "chevron-forward" : "chevron-back"}
                  size={22}
                  color="white"
                />
              </Pressable>
            </View>
            <AgencyBlock name={agencyName} railOnly={railOnly} />
            {children}
          </Animated.View>
        ) : null}

        <Animated.View
          style={[
            wide ? { position: "absolute" } : pinnedToViewport,
            {
              top: 0,
              left: wide ? width : 0,
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
              <Text className="min-w-0 flex-1 font-serif text-[24px] text-white" numberOfLines={1}>
                {pageTitle}
              </Text>
            ) : (
              <Brand compact agencyName={agencyName} />
            )}
            {signOut ? (
              <AccountMenu
                role={role}
                displayName={displayName}
                onSignOut={signOut}
                onOpenOperators={role === "owner" && !readOnly ? () => setOperatorsOpen(true) : null}
                onOpenAgencies={canCreateAgencies && !readOnly ? () => setAgenciesOpen(true) : null}
              />
            ) : (
              <RoleSwitch role={role} onChange={setRole} />
            )}
          </View>
        </Animated.View>

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
      <OperatorsPanel
        visible={operatorsOpen}
        onClose={() => setOperatorsOpen(false)}
        canInviteOwners={canInviteOwners}
        userId={userId}
      />
      <AgenciesPanel visible={agenciesOpen} onClose={() => setAgenciesOpen(false)} />
    </NavChromeContext.Provider>
  );
}

function agencyInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

const mark = require("../../assets/images/brand-mark.png");

function Brand({ compact = false, agencyName = "" }: { compact?: boolean; agencyName?: string }) {
  const size = compact ? 40 : 52;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? 10 : 24,
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
          style={{ fontFamily: "DMSans_700Bold", fontSize: compact ? 20 : 22, letterSpacing: -0.4 }}
        >
          Hippo
          <Text style={{ color: palette.brand }}>Pro</Text>
        </Text>
        {compact && agencyName ? (
          <Text className="text-[13px] text-chrome-muted" numberOfLines={1}>
            {agencyName}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function AgencyBlock({ name, railOnly }: { name: string; railOnly: boolean }) {
  if (railOnly) {
    return (
      <View style={{ alignItems: "center", paddingTop: 12 }}>
        <View
          accessibilityLabel={name}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: palette.chromeActive,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "white", fontFamily: "DMSans_600SemiBold", fontSize: 14 }}>
            {agencyInitials(name)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={name}
      style={{
        marginHorizontal: 12,
        marginTop: 12,
        marginBottom: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: palette.chromeActive,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Ionicons name="storefront" size={20} color={palette.celeste} />
      <Text
        style={{
          flex: 1,
          minWidth: 0,
          color: "white",
          fontFamily: "DMSans_600SemiBold",
          fontSize: 17,
        }}
        numberOfLines={2}
      >
        {name}
      </Text>
    </View>
  );
}

function AccountMenu({
  role,
  displayName,
  onSignOut,
  onOpenOperators,
  onOpenAgencies,
}: {
  role: ViewerRole;
  displayName: string;
  onSignOut: () => void;
  onOpenOperators: (() => void) | null;
  onOpenAgencies: (() => void) | null;
}) {
  const [open, setOpen] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const roleLabel = role === "owner" ? "Dueño" : "Operador";
  const label = displayName.trim() ? `${displayName.trim()} · ${roleLabel}` : roleLabel;

  function askSignOut() {
    setOpen(false);
    setConfirmingExit(true);
  }

  const confirmExit = (
    <ConfirmDialog
      visible={confirmingExit}
      title="¿Salir?"
      confirmLabel="Salir"
      onCancel={() => setConfirmingExit(false)}
      onConfirm={() => {
        setConfirmingExit(false);
        onSignOut();
      }}
    />
  );

  if (onOpenOperators || onOpenAgencies) {
    const pick = (action: () => void) => {
      setOpen(false);
      action();
    };
    return (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cuenta"
          onPress={() => setOpen(true)}
          className="min-w-0 flex-row items-center gap-1.5 rounded-md bg-chrome-active px-3 py-1.5"
          style={{ flexShrink: 1 }}
        >
          <Text className="text-[15px] font-semibold text-white" numberOfLines={1} style={{ flexShrink: 1 }}>
            {label}
          </Text>
          <Ionicons name="chevron-down" size={16} color="white" />
        </Pressable>
        <Dialog visible={open} title={label} onClose={() => setOpen(false)}>
          <View className="gap-3">
            {onOpenOperators ? <SecondaryButton label="Operadores" onPress={() => pick(onOpenOperators)} /> : null}
            {onOpenAgencies ? <SecondaryButton label="Agencias" onPress={() => pick(onOpenAgencies)} /> : null}
            <SecondaryButton label="Salir" onPress={askSignOut} />
          </View>
        </Dialog>
        {confirmExit}
      </>
    );
  }

  return (
    <>
      <View className="min-w-0 flex-row items-center gap-2" style={{ flexShrink: 1 }}>
        <View className="min-w-0 rounded-md bg-chrome-active px-3 py-1.5">
          <Text className="text-[15px] font-semibold text-white" numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salir"
          onPress={askSignOut}
          className="rounded-md px-2 py-1.5"
        >
          <Text className="text-[15px] font-semibold text-white">Salir</Text>
        </Pressable>
      </View>
      {confirmExit}
    </>
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
            ? "text-[15px] font-semibold text-navy"
            : "text-[15px] text-chrome-muted"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
