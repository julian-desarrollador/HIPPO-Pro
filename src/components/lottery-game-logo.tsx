import { Image } from "expo-image";
import { View } from "react-native";

const LOGOS: Record<string, number> = {
  "quiniela-ciudad": require("../../assets/images/lottery/quiniela-ciudad.png"),
  "quini-6": require("../../assets/images/lottery/quini-6.png"),
  "loto-plus": require("../../assets/images/lottery/loto-plus.png"),
  "quiniela-poceada": require("../../assets/images/lottery/quiniela-poceada.png"),
  // There is no logo for this one: it uses the HippoPro horse.
  hipica: require("../../assets/images/brand-mark.png"),
  "loto-5-plus": require("../../assets/images/lottery/loto-5-plus.png"),
  brinco: require("../../assets/images/lottery/brinco.png"),
  tombolina: require("../../assets/images/lottery/tombolina.png"),
  "la-grande": require("../../assets/images/lottery/la-grande.png"),
  prode: require("../../assets/images/lottery/prode.png"),
  "quiniela-ya": require("../../assets/images/lottery/quiniela-ya.png"),
};

/** The same white tile for every game, because most logos come on a white background. */
export function LotteryGameLogo({ gameId, name }: { gameId: string; name: string }) {
  const logo = LOGOS[gameId];
  if (!logo) {
    return null;
  }
  return (
    <View className="items-center justify-center rounded-[10px] border border-line bg-paper" style={{ width: 112, height: 64, flexShrink: 0 }}>
      <Image source={logo} contentFit="contain" accessibilityLabel={`Logo de ${name}`} style={{ width: 100, height: 52 }} />
    </View>
  );
}
