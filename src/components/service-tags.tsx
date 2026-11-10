import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Text, View } from "react-native";

import { palette } from "@/constants/palette";
import { seesLottery, seesRacing, type AgencyMode } from "@/modules/ledger";

/** chrome: on the dark menu. light: on a card, like the list of agencies. */
type Tone = "chrome" | "light";

const TONES: Record<Tone, { pill: string; text: string; horseshoe: string; ball: string }> = {
  chrome: { pill: palette.chromeActive, text: palette.paper, horseshoe: palette.celeste, ball: palette.brand },
  light: { pill: palette.tint, text: palette.navy, horseshoe: palette.accent, ball: palette.brandDeep },
};

/** The lottery ball: a disc in the logo's green with a white middle. */
export function LotteryBall({ size, color }: { size: number; color: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ width: size / 2, height: size / 2, borderRadius: size / 4, backgroundColor: palette.paper }} />
    </View>
  );
}

export function HorseshoeIcon({ size, color }: { size: number; color: string }) {
  return <MaterialCommunityIcons name="horseshoe" size={size} color={color} />;
}

function services(mode: AgencyMode): ("racing" | "lottery")[] {
  return [...(seesRacing(mode) ? (["racing"] as const) : []), ...(seesLottery(mode) ? (["lottery"] as const) : [])];
}

/** What the agency uses, as pills with an icon and its name: Hípica, Lotería or both. */
export function ServiceTags({ mode, tone }: { mode: AgencyMode; tone: Tone }) {
  const look = TONES[tone];
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {services(mode).map((service) => (
        <View
          key={service}
          className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{ backgroundColor: look.pill }}
        >
          {service === "racing" ? <HorseshoeIcon size={16} color={look.horseshoe} /> : <LotteryBall size={14} color={look.ball} />}
          <Text className="text-[14px] font-medium" style={{ color: look.text }}>
            {service === "racing" ? "Hípica" : "Lotería"}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Only the icons, beside a name in a list, so each agency stays on one line. */
export function ServiceIcons({ mode }: { mode: AgencyMode }) {
  const items = services(mode);
  const label = items.map((service) => (service === "racing" ? "Hípica" : "Lotería")).join(" y ");
  return (
    <View accessible accessibilityLabel={label} className="shrink-0 flex-row items-center gap-1.5">
      {items.map((service) =>
        service === "racing" ? (
          <HorseshoeIcon key={service} size={17} color={palette.accent} />
        ) : (
          <LotteryBall key={service} size={15} color={palette.brandDeep} />
        ),
      )}
    </View>
  );
}

/** The same, in one small line for the phone's top bar, under the agency's name. */
export function ServiceLine({ mode }: { mode: AgencyMode }) {
  const items = services(mode);
  return (
    <View className="flex-row items-center gap-1">
      {items.map((service, index) => (
        <View key={service} className="flex-row items-center gap-1">
          {index > 0 ? <Text className="text-[12px] leading-[15px] text-chrome-muted">·</Text> : null}
          {service === "racing" ? <HorseshoeIcon size={13} color={palette.celeste} /> : <LotteryBall size={12} color={palette.brand} />}
          <Text className="text-[12px] leading-[15px] text-white">{service === "racing" ? "Hípica" : "Lotería"}</Text>
        </View>
      ))}
    </View>
  );
}
