import { createContext, useContext } from "react";
import { Animated, useWindowDimensions } from "react-native";

import { wideLayout } from "@/constants/layout";

export const SidebarContext = createContext<{
  collapsed: boolean;
  railOnly: boolean;
  toggle: () => void;
  width: Animated.Value;
}>({
  collapsed: false,
  railOnly: false,
  toggle() {},
  width: new Animated.Value(0),
});

/** Desktop menu width. Zero on a phone. On a computer it animates between open and the rail. */
export function useDesktopSidebarWidth(): Animated.Value | 0 {
  const wide = useWindowDimensions().width >= wideLayout;
  const sidebar = useContext(SidebarContext);
  if (!wide) {
    return 0;
  }
  return sidebar.width;
}
