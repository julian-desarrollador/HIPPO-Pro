import { usePathname } from "expo-router";

export const palette = {
  canvas: "#D9EAF5",
  card: "#F3F8FC",
  line: "#ACC5D8",
  ink: "#0F172A",
  muted: "#406077",
  navy: "#1C517D",
  tint: "#D7E8F4",
  accent: "#186DAA",
  celeste: "#99CFF5",
  brand: "#59B349",
  chromeActive: "#2F6D9D",
  chromeMuted: "#CCDEEA",
  negative: "#B42318",
  positive: "#1B7A32",
  amberSoft: "#FEF6E7",
  amberInk: "#8A5A00",
  placeholder: "#546F83",
} as const;

export type Palette = { [Key in keyof typeof palette]: string };

/** Same roles as `palette`, in green. Keep in sync with `.theme-lottery` in global.css. */
export const lotteryPalette: Palette = {
  ...palette,
  canvas: "#E2EBE6",
  card: "#F6F8F7",
  line: "#C0CFC6",
  muted: "#44584E",
  navy: "#17382E",
  tint: "#E5EEE9",
  accent: "#1F5A44",
  celeste: "#B9D0C4",
  chromeActive: "#2A4D40",
  chromeMuted: "#D4DFD9",
  placeholder: "#5C6E66",
};

export function isLotteryPath(pathname: string): boolean {
  return pathname === "/quiniela" || pathname.startsWith("/quiniela/");
}

export function usePalette(): Palette {
  return isLotteryPath(usePathname()) ? lotteryPalette : palette;
}
