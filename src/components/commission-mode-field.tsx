import { Text, View } from "react-native";

import { ChoiceChips, Field, TextField } from "@/components/form-controls";
import {
  DEFAULT_PROFIT_SHARE_BASIS_POINTS,
  DEFAULT_RETAINED_COMMISSION_BASIS_POINTS,
  formatPercentInput,
  type CommissionMode,
} from "@/modules/ledger";

const modeOptions: readonly { id: CommissionMode; label: string }[] = [
  { id: "fixed", label: "Porcentaje fijo" },
  { id: "retained", label: "Descontado del depósito" },
];

const modeHelp: Record<CommissionMode, string> = {
  fixed:
    "La agencia cobra un porcentaje del neto. Al depositar se paga el neto menos lo pagado, más o menos el ajuste si hay.",
  retained:
    "La agencia cobra dos partes: un porcentaje de la venta neta y otro de la ganancia del día (lo vendido menos lo pagado, menos ese mismo porcentaje). Deposita el resto. Ejemplo: neto $1.000.000 y pagado $600.000, con 6,75 % y 20 %: ganás $67.500 + 20 % de $373.000 ($74.600) = $142.100 y depositás $257.900. Si un día se paga más de lo vendido, solo cobrás la parte de la venta neta.",
};

/** How the agency charges a racetrack. The screen only collects text; racetrackRates turns it into rates. */
export function CommissionModeField({
  mode,
  onModeChange,
  commission,
  onCommissionChange,
  adjustment,
  onAdjustmentChange,
  profitShare,
  onProfitShareChange,
  showNotes = false,
}: {
  mode: CommissionMode;
  onModeChange: (mode: CommissionMode) => void;
  commission: string;
  onCommissionChange: (value: string) => void;
  adjustment: string;
  onAdjustmentChange: (value: string) => void;
  profitShare: string;
  onProfitShareChange: (value: string) => void;
  /** Adds the notes about days already loaded, as in the Inicio form. */
  showNotes?: boolean;
}) {
  function pickMode(next: CommissionMode) {
    onModeChange(next);
    if (next !== "retained") {
      return;
    }
    if (!commission.trim()) {
      onCommissionChange(formatPercentInput(DEFAULT_RETAINED_COMMISSION_BASIS_POINTS));
    }
    if (!profitShare.trim()) {
      onProfitShareChange(formatPercentInput(DEFAULT_PROFIT_SHARE_BASIS_POINTS));
    }
  }

  return (
    <View className="gap-3">
      <Field label="¿Cómo cobra la agencia?">
        <ChoiceChips options={modeOptions} value={mode} onChange={pickMode} />
      </Field>
      <Text className="text-[15px] leading-5 text-muted">{modeHelp[mode]}</Text>
      {mode === "retained" ? (
        <>
          <Field label="Tu porcentaje de la venta neta (%)">
            <TextField
              value={commission}
              onChangeText={onCommissionChange}
              keyboardType="decimal-pad"
              placeholder="6,75"
              accessibilityLabel="Porcentaje de la venta neta"
            />
          </Field>
          <Field label="Tu porcentaje de la ganancia (%)">
            <TextField
              value={profitShare}
              onChangeText={onProfitShareChange}
              keyboardType="decimal-pad"
              placeholder="20"
              accessibilityLabel="Porcentaje de la ganancia"
            />
          </Field>
        </>
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
