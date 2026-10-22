import { useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";

import { DataTable } from "@/components/data-table";
import { Dialog, Feedback, Field, PrimaryButton, SecondaryButton, TextField } from "@/components/form-controls";
import { LotteryGate } from "@/components/lottery-gate";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { StatCard } from "@/components/stat-card";
import { wideLayout } from "@/constants/layout";
import {
  formatPercentInput,
  formatSignedPercent,
  ledgerErrorMessage,
  parsePercentToBasisPoints,
  useLedger,
  useLottery,
} from "@/modules/ledger";

export default function LotteryHomeScreen() {
  return (
    <LotteryGate title="Quiniela">
      <LotteryHome />
    </LotteryGate>
  );
}

function LotteryHome() {
  const { canViewBalances, readOnly } = useLedger();
  const { summary, games, updateCommission } = useLottery();
  const wide = useWindowDimensions().width >= wideLayout;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [percent, setPercent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [listOpen, setListOpen] = useState(false);

  if (!summary) {
    return null;
  }

  const rows = summary.games.map((game) => ({ id: game.gameId, ...game }));
  const editing = games.find((game) => game.id === editingId);

  function startEdit(id: string) {
    const game = games.find((item) => item.id === id);
    if (!game) {
      return;
    }
    setListOpen(false);
    setEditingId(id);
    setPercent(formatPercentInput(game.commissionBasisPoints));
    setError("");
    setMessage("");
  }

  function closeEdit() {
    if (saving) {
      return;
    }
    setEditingId(null);
    setError("");
  }

  async function onSave() {
    if (!editingId || saving) {
      return;
    }
    const commissionBasisPoints = parsePercentToBasisPoints(percent);
    if (commissionBasisPoints === null) {
      setError("El porcentaje tiene que estar entre 0 y 100.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateCommission({ gameId: editingId, commissionBasisPoints });
      setMessage("Porcentaje guardado.");
      setEditingId(null);
    } catch (caught) {
      setError(ledgerErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenFrame title="Quiniela">
      <Card>
        <Text className="font-sans text-[24px] font-semibold text-navy">Agencia de Quiniela</Text>
      </Card>
      {canViewBalances ? (
        <>
          <View className={wide ? "flex-row flex-wrap gap-4" : "gap-4"}>
            <StatCard label="Vendido" cents={summary.soldCents} />
            <StatCard label="Comisión" cents={summary.commissionCents} />
            <StatCard label="Total a pagar a la lotería" cents={summary.owedCents} emphasis />
          </View>
          <SectionTitle title="Por juego" />
          <DataTable
            columns={[
              { key: "name", header: "Juego", compact: true, render: (row) => row.name },
              { key: "percent", header: "Comisión %", align: "right", render: (row) => formatSignedPercent(row.commissionBasisPoints) },
              { key: "sold", header: "Vendido", align: "right", compact: true, cents: (row) => row.soldCents },
              { key: "commission", header: "Comisión", align: "right", compact: true, cents: (row) => row.commissionCents },
              { key: "deposit", header: "A depositar", align: "right", cents: (row) => row.amountToDepositCents },
            ]}
            rows={rows}
            footer={{
              values: {
                name: { text: "Total" },
                sold: { cents: summary.soldCents },
                commission: { cents: summary.commissionCents },
                deposit: { cents: summary.amountToDepositCents },
              },
            }}
          />
          {readOnly ? null : (
            <SecondaryButton
              className="self-start"
              label="Editar porcentajes"
              onPress={() => {
                setMessage("");
                setListOpen(true);
              }}
            />
          )}
          <Feedback message={message} />
          <Dialog visible={listOpen} title="Porcentajes" onClose={() => setListOpen(false)}>
            {games.map((game) => (
              <View key={game.id} className="flex-row items-center justify-between gap-3">
                <Text className="flex-1 text-[17px] font-semibold text-navy">{game.name}</Text>
                <Text className="text-[17px] text-ink">{formatSignedPercent(game.commissionBasisPoints)}</Text>
                <SecondaryButton label="Editar" onPress={() => startEdit(game.id)} />
              </View>
            ))}
            <SecondaryButton label="Cerrar" onPress={() => setListOpen(false)} />
          </Dialog>
          <Dialog visible={editing !== undefined} title={editing ? `Comisión de ${editing.name}` : ""} onClose={closeEdit}>
            <Field label="Comisión">
              <TextField
                value={percent}
                onChangeText={setPercent}
                keyboardType="decimal-pad"
                placeholder="20"
                accessibilityLabel="Comisión del juego"
              />
            </Field>
            <Text className="text-[15px] leading-5 text-muted">
              Vale para lo que se cargue después. Lo ya cargado conserva su porcentaje.
            </Text>
            <Feedback error={error} />
            <PrimaryButton label={saving ? "Guardando…" : "Guardar"} onPress={() => void onSave()} />
            <SecondaryButton label="Cancelar" onPress={closeEdit} />
          </Dialog>
        </>
      ) : (
        <Card>
          <Text className="text-base leading-6 text-ink">
            Podés cargar lo vendido por terminal, los depósitos y los gastos de la quiniela. El resultado queda para el dueño.
          </Text>
        </Card>
      )}
    </ScreenFrame>
  );
}
