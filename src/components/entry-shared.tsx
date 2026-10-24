import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Image } from "expo-image";
import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { lotteryPalette, palette, type Palette } from "@/constants/palette";

export type PlanIcon = "horse-variant" | "ticket-confirmation";

export type EntryPlan = {
  key: string;
  icon: PlanIcon;
  kicker: string;
  name: string;
  tagline: string;
  highlights: string[];
  benefits: string[];
  cta: string;
  colors: Palette;
};

export const ENTRY_COPY = {
  eyebrow: "Para agencias hípicas y de lotería",
  title: "Tu agencia, en orden. Cada día.",
  subtitle: "Cargá el día, seguí cada saldo y cerrá el mes sin planillas. Elegí con qué empezás.",
  includes: "Incluye",
  note: "Sin instalar nada. Desde la computadora o el celular.",
  bothTitle: "¿Tenés las dos?",
  bothDetail: "Entrá con una. Adentro prendés o apagás la otra, y lo cargado queda guardado.",
};

export const ENTRY_PREVIEW_COUNT = 4;

export const ENTRY_PLANS: EntryPlan[] = [
  {
    key: "racing",
    icon: "horse-variant",
    kicker: "Agencia",
    name: "Hípica",
    tagline: "Cada hipódromo, cada reunión y cada apostador, con la cuenta hecha.",
    highlights: ["Carga del día", "Saldos", "Resultado"],
    benefits: [
      "Carga del día por hipódromo y terminal, con la comisión calculada sola",
      "Cuenta corriente con cada hipódromo y depósitos con comprobante",
      "Gastos de la agencia y retiros de socios, por categoría",
      "Cuentas corrientes de cada apostador: qué debe y qué tiene a favor",
      "Caja del día y calendario de turnos",
      "Resultado del mes, listo para mandar por WhatsApp",
      "Dueños y operadores con su propio acceso, y un historial de cada cambio",
    ],
    cta: "Quiero mi agencia hípica",
    colors: palette,
  },
  {
    key: "lottery",
    icon: "ticket-confirmation",
    kicker: "Agencia de",
    name: "Lotería",
    tagline: "Lo vendido de cada juego y el saldo con la lotería, siempre a la vista.",
    highlights: ["Por juego", "Por terminal", "Saldo"],
    benefits: [
      "Lo vendido por terminal y por juego: Quiniela, Plus, Telekino, Brinco, Loto y Quini",
      "La comisión de cada juego se calcula sola",
      "Saldo con la lotería y depósitos al día",
      "Gastos y retiros propios, aparte de la hípica",
      "Resultado de la agencia: Quiniela, Hípica y Total",
      "Historial de cada cambio",
    ],
    cta: "Quiero mi agencia de lotería",
    colors: lotteryPalette,
  },
];

export const entryMark = require("../../assets/images/brand-mark.png");

export const entryBody = "DMSans_400Regular";

export function EntryHeader({ wide }: { wide: boolean }) {
  return (
    <View className="bg-deep" style={{ height: wide ? 72 : 64, justifyContent: "center" }}>
      <View
        style={{
          width: "100%",
          maxWidth: 1200,
          alignSelf: "center",
          paddingHorizontal: wide ? 32 : 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Image
          source={entryMark}
          contentFit="contain"
          accessibilityLabel="HippoPro"
          style={{ height: wide ? 44 : 38, width: wide ? 44 : 38, borderRadius: 10 }}
        />
        <Text
          className="text-white"
          style={{ fontFamily: "DMSans_700Bold", fontSize: wide ? 22 : 20, letterSpacing: -0.4 }}
        >
          Hippo
          <Text style={{ color: palette.brand }}>Pro</Text>
        </Text>
      </View>
    </View>
  );
}

export function EntryHero({ wide }: { wide: boolean }) {
  return (
    <View style={{ alignItems: "center", gap: 14, maxWidth: 760, alignSelf: "center" }}>
      <Text
        className="text-accent"
        style={{ fontFamily: "DMSans_600SemiBold", fontSize: 14, letterSpacing: 1.6, textTransform: "uppercase" }}
      >
        {ENTRY_COPY.eyebrow}
      </Text>
      <Text
        className="text-center text-deep"
        style={{ fontFamily: "PlayfairDisplay_700Bold", fontSize: wide ? 52 : 34, lineHeight: wide ? 60 : 40 }}
      >
        {ENTRY_COPY.title}
      </Text>
      <Text
        className="text-center text-slate"
        style={{ fontFamily: entryBody, fontSize: wide ? 19 : 17, lineHeight: wide ? 28 : 25 }}
      >
        {ENTRY_COPY.subtitle}
      </Text>
    </View>
  );
}

export function BenefitCheck({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Path
        d="M5.2 13.1 9.3 17.4 18.8 7.2"
        fill="none"
        stroke={color}
        strokeWidth={4.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BenefitRow({ text, check, ink }: { text: string; check: string; ink: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <BenefitCheck color={check} />
      <Text style={{ flex: 1, color: ink, fontFamily: entryBody, fontSize: 17, lineHeight: 25 }}>{text}</Text>
    </View>
  );
}

export function BothBanner({ wide }: { wide: boolean }) {
  return (
    <View
      className="border border-hairline bg-mist"
      style={{
        borderRadius: 16,
        paddingHorizontal: wide ? 24 : 16,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
      }}
    >
      <View style={{ flexDirection: "row" }}>
        <View
          className="bg-deep"
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}
        >
          <MaterialCommunityIcons name="horse-variant" size={20} color={palette.celeste} />
        </View>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            marginLeft: -10,
            backgroundColor: palette.deep,
            borderWidth: 2,
            borderColor: palette.tint,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons name="ticket-confirmation" size={18} color={lotteryPalette.celeste} />
        </View>
      </View>
      <Text className="flex-1 text-deep" style={{ fontFamily: entryBody, fontSize: 17, lineHeight: 24 }}>
        <Text className="text-deep" style={{ fontFamily: "DMSans_700Bold" }}>
          {ENTRY_COPY.bothTitle}{" "}
        </Text>
        {ENTRY_COPY.bothDetail}
      </Text>
    </View>
  );
}
