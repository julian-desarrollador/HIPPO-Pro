import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { usePalette } from "@/constants/palette";

/**
 * A short message that closes on its own, or earlier with a tap.
 * It tells people where something went. Nothing depends on them reading it in time,
 * so the screen behind should also keep a message that stays.
 */
export function TimedNotice({
  visible,
  title,
  detail,
  onClose,
  durationMs = 3000,
}: {
  visible: boolean;
  title: string;
  detail: string;
  onClose: () => void;
  durationMs?: number;
}) {
  const palette = usePalette();
  // The timer starts when the notice opens. A new onClose on each render must not restart it.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const timer = setTimeout(() => close.current(), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, visible]);

  if (!visible) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar aviso"
        onPress={onClose}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }}
      >
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.navy, opacity: 0.4 }}
        />
        <View
          accessibilityLiveRegion="polite"
          className="items-center gap-3 rounded-[14px] border border-line bg-card p-6"
          style={{ width: 420, maxWidth: "100%" }}
        >
          <Ionicons name="checkmark-circle" size={48} color={palette.accent} />
          <Text className="text-center text-[22px] font-bold text-navy">{title}</Text>
          <Text className="text-center text-[18px] leading-7 text-ink">{detail}</Text>
        </View>
      </Pressable>
    </Modal>
  );
}
