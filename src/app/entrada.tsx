import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import Head from "expo-router/head";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";

import {
  BothBanner,
  ENTRY_COPY,
  ENTRY_PLANS,
  EntryHeader,
  EntryHero,
  BenefitRow,
  entryBody,
  type EntryPlan,
} from "@/components/entry-shared";
import { wideLayout } from "@/constants/layout";
import { palette } from "@/constants/palette";

export default function EntryScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= wideLayout;

  return (
    <LinearGradient colors={[palette.mist, palette.wash]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }}>
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }} style={{ backgroundColor: "transparent" }}>
        <Head>
          <title>HippoPro · Agencias hípicas y de lotería</title>
        </Head>
        <EntryHeader wide={wide} />
        <View style={{ paddingHorizontal: wide ? 40 : 16, paddingTop: wide ? 32 : 16, paddingBottom: wide ? 40 : 24 }}>
          <View
            className="border border-hairline bg-paper"
            style={{
              width: "100%",
              maxWidth: 1200,
              alignSelf: "center",
              borderRadius: 28,
              overflow: wide ? "visible" : "hidden",
              paddingHorizontal: wide ? 32 : 16,
              paddingTop: wide ? 56 : 32,
              paddingBottom: wide ? 64 : 40,
              gap: wide ? 40 : 28,
            }}
          >
            <EntryHero wide={wide} />
            <View
              className="border border-hairline bg-paper"
              style={{
                borderRadius: wide ? 28 : 22,
                padding: wide ? 24 : 0,
                gap: wide ? 24 : 16,
                overflow: wide ? "visible" : "hidden",
              }}
            >
              <View
                style={{
                  flexDirection: wide ? "row" : "column",
                  flexWrap: "nowrap",
                  width: wide ? "100%" : undefined,
                  gap: wide ? 24 : 16,
                  alignItems: "stretch",
                }}
              >
                {ENTRY_PLANS.map((plan) => (
                  <PlanCard key={plan.key} plan={plan} wide={wide} />
                ))}
              </View>
              <View style={{ paddingHorizontal: wide ? 0 : 12, paddingBottom: wide ? 0 : 12 }}>
                <BothBanner wide={wide} />
              </View>
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

function PlanCard({ plan, wide }: { plan: EntryPlan; wide: boolean }) {
  const colors = plan.colors;
  const pad = wide ? 28 : 20;
  const headerColors =
    plan.key === "lottery"
      ? ([colors.navy, colors.accent] as const)
      : ([palette.deep, colors.navy] as const);

  return (
    <LinearGradient
      colors={headerColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{
        flexGrow: wide ? 1 : undefined,
        flexShrink: wide ? 1 : undefined,
        flexBasis: wide ? 0 : undefined,
        minWidth: wide ? 0 : undefined,
        borderRadius: wide ? 24 : 0,
        overflow: "hidden",
        padding: pad,
        gap: 22,
      }}
    >
      <View style={{ gap: 16, overflow: "hidden" }}>
        <MaterialCommunityIcons
          name={plan.icon}
          size={wide ? 190 : 150}
          color={colors.chromeActive}
          style={{ position: "absolute", right: -28, bottom: -34, opacity: 0.55 }}
        />
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: palette.deep,
            borderWidth: 1,
            borderColor: colors.celeste,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons name={plan.icon} size={30} color={colors.celeste} />
        </View>
        <View style={{ gap: 2 }}>
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
          <Text style={{ color: "white", fontFamily: "PlayfairDisplay_700Bold", fontSize: wide ? 40 : 34 }}>
            {plan.name}
          </Text>
        </View>
        <Text style={{ color: colors.tint, fontFamily: entryBody, fontSize: 17, lineHeight: 25, maxWidth: 420 }}>
          {plan.tagline}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {plan.highlights.map((highlight) => (
            <View
              key={highlight}
              className="bg-deep"
              style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}
            >
              <Text style={{ color: colors.celeste, fontFamily: "DMSans_600SemiBold", fontSize: 13 }}>
                {highlight}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ flex: 1, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text
            style={{
              color: "white",
              fontFamily: "DMSans_600SemiBold",
              fontSize: 13,
              letterSpacing: 1.4,
              textTransform: "uppercase",
            }}
          >
            {ENTRY_COPY.includes}
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: "white", opacity: 0.35 }} />
        </View>
        <View style={{ gap: 12 }}>
          {plan.benefits.map((benefit) => (
            <BenefitRow key={benefit} text={benefit} check="white" ink="white" />
          ))}
        </View>
        <View style={{ marginTop: "auto", paddingTop: 12, gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => ({
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
          <Text className="text-center text-[14px]" style={{ color: colors.celeste, fontFamily: entryBody }}>
            {ENTRY_COPY.note}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}
