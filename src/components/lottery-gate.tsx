import { Redirect } from "expo-router";
import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import { Feedback, PrimaryButton, SecondaryButton } from "@/components/form-controls";
import { Card, ScreenFrame } from "@/components/screen-frame";
import { ledgerErrorMessage, useLedger, useLottery } from "@/modules/ledger";

/** Shows a lottery screen only once its book is open. Other agencies go back to Inicio. */
export function LotteryGate({ title, children }: { title: string; children: ReactNode }) {
  const lottery = useLottery();

  if (lottery.status === "unavailable") {
    return <Redirect href="/" />;
  }
  if (lottery.status === "active") {
    return <>{children}</>;
  }
  return (
    <ScreenFrame title={title}>
      {lottery.status === "loading" ? (
        <Card>
          <Text className="text-[17px] text-ink">Abriendo la quiniela…</Text>
        </Card>
      ) : lottery.status === "error" ? (
        <Card>
          <View className="gap-4">
            <Text className="text-[17px] leading-6 text-ink">
              No se pudo abrir la quiniela. La hípica sigue igual.
            </Text>
            <SecondaryButton className="self-start" label="Reintentar" onPress={lottery.retry} />
          </View>
        </Card>
      ) : (
        <ActivateCard />
      )}
    </ScreenFrame>
  );
}

function ActivateCard() {
  const { canViewBalances } = useLedger();
  const lottery = useLottery();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function activate() {
    if (saving) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await lottery.activate();
    } catch (caught) {
      setError(ledgerErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <View className="gap-4">
        <Text className="font-sans text-[24px] font-semibold text-navy">Agencia de Quiniela</Text>
        <Text className="text-[17px] leading-6 text-ink">
          Por terminal y por día se carga lo vendido de cada juego. La comisión y el saldo con la lotería salen solos.
        </Text>
        <Text className="text-[17px] leading-6 text-ink">
          Es un libro aparte: lo que se cargue acá no cambia nada de la hípica.
        </Text>
        {canViewBalances ? (
          <>
            <Feedback error={error} message={saving ? "Activando…" : ""} />
            <PrimaryButton className="self-start" label="Activar" onPress={() => void activate()} />
          </>
        ) : (
          <Text className="text-[17px] font-semibold text-navy">La quiniela la activa el dueño.</Text>
        )}
      </View>
    </Card>
  );
}
