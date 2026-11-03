import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

import { wideLayout } from "@/constants/layout";
import { usePalette } from "@/constants/palette";
import { FAQ_GROUPS, type FaqItem } from "@/modules/support/faq";

/** "entry" uses the white panels of /entrada. "app" uses the cards of the app. */
export type FaqVariant = "entry" | "app";

// Many readers are older: no small grey text. Body copy is 18 px in near-black ink.
const looks = {
  entry: {
    card: "bg-paper border-hairline",
    surface: "bg-paper",
    title: "text-deep",
  },
  app: {
    card: "bg-card border-line",
    surface: "bg-card",
    title: "text-navy",
  },
} as const;

/** Questions grouped by topic. One open at a time; the first one starts open. */
export function FaqList({ variant = "app" }: { variant?: FaqVariant }) {
  const [openQuestion, setOpenQuestion] = useState<string | null>(FAQ_GROUPS[0]?.items[0]?.question ?? null);
  const wide = useWindowDimensions().width >= wideLayout;
  const look = looks[variant];

  return (
    <View className="gap-7">
      {FAQ_GROUPS.map((group) => (
        <View key={group.title} className="gap-3">
          <View className="flex-row items-center gap-3">
            <Text className={`text-[18px] font-bold ${look.title}`}>{group.title}</Text>
            <View className="h-px flex-1 bg-line" />
          </View>
          {group.items.map((item) => (
            <FaqCard
              key={item.question}
              item={item}
              variant={variant}
              wide={wide}
              expanded={openQuestion === item.question}
              onToggle={() => setOpenQuestion((current) => (current === item.question ? null : item.question))}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function FaqCard({
  item,
  variant,
  wide,
  expanded,
  onToggle,
}: {
  item: FaqItem;
  variant: FaqVariant;
  wide: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const palette = usePalette();
  const look = looks[variant];

  return (
    <View
      className={`overflow-hidden rounded-[16px] border ${expanded ? "border-accent" : look.card}`}
      style={expanded ? { borderWidth: 2 } : undefined}
    >
      <View className={look.surface}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={onToggle}
          className="cursor-pointer flex-row items-center gap-3.5 px-4 py-4"
        >
          <View className="h-11 w-11 items-center justify-center rounded-full bg-tint">
            <Ionicons name={item.icon} size={23} color={palette.accent} />
          </View>
          <Text className={`min-w-0 flex-1 text-[19px] font-semibold leading-7 ${look.title}`}>{item.question}</Text>
          <View className={`h-9 w-9 items-center justify-center rounded-full ${expanded ? "bg-accent" : "bg-tint"}`}>
            <Ionicons name={expanded ? "remove" : "add"} size={24} color={expanded ? "white" : palette.accent} />
          </View>
        </Pressable>
        {expanded ? <FaqAnswer item={item} wide={wide} titleClass={look.title} /> : null}
      </View>
    </View>
  );
}

function FaqAnswer({ item, wide, titleClass }: { item: FaqItem; wide: boolean; titleClass: string }) {
  const palette = usePalette();
  return (
    <View className="gap-3.5 pb-5 pr-5" style={{ paddingLeft: wide ? 74 : 18 }}>
      <Text className={`text-[20px] font-bold leading-8 ${titleClass}`}>{item.lead}</Text>
      {item.detail ? <Text className="text-[18px] leading-7 text-ink">{item.detail}</Text> : null}
      {item.points ? (
        <View className="gap-3">
          {item.points.map((point, index) => (
            <View key={point} className="flex-row items-start gap-3">
              {item.numbered ? (
                <View className="h-8 w-8 items-center justify-center rounded-full bg-accent">
                  <Text className="text-[17px] font-bold text-white">{index + 1}</Text>
                </View>
              ) : (
                <View style={{ marginTop: 2 }}>
                  <Ionicons name="checkmark-circle" size={24} color={palette.accent} />
                </View>
              )}
              <Text className="min-w-0 flex-1 text-[18px] leading-7 text-ink" style={{ paddingTop: 1 }}>
                {point}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
