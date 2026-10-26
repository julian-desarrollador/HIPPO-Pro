import { useAgencyMode } from "@/modules/ledger/adapters/inbound/ledger-provider";

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
  /** Entry page only. Darker than `navy`: bar, title, both buttons and the pills. */
  deep: "#0F2A4A",
  /** Entry page background, left stop of the wash. */
  mist: "#F4F8FB",
  /** Entry page background, right stop, and the check circles. */
  wash: "#EAF2F8",
  /** Entry page panels. The rest of the app does not use pure white. */
  paper: "#FFFFFF",
  /** Entry page panel borders. */
  hairline: "#D7E3EC",
  /** Entry page subtitle. */
  slate: "#334155",
  /** Entry page footer. */
  caption: "#64748B",
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
  const mode = useAgencyMode();
  return mode === "lottery" || mode === "both" ? lotteryPalette : palette;
}
