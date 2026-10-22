import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import Head from "expo-router/head";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";

import {
  BenefitRow,
  BothBanner,
  ENTRY_COPY,
  ENTRY_PLANS,
  ENTRY_PREVIEW_COUNT,
  EntryHeader,
  EntryHero,
  entryBody,
  type EntryPlan,
} from "@/components/entry-shared";
import { wideLayout } from "@/constants/layout";
import { palette } from "@/constants/palette";

export default function SplitEntryScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= wideLayout;

  return (
    <LinearGradient colors={[palette.mist, palette.wash]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }}>
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }} style={{ backgroundColor: "transparent" }}>
        <Head>
          <title>HippoPro · Hípica y Lotería</title>
        </Head>
        <EntryHeader wide={wide} />
        <View style={{ paddingHorizontal: wide ? 40 : 16, paddingTop: wide ? 48 : 28, paddingBottom: wide ? 40 : 24 }}>
          <EntryHero wide={wide} />
        </View>
        <View>
          <View style={{ flexDirection: wide ? "row" : "column", alignItems: "stretch" }}>
            {ENTRY_PLANS.map((plan) => (
              <SplitHalf key={plan.key} plan={plan} wide={wide} />
            ))}
          </View>
          <View
            style={{
              marginTop: -36,
              paddingHorizontal: wide ? 40 : 16,
              paddingBottom: wide ? 28 : 16,
              zIndex: 1,
            }}
          >
            <View style={{ width: "100%", maxWidth: 1200, alignSelf: "center" }}>
              <BothBanner wide={wide} />
            </View>
          </View>
        </View>
        <Text
          className="text-center text-[14px] text-caption"
          style={{ fontFamily: entryBody, paddingBottom: wide ? 32 : 20 }}
        >
          HippoPro · hippopro.com.ar
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

function SplitHalf({ plan, wide }: { plan: EntryPlan; wide: boolean }) {
  const colors = plan.colors;
  const headerColors =
    plan.key === "lottery"
      ? ([colors.navy, colors.accent] as const)
      : ([palette.deep, colors.navy] as const);

  return (
    <LinearGradient
      colors={headerColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: wide ? 1 : undefined, paddingHorizontal: wide ? 48 : 20, paddingTop: wide ? 56 : 36, paddingBottom: 72 }}
    >
      <View style={{ width: "100%", maxWidth: 520, alignSelf: wide ? "center" : "stretch", gap: 20 }}>
        <MaterialCommunityIcons name={plan.icon} size={wide ? 72 : 56} color="white" />
        <View style={{ gap: 6 }}>
          <Text
            style={{
              color: colors.celeste,
              fontFamily: "DMSans_600SemiBold",
              fontSize: 14,
              letterSpacing: 1.6,
              textTransform: "uppercase",
            }}
          >
            {plan.kicker}
          </Text>
          <Text style={{ color: "white", fontFamily: "PlayfairDisplay_700Bold", fontSize: wide ? 52 : 40, lineHeight: wide ? 58 : 46 }}>
            {plan.name}
          </Text>
        </View>
        <Text style={{ color: palette.tint, fontFamily: entryBody, fontSize: 18, lineHeight: 26 }}>{plan.tagline}</Text>
        <View style={{ gap: 12, marginTop: 8 }}>
          {plan.benefits.slice(0, ENTRY_PREVIEW_COUNT).map((benefit) => (
            <BenefitRow key={benefit} text={benefit} check="white" ink="white" />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginTop: 8,
            backgroundColor: "white",
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
          <Text style={{ color: palette.deep, fontFamily: "DMSans_600SemiBold", fontSize: 17 }}>{plan.cta}</Text>
          <Ionicons name="arrow-forward" size={18} color={palette.deep} />
        </Pressable>
      </View>
    </LinearGradient>
  );
}
