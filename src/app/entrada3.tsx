import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import Head from "expo-router/head";
import { useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";

import {
  BenefitRow,
  ENTRY_COPY,
  ENTRY_PLANS,
  ENTRY_PREVIEW_COUNT,
  EntryHeader,
  entryBody,
  type EntryPlan,
} from "@/components/entry-shared";
import { wideLayout } from "@/constants/layout";
import { palette } from "@/constants/palette";
import { formatCents } from "@/modules/ledger";

/** Sample figures for the preview card. Shown as written; nothing is calculated here. */
const RACING_SAMPLE = {
  track: "Reunión de ejemplo",
  soldCents: 245_000_000,
  cancelledCents: 15_000_000,
  netCents: 230_000_000,
  commissionCents: 28_750_000,
  depositCents: 201_250_000,
};

const LOTTERY_SAMPLE = [
  { name: "Quiniela", soldCents: 80_000_000, commissionCents: 16_000_000, depositCents: 64_000_000 },
  { name: "Plus", soldCents: 40_000_000, commissionCents: 8_000_000, depositCents: 32_000_000 },
  { name: "Telekino", soldCents: 20_000_000, commissionCents: 3_000_000, depositCents: 17_000_000 },
];

export default function ProductEntryScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= wideLayout;
  const [key, setKey] = useState(ENTRY_PLANS[0]?.key ?? "racing");
  const plan = ENTRY_PLANS.find((item) => item.key === key) ?? ENTRY_PLANS[0];

  if (!plan) {
    return null;
  }

  return (
    <LinearGradient colors={[palette.mist, palette.wash]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }}>
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }} style={{ backgroundColor: "transparent" }}>
        <Head>
          <title>HippoPro · El día, a la vista</title>
        </Head>
        <EntryHeader wide={wide} />
        <View style={{ paddingHorizontal: wide ? 40 : 16, paddingTop: wide ? 48 : 28, paddingBottom: wide ? 48 : 28 }}>
          <View style={{ width: "100%", maxWidth: 1100, alignSelf: "center", gap: wide ? 40 : 28 }}>
            <View style={{ alignItems: "center", gap: 22 }}>
              <Text
                className="text-center text-deep"
                style={{ fontFamily: "PlayfairDisplay_700Bold", fontSize: wide ? 48 : 32, lineHeight: wide ? 56 : 38 }}
              >
                {ENTRY_COPY.title}
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {ENTRY_PLANS.map((item) => (
                  <PlanTab key={item.key} plan={item} selected={item.key === plan.key} onPress={() => setKey(item.key)} />
                ))}
              </View>
            </View>
            <View style={{ flexDirection: wide ? "row" : "column", gap: wide ? 40 : 28, alignItems: "stretch" }}>
              <ProductCopy plan={plan} />
              <SampleCard plan={plan} />
            </View>
            <Text className="text-center text-[14px] text-caption" style={{ fontFamily: entryBody }}>
              HippoPro · hippopro.com.ar
            </Text>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function PlanTab({ plan, selected, onPress }: { plan: EntryPlan; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 999,
        paddingHorizontal: 22,
        paddingVertical: 12,
        backgroundColor: selected ? plan.colors.navy : palette.paper,
        borderWidth: 1,
        borderColor: selected ? plan.colors.navy : palette.hairline,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? "white" : plan.colors.navy,
          fontFamily: "DMSans_600SemiBold",
          fontSize: 16,
        }}
      >
        {plan.name}
      </Text>
    </Pressable>
  );
}

