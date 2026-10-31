import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import type { Href } from "expo-router";
import { router } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import { wideLayout } from "@/constants/layout";
import { usePalette } from "@/constants/palette";

export type WelcomeKind = "racing" | "lottery";

const ICON = { racing: "horse-variant", lottery: "ticket-confirmation" } as const;

/** The step bar's id, so a new step can scroll back to it. */
export const WELCOME_TOP_ID = "bienvenida";

/** Gradient with the big horse (or ticket) watermark, as on the entry page. */
function BrandPanel({ kind, padding, children }: { kind: WelcomeKind; padding: number; children: ReactNode }) {
  const colors = usePalette();
  const wide = useWindowDimensions().width >= wideLayout;
  return (
    <LinearGradient
      colors={[colors.navy, colors.chromeActive]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 18, overflow: "hidden", padding }}
    >
      <MaterialCommunityIcons
        name={ICON[kind]}
        size={wide ? 220 : 150}
        color={colors.celeste}
        style={{ position: "absolute", right: wide ? -20 : -30, bottom: wide ? -40 : -30, opacity: 0.16 }}
      />
      {children}
    </LinearGradient>
  );
}

/** First impression, only on the first step. The step bar below says where the owner is. */
export function WelcomeHero({
  kind,
  agencyName,
  onPostpone,
}: {
  kind: WelcomeKind;
  agencyName: string;
  onPostpone?: () => void;
}) {
  const wide = useWindowDimensions().width >= wideLayout;
  const name = agencyName.trim();
  return (
    <BrandPanel kind={kind} padding={wide ? 36 : 22}>
      <View className="gap-4" style={{ maxWidth: 720 }}>
        <Text className="text-[13px] font-semibold uppercase text-celeste" style={{ letterSpacing: 1.6 }}>
          Bienvenido a HippoPro
        </Text>
        <Text className="font-serif text-white" style={{ fontSize: wide ? 40 : 30, lineHeight: wide ? 48 : 37 }}>
          {name ? `${name}, empieza una nueva etapa.` : "Empieza una nueva etapa."}
        </Text>
        <Text className="text-tint" style={{ fontSize: wide ? 21 : 19, lineHeight: wide ? 30 : 27 }}>
          En tres pasos tu cuenta queda lista y cada peso de la agencia, a la vista.
        </Text>
      </View>
      {onPostpone ? (
        <Pressable accessibilityRole="button" onPress={onPostpone} className="mt-5 cursor-pointer self-end">
          <Text className="text-[15px] font-semibold text-celeste underline">Prefiero mirar la app primero</Text>
        </Pressable>
      ) : null}
    </BrandPanel>
  );
}

export function WelcomeReminder({ kind, onStart }: { kind: WelcomeKind; onStart: () => void }) {
  const colors = usePalette();
  return (
    <Pressable accessibilityRole="button" onPress={onStart} className="cursor-pointer">
      <BrandPanel kind={kind} padding={18}>
        <View className="flex-row items-center gap-3">
          <View className="flex-1 gap-1 pr-10">
            <Text className="text-[17px] font-semibold text-white">Tu cuenta todavía no arrancó</Text>
            <Text className="text-[15px] leading-5 text-tint">Cargá tu estado de cuenta inicial y empezá con todo en orden.</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={34} color={colors.celeste} />
        </View>
      </BrandPanel>
    </Pressable>
  );
}

type NextStep = { icon: ComponentProps<typeof Ionicons>["name"]; title: string; detail: string; onPress: () => void };

export function WelcomeCelebration({
  kind,
  agencyName,
  onClose,
}: {
  kind: WelcomeKind;
  agencyName: string;
  onClose: () => void;
}) {
  const colors = usePalette();
  const wide = useWindowDimensions().width >= wideLayout;
  const name = agencyName.trim() || "Tu agencia";
  const steps: NextStep[] = [
    {
      icon: "create-outline",
      title: "Cargá tu primer día",
      detail: "Lo vendido, lo pagado y la comisión, calculada sola.",
      onPress: () => router.push((kind === "racing" ? "/carga" : "/carga-dia") as Href),
    },
    {
      icon: "cash-outline",
      title: "Registrá un depósito",
      detail: kind === "racing" ? "El saldo con cada hipódromo baja al instante." : "El saldo con la lotería baja al instante.",
      onPress: () => router.push((kind === "racing" ? "/depositos" : "/quiniela/depositos") as Href),
    },
    {
      icon: "home-outline",
      title: "Mirá tu Inicio",
      detail: "Venta neta, comisión y lo que debés, en un vistazo.",
      onPress: onClose,
    },
  ];
  return (
    <View className="items-center gap-4 rounded-[18px] border border-line bg-card p-6">
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <View className="h-20 w-20 items-center justify-center rounded-full bg-accent">
            <Ionicons name="checkmark" size={46} color={colors.card} />
          </View>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={{ alignItems: "center", gap: 16 }}>
          <Text className="text-center font-serif text-navy" style={{ fontSize: wide ? 34 : 28, lineHeight: wide ? 42 : 35 }}>
            ¡Listo! {name} ya está en HippoPro.
          </Text>
          <Text className="max-w-[560px] text-center text-[17px] leading-6 text-ink">
            {kind === "racing"
              ? "Desde hoy la cuenta con cada hipódromo se hace sola."
              : "Desde hoy la cuenta con la lotería se hace sola."}
          </Text>
        </Animated.View>
        <View className={`w-full gap-3 ${wide ? "flex-row" : ""}`} style={{ maxWidth: 960 }}>
          {steps.map((step, index) => (
            <Animated.View
              key={step.title}
              entering={FadeInDown.delay(350 + index * 80).duration(350)}
              style={wide ? { flex: 1 } : undefined}
            >
            <Pressable
              accessibilityRole="button"
              onPress={step.onPress}
              className={`cursor-pointer gap-2 rounded-[14px] border p-4 ${wide ? "flex-1" : ""} ${
                index === 0 ? "border-accent bg-tint" : "border-line bg-card"
              }`}
            >
              <View className="flex-row items-center justify-between">
                <Ionicons name={step.icon} size={26} color={colors.accent} />
                <Ionicons name="arrow-forward" size={18} color={colors.accent} />
              </View>
              <Text className="text-[17px] font-semibold text-navy">{step.title}</Text>
              <Text className="text-[15px] leading-5 text-muted">{step.detail}</Text>
            </Pressable>
            </Animated.View>
          ))}
        </View>
    </View>
  );
}
