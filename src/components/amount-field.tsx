import { StyleSheet, Text, TextInput, View } from "react-native";

import { palette } from "@/constants/palette";
import { completeAmountInput, maskAmountInput } from "@/modules/ledger";

const valueStyle = StyleSheet.create({
  input: {
    flex: 1,
    margin: 0,
    padding: 0,
    borderWidth: 0,
    fontVariant: ["tabular-nums"],
  },
});

export function AmountField({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <View className="flex-row items-center rounded-[10px] border border-line bg-card px-3 py-2.5">
      <Text className="mr-1.5 text-[15px] text-ink tabular-nums">$</Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChangeText(maskAmountInput(text))}
        onBlur={() => onChangeText(completeAmountInput(value))}
        keyboardType="decimal-pad"
        inputMode="decimal"
        placeholder="0,00"
        placeholderTextColor={palette.placeholder}
        underlineColorAndroid="transparent"
        className="flex-1 border-0 text-[15px] text-ink outline-none"
        style={valueStyle.input}
      />
    </View>
  );
}
