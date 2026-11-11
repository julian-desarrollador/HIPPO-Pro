import type { ReactNode } from "react";
import { Text, View } from "react-native";

/** The body of a confirm dialog: what it is about, on its own line, then short sentences. */
export function ConfirmNotice({ subject, children }: { subject: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <View className="rounded-[10px] bg-tint px-3 py-2.5">
        <Text className="text-[17px] font-semibold text-navy" selectable>
          {subject}
        </Text>
      </View>
      <View className="gap-2">{children}</View>
    </View>
  );
}

/** One sentence of a ConfirmNotice. */
export function NoticeLine({ children }: { children: ReactNode }) {
  return <Text className="text-[17px] leading-6 text-ink">{children}</Text>;
}

/** A name inside a NoticeLine, in bold. */
export function NoticeName({ children }: { children: ReactNode }) {
  return <Text className="font-semibold text-navy">{children}</Text>;
}
