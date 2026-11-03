import { Text, View } from "react-native";

import { ChoiceChips, Field, TextField } from "@/components/form-controls";
import { DEFAULT_RETAINED_COMMISSION_BASIS_POINTS, formatPercentInput, type CommissionMode } from "@/modules/ledger";

const modeOptions: readonly { id: CommissionMode; label: string }[] = [
  { id: "fixed", label: "Porcentaje fijo" },
  { id: "retained", label: "Descontado del depósito" },
];

const modeHelp: Record<CommissionMode, string> = {
  fixed:
    "La agencia cobra un porcentaje del neto. Al depositar se paga el neto menos lo pagado, más o menos el ajuste si hay.",
  retained:
    "La agencia se queda con un porcentaje de la venta neta y deposita el resto. Ejemplo: neto $100.000, pagado $60.000 y 6,75 %: tu comisión es $6.750 y depositás $33.250.",
};

/** How the agency charges a racetrack. The screen only collects text; racetrackRates turns it into rates. */
export function CommissionModeField({
  mode,
  onModeChange,
  commission,
  onCommissionChange,
  adjustment,
  onAdjustmentChange,
  showNotes = false,
}: {
  mode: CommissionMode;
  onModeChange: (mode: CommissionMode) => void;
  commission: string;
  onCommissionChange: (value: string) => void;
  adjustment: string;
  onAdjustmentChange: (value: string) => void;
  /** Adds the notes about days already loaded, as in the Inicio form. */
  showNotes?: boolean;
}) {
  function pickMode(next: CommissionMode) {
    onModeChange(next);
    if (next === "retained" && !commission.trim()) {
      onCommissionChange(formatPercentInput(DEFAULT_RETAINED_COMMISSION_BASIS_POINTS));
    }
  }

  return (
    <View className="gap-3">
      <Field label="¿Cómo cobra la agencia?">
        <ChoiceChips options={modeOptions} value={mode} onChange={pickMode} />
      </Field>
      <Text className="text-[15px] leading-5 text-muted">{modeHelp[mode]}</Text>
      {mode === "retained" ? (
        <Field label="Tu porcentaje de la venta neta (%)">
          <TextField
            value={commission}
            onChangeText={onCommissionChange}
            keyboardType="decimal-pad"
            placeholder="6,75"
            accessibilityLabel="Porcentaje de la venta neta"
          />
        </Field>
      ) : (
        <>
          <Field label="Comisión (%)">
            <TextField
              value={commission}
              onChangeText={onCommissionChange}
              keyboardType="decimal-pad"
              placeholder="15"
              accessibilityLabel="Comisión del hipódromo"
            />
          </Field>
          <Field label="Ajuste al depositar (%)">
            <TextField
              value={adjustment}
              onChangeText={onAdjustmentChange}
              keyboardType="numbers-and-punctuation"
              placeholder="Ej.: -5"
              accessibilityLabel="Ajuste al depositar"
            />
          </Field>
          {showNotes ? (
            <Text className="text-[15px] leading-5 text-muted">
              El ajuste es lo que se suma o se resta del neto al depositar. Si no tenés, dejalo vacío.
            </Text>
          ) : null}
        </>
      )}
      {showNotes ? (
        <Text className="text-[15px] leading-5 text-muted">
          Vale para los días que se carguen después. Los ya cargados conservan su porcentaje.
        </Text>
      ) : null}
    </View>
  );
}
