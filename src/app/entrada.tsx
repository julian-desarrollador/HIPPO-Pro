import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import Head from "expo-router/head";
import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";

import { AccountLink, EntryAccount, type EntryPanel } from "@/components/entry-account";
import { FaqList } from "@/components/faq-list";
import { SupportQuestionForm } from "@/components/support-question-form";

import {
  BothBanner,
  ENTRY_COPY,
  ENTRY_PLANS,
  ENTRY_PREVIEW_COUNT,
  EntryHeader,
  EntryHero,
  BenefitRow,
  PlanPicker,
  entryBody,
  planGradient,
  type EntryPlan,
} from "@/components/entry-shared";
import { wideLayout } from "@/constants/layout";
import { palette } from "@/constants/palette";

export default function EntryScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= wideLayout;
  const [panel, setPanel] = useState<EntryPanel | null>(null);
  const [scrollToken, setScrollToken] = useState(0);

  function openPanel(next: EntryPanel) {
    setPanel(next);
    setScrollToken((current) => current + 1);
  }

  useEffect(() => {
    if (!panel || Platform.OS !== "web" || typeof document === "undefined") {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const form = document.getElementById("entrada-form");
      if (!form) {
        return;
      }
      form.style.scrollMarginTop = "16px";
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      const field = form.querySelector("input");
      if (field instanceof HTMLElement) {
        field.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [panel, scrollToken]);

  const signupPanel = panel === "racing" || panel === "lottery" ? panel : null;

  return (
    <LinearGradient colors={[palette.mist, palette.wash]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }}>
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }} style={{ backgroundColor: "transparent" }}>
        <Head>
          <title>HippoPro · Agencias hípicas y de lotería</title>
        </Head>
        <EntryHeader wide={wide} onSignIn={() => openPanel("sign-in")} />
        <View style={{ paddingHorizontal: wide ? 40 : 16, paddingTop: wide ? 32 : 20, paddingBottom: wide ? 40 : 28 }}>
          <View
            className={wide ? "border border-hairline bg-paper" : undefined}
            style={{
              width: "100%",
              maxWidth: 1200,
              alignSelf: "center",
              borderRadius: wide ? 28 : 0,
              paddingHorizontal: wide ? 32 : 0,
              paddingTop: wide ? 56 : 0,
              paddingBottom: wide ? 64 : 0,
              gap: wide ? 40 : 24,
            }}
          >
            <EntryHero wide={wide} />
            <PlanPicker
              plans={ENTRY_PLANS}
              wide={wide}
              selected={signupPanel}
              onPick={(plan) => openPanel(plan.key)}
            />
            {panel ? (
              <View nativeID="entrada-form" collapsable={false} style={{ width: "100%", maxWidth: 760, alignSelf: "center" }}>
                <EntryAccount panel={panel} onClose={() => setPanel(null)} />
              </View>
            ) : null}
            <Text
              className="text-center text-deep"
              style={{ fontFamily: "PlayfairDisplay_700Bold", fontSize: wide ? 34 : 26, marginTop: wide ? 8 : 12 }}
            >
              {ENTRY_COPY.plansTitle}
            </Text>
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
                  gap: wide ? 24 : 0,
                  alignItems: "stretch",
                }}
              >
                {ENTRY_PLANS.map((plan) => (
                  <PlanCard key={plan.key} plan={plan} wide={wide} onPress={() => openPanel(plan.key)} />
                ))}
              </View>
              <View style={{ paddingHorizontal: wide ? 0 : 12, paddingBottom: wide ? 0 : 12 }}>
                <BothBanner wide={wide} />
              </View>
            </View>
            <View nativeID="preguntas" style={{ width: "100%", maxWidth: 760, alignSelf: "center", gap: wide ? 28 : 20 }}>
              <View style={{ alignItems: "center", gap: 8 }}>
                <Text
                  className="text-accent"
                  style={{ fontFamily: "DMSans_700Bold", fontSize: 17, letterSpacing: 1.4, textTransform: "uppercase" }}
                >
                  {ENTRY_COPY.faqEyebrow}
                </Text>
                <Text
                  className="text-center text-deep"
                  style={{ fontFamily: "PlayfairDisplay_700Bold", fontSize: wide ? 38 : 30, lineHeight: wide ? 46 : 37 }}
                >
                  {ENTRY_COPY.faqTitle}
                </Text>
                <Text
                  className="text-center text-ink"
                  style={{ fontFamily: entryBody, fontSize: wide ? 20 : 18, lineHeight: wide ? 30 : 27 }}
                >
                  {ENTRY_COPY.faqSubtitle}
                </Text>
              </View>
              <FaqList variant="entry" />
              <View className="border border-hairline bg-paper" style={{ borderRadius: 20, padding: wide ? 28 : 20 }}>
                <SupportQuestionForm source="entrada" />
              </View>
            </View>
            <View style={{ gap: 12, alignItems: "center" }}>
              <Text className="text-center text-slate" style={{ fontFamily: entryBody, fontSize: 16, lineHeight: 23 }}>
                {ENTRY_COPY.invited}
              </Text>
              <AccountLink label="Ya tengo cuenta" onPress={() => openPanel("sign-in")} />
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

function PlanCard({ plan, wide, onPress }: { plan: EntryPlan; wide: boolean; onPress: () => void }) {
  const colors = plan.colors;
  const pad = wide ? 28 : 20;
  const [expanded, setExpanded] = useState(false);
  const folds = !wide && plan.benefits.length > ENTRY_PREVIEW_COUNT;
  const benefits = folds && !expanded ? plan.benefits.slice(0, ENTRY_PREVIEW_COUNT) : plan.benefits;

  return (
    <LinearGradient
      colors={planGradient(plan)}
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
          {benefits.map((benefit) => (
            <BenefitRow key={benefit} text={benefit} check="white" ink="white" />
          ))}
        </View>
        {folds ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((current) => !current)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 4 }}
          >
            <Text style={{ color: colors.celeste, fontFamily: "DMSans_600SemiBold", fontSize: 16 }}>
              {expanded ? ENTRY_COPY.seeLess : `${ENTRY_COPY.seeAll} (${plan.benefits.length})`}
            </Text>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.celeste} />
          </Pressable>
        ) : null}
        <View style={{ marginTop: "auto", paddingTop: 12, gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            onPress={onPress}
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
