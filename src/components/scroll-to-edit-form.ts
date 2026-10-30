import { Platform } from "react-native";

import { desktopTopbarHeight, mobileBarHeight, wideLayout } from "@/constants/layout";

/** Smoothly brings the edit form into view, below the fixed bar, and leaves the Edit button. */
export function scrollToEditForm(formId: string) {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return;
  }
  requestAnimationFrame(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLElement)) {
      return;
    }
    const wide = window.innerWidth >= wideLayout;
    const bar = wide ? desktopTopbarHeight : mobileBarHeight;
    form.style.scrollMarginTop = `${bar + 20}px`;
    form.style.outline = "none";
    form.tabIndex = -1;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.focus({ preventScroll: true });
  });
}