function ProductCopy({ plan }: { plan: EntryPlan }) {
  const colors = plan.colors;

  return (
    <View style={{ flex: 1, gap: 18 }}>
      <View style={{ gap: 8 }}>
        <MaterialCommunityIcons name={plan.icon} size={40} color={colors.accent} />
        <Text
          style={{
            color: colors.accent,
            fontFamily: "DMSans_600SemiBold",
            fontSize: 14,
            letterSpacing: 1.6,
            textTransform: "uppercase",
          }}
        >
          {plan.kicker}
        </Text>
        <Text style={{ color: colors.navy, fontFamily: "PlayfairDisplay_700Bold", fontSize: 44, lineHeight: 50 }}>
          {plan.name}
        </Text>
        <Text style={{ color: palette.slate, fontFamily: entryBody, fontSize: 18, lineHeight: 26 }}>{plan.tagline}</Text>
      </View>
      <View style={{ gap: 12 }}>
        {plan.benefits.slice(0, ENTRY_PREVIEW_COUNT).map((benefit) => (
          <BenefitRow key={benefit} text={benefit} check={colors.accent} ink={colors.ink} />
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => ({
          marginTop: 8,
          backgroundColor: colors.accent,
          borderRadius: 12,
          paddingVertical: 16,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ color: "white", fontFamily: "DMSans_600SemiBold", fontSize: 17 }}>{plan.cta}</Text>
        <Ionicons name="arrow-forward" size={18} color="white" />
      </Pressable>
    </View>
  );
}

function SampleCard({ plan }: { plan: EntryPlan }) {
  const colors = plan.colors;

  return (
    <View style={{ flex: 1, gap: 10 }}>
      <Text
        style={{
          color: palette.caption,
          fontFamily: "DMSans_600SemiBold",
          fontSize: 13,
          letterSpacing: 1.4,
          textTransform: "uppercase",
        }}
      >
        Ejemplo
      </Text>
      <View className="border border-hairline bg-paper" style={{ borderRadius: 20, padding: 24, gap: 14 }}>
        <Text style={{ color: colors.navy, fontFamily: "DMSans_600SemiBold", fontSize: 24 }}>Cálculo del día</Text>
        {plan.key === "lottery" ? <LotterySample colors={colors} /> : <RacingSample colors={colors} />}
      </View>
    </View>
  );
}

function RacingSample({ colors }: { colors: EntryPlan["colors"] }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ color: palette.slate, fontFamily: entryBody, fontSize: 16 }}>Hipódromo</Text>
        <Text style={{ color: colors.ink, fontFamily: "DMSans_600SemiBold", fontSize: 16 }}>{RACING_SAMPLE.track}</Text>
      </View>
      <MoneyLine label="Vendido" cents={RACING_SAMPLE.soldCents} />
      <MoneyLine label="Cancelados" cents={RACING_SAMPLE.cancelledCents} />
      <MoneyLine label="Neto" cents={RACING_SAMPLE.netCents} />
      <MoneyLine label="Comisión" cents={RACING_SAMPLE.commissionCents} />
      <View className="bg-hairline" style={{ height: 1 }} />
      <MoneyLine label="A depositar" cents={RACING_SAMPLE.depositCents} emphasis={colors.navy} />
    </View>
  );
}

function LotterySample({ colors }: { colors: EntryPlan["colors"] }) {
  return (
    <View style={{ gap: 16 }}>
      {LOTTERY_SAMPLE.map((game) => (
        <View key={game.name} style={{ gap: 8 }}>
          <Text style={{ color: colors.navy, fontFamily: "DMSans_700Bold", fontSize: 17 }}>{game.name}</Text>
          <MoneyLine label="Vendido" cents={game.soldCents} />
          <MoneyLine label="Comisión" cents={game.commissionCents} />
          <MoneyLine label="A depositar" cents={game.depositCents} emphasis={colors.navy} />
        </View>
      ))}
    </View>
  );
}

function MoneyLine({ label, cents, emphasis }: { label: string; cents: number; emphasis?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ color: emphasis ?? palette.slate, fontFamily: emphasis ? "DMSans_600SemiBold" : entryBody, fontSize: 16 }}>
        {label}
      </Text>
      <Text
        style={{
          color: emphasis ?? palette.ink,
          fontFamily: "DMSans_600SemiBold",
          fontSize: emphasis ? 18 : 16,
          fontVariant: ["tabular-nums"],
        }}
      >
        {formatCents(cents)}
      </Text>
    </View>
  );
}
