import { Redirect } from "expo-router";
import { useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";

import { AmountField } from "@/components/amount-field";
import { monthTitle } from "@/components/calendar-grid";
import { DataTable } from "@/components/data-table";
import {
  ChoiceChips,
  ConfirmDialog,
  Dialog,
  Feedback,
  Field,
  PrimaryButton,
  RowActions,
  SecondaryButton,
  TextField,
} from "@/components/form-controls";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { RacingWelcome } from "@/components/starting-balances";
import { WelcomeCelebration, WelcomeReminder } from "@/components/welcome-hero";
import { StatCard } from "@/components/stat-card";
import { wideLayout } from "@/constants/layout";
import {
  currentCommissionBasisPoints,
  formatAmountInput,
  formatPercentInput,
  ledgerErrorMessage,
  parsePercentToBasisPoints,
  parseSignedPercentToBasisPoints,
  racetrackHasMovements,
  racetrackOpeningCents,
  readAmount,
  useLedger,
} from "@/modules/ledger";

type OpeningSide = "owe" | "owed";

const openingSideOptions: readonly { id: OpeningSide; label: string }[] = [
  { id: "owe", label: "Le debo" },
  { id: "owed", label: "Me debe" },
];

export default function HomeScreen() {
  const { agencyMode } = useLedger();
  if (agencyMode === "lottery") {
    return <Redirect href="/quiniela" />;
  }
  return <RacingHome />;
}

function RacingHome() {
  const {
    canViewBalances,
    summary,
    reset,
    persistence,
    snapshot,
    racetracks,
    addRacetrack,
    updateRacetrack,
    removeRacetrack,
    readOnly,
    agencyName,
    startingStep,
    startBook,
    postponeStartingBalances,
  } = useLedger();
  const [resumeStart, setResumeStart] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const showWelcome = startingStep === "welcome" || (startingStep === "reminder" && resumeStart);
  const wide = useWindowDimensions().width >= wideLayout;
  const [name, setName] = useState("");
  const [commission, setCommission] = useState("");
  const [adjustment, setAdjustment] = useState("");
  const [openingSide, setOpeningSide] = useState<OpeningSide>("owe");
  const [opening, setOpening] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [blockedRemove, setBlockedRemove] = useState(false);

  const rows = summary.racetracks.map((track) => ({
    id: track.racetrackId,
    ...track,
  }));

  function openAdd() {
    setEditingId(null);
    setName("");
    setCommission("");
    setAdjustment("");
    setOpeningSide("owe");
    setOpening("");
    setError("");
    setMessage("");
    setFormOpen(true);
  }

  function startEdit(id: string) {
    const track = racetracks.find((item) => item.id === id);
    if (!track) {
      return;
    }
    setManageOpen(false);
    setEditingId(id);
    setName(track.name);
    setCommission(formatPercentInput(currentCommissionBasisPoints(id, snapshot.commissions, snapshot)));
    setAdjustment(track.depositAdjustmentBasisPoints === 0 ? "" : formatPercentInput(track.depositAdjustmentBasisPoints));
    const openingCents = racetrackOpeningCents(snapshot, id);
    setOpeningSide(openingCents < 0 ? "owed" : "owe");
    setOpening(openingCents === 0 ? "" : formatAmountInput(Math.abs(openingCents)));
    setError("");
    setMessage("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }
    setFormOpen(false);
    setEditingId(null);
    setName("");
    setCommission("");
    setAdjustment("");
    setOpening("");
    setError("");
  }

  async function onSave() {
    if (saving) {
      return;
    }
    const commissionBasisPoints = parsePercentToBasisPoints(commission);
    const depositAdjustmentBasisPoints = adjustment.trim() ? parseSignedPercentToBasisPoints(adjustment) : 0;
    if (!name.trim()) {
      setMessage("");
      setError("Escribí el nombre del hipódromo.");
      return;
    }
    if (commissionBasisPoints === null) {
      setMessage("");
      setError("El porcentaje tiene que estar entre 0 y 100.");
      return;
    }
    if (depositAdjustmentBasisPoints === null) {
      setMessage("");
      setError("El ajuste tiene que estar entre -100 y 100.");
      return;
    }
    const openingAmount = readAmount(opening, true);
    if (openingAmount === null) {
      setMessage("");
      setError("Revisá el saldo inicial. Usá 1.000.000,00.");
      return;
    }
    const openingCents = openingSide === "owed" ? -openingAmount : openingAmount;
    setSaving(true);
    setMessage("Guardando…");
    setError("");
    try {
      if (editingId) {
        await updateRacetrack({ id: editingId, name, commissionBasisPoints, depositAdjustmentBasisPoints, openingCents });
        setMessage("Hipódromo actualizado.");
      } else {
        await addRacetrack({ name, commissionBasisPoints, depositAdjustmentBasisPoints, openingCents });
        setMessage("Hipódromo agregado.");
      }
      setName("");
      setCommission("");
      setAdjustment("");
      setOpening("");
      setEditingId(null);
      setFormOpen(false);
    } catch (caught) {
      setMessage("");
      setError(ledgerErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!pendingRemoveId) {
      return;
    }
    const id = pendingRemoveId;
    setPendingRemoveId(null);
    try {
      await removeRacetrack(id);
      setManageOpen(false);
      setMessage("Hipódromo quitado.");
      setError("");
    } catch (caught) {
      setMessage("");
      setError(ledgerErrorMessage(caught));
    }
  }

  return (
    <ScreenFrame title="Inicio">
      {celebrating ? (
        <WelcomeCelebration kind="racing" agencyName={agencyName} onClose={() => setCelebrating(false)} />
      ) : showWelcome ? (
        <RacingWelcome
          agencyName={agencyName}
          openedMonth={snapshot.month}
          onStart={async (input, startMonth) => {
            await startBook(input, startMonth);
            setResumeStart(false);
            setCelebrating(true);
          }}
          onPostpone={async () => {
            await postponeStartingBalances();
            setResumeStart(false);
          }}
        />
      ) : startingStep === "reminder" ? (
        <WelcomeReminder kind="racing" onStart={() => setResumeStart(true)} />
      ) : (
        <Card>
          <Text className="font-sans text-[24px] font-semibold text-navy">Bienvenido a HippoPro</Text>
        </Card>
      )}
      {celebrating || showWelcome ? null : canViewBalances ? (
        <>
          <View className={wide ? "flex-row flex-wrap gap-4" : "gap-4"}>
            <StatCard label="Venta neta" cents={summary.netCents} />
            <StatCard label="Comisión" cents={summary.billingCents} />
            <StatCard label="Total a pagar a los hipódromos" cents={summary.owedCents} emphasis />
          </View>
          <SectionTitle title="Por hipódromo" />
          <DataTable
            columns={[
              { key: "name", header: "Hipódromo", compact: true, render: (row) => row.name },
              { key: "meetings", header: "Reuniones", align: "right", compact: true, render: (row) => String(row.meetingCount) },
              { key: "net", header: "Venta neta", align: "right", compact: true, cents: (row) => row.netCents },
              { key: "commission", header: "Comisión", align: "right", compact: true, cents: (row) => row.commissionCents },
              { key: "owed", header: "Saldo a pagar", align: "right", compact: true, cents: (row) => row.owedCents },
            ]}
            rows={rows}
            footer={{
              values: {
                name: { text: "Total" },
                meetings: { text: String(summary.meetingCount) },
                net: { cents: summary.netCents },
                commission: { cents: summary.billingCents },
                owed: { cents: summary.owedCents },
              },
            }}
          />
          {readOnly ? null : <View className="flex-row flex-wrap items-center gap-4">
            <SecondaryButton className="self-start" label="Agregar hipódromo" onPress={openAdd} />
            {racetracks.length > 0 ? (
              <SecondaryButton
                className="self-start"
                label="Editar o quitar"
                onPress={() => {
                  setError("");
                  setMessage("");
                  setManageOpen(true);
                }}
              />
            ) : null}
          </View>}
          <Feedback error={formOpen || manageOpen ? "" : error} message={message} />
          <Dialog visible={formOpen} title={editingId ? "Editar hipódromo" : "Nuevo hipódromo"} onClose={closeForm}>
            <Field label="Nombre">
              <TextField value={name} onChangeText={setName} placeholder="Nombre" accessibilityLabel="Nombre del hipódromo" />
            </Field>
            <Field label="Comisión">
              <TextField
                value={commission}
                onChangeText={setCommission}
                keyboardType="decimal-pad"
                placeholder="15"
                accessibilityLabel="Comisión del hipódromo"
              />
            </Field>
            <Text className="text-[15px] leading-5 text-muted">
              Vale para los días que se carguen después. Los ya cargados conservan su porcentaje.
            </Text>
            <Field label="Ajuste al depositar (%)">
              <TextField
                value={adjustment}
                onChangeText={setAdjustment}
                keyboardType="numbers-and-punctuation"
                placeholder="0"
                accessibilityLabel="Ajuste al depositar"
              />
            </Field>
            <Text className="text-[15px] leading-5 text-muted">
              Lo que se suma o se resta del neto al depositar. Por ejemplo -5. También vale para los días que se carguen después.
            </Text>
            <Field label={`Saldo al empezar ${monthTitle(snapshot.month).toLocaleLowerCase("es")}`}>
              <View className="gap-3">
                <ChoiceChips options={openingSideOptions} value={openingSide} onChange={setOpeningSide} />
                <AmountField value={opening} onChangeText={setOpening} accessibilityLabel="Saldo inicial con el hipódromo" />
              </View>
            </Field>
            <Text className="text-[15px] leading-5 text-muted">
              Lo que había con este hipódromo al empezar a usar HippoPro. No lleva comisión. Desde ahí sigue el saldo a pagar.
            </Text>
            <Feedback error={error} />
            <PrimaryButton
              label={saving ? "Guardando…" : editingId ? "Guardar" : "Agregar hipódromo"}
              onPress={() => void onSave()}
            />
            <SecondaryButton label="Cancelar" onPress={closeForm} />
          </Dialog>
          <Dialog visible={manageOpen} title="Hipódromos" onClose={() => setManageOpen(false)}>
            {racetracks.map((track) => {
              const inUse = racetrackHasMovements(snapshot, track.id);
              return (
                <View key={track.id} className="flex-row items-center justify-between gap-3">
                  <Text className="flex-1 text-[17px] font-semibold text-navy">{track.name}</Text>
                  <RowActions
                    onEdit={() => startEdit(track.id)}
                    onRemove={() => {
                      if (inUse) {
                        setBlockedRemove(true);
                        return;
                      }
                      setManageOpen(false);
                      setPendingRemoveId(track.id);
                    }}
                  />
                </View>
              );
            })}
            <SecondaryButton label="Cerrar" onPress={() => setManageOpen(false)} />
          </Dialog>
          <Dialog visible={blockedRemove} title="No se puede quitar" onClose={() => setBlockedRemove(false)}>
            <Text className="text-base leading-6 text-ink">Tiene días, depósitos o saldo inicial. Quitá los movimientos y dejá el saldo inicial en cero antes.</Text>
            <SecondaryButton label="Entendido" onPress={() => setBlockedRemove(false)} />
          </Dialog>
          <ConfirmDialog
            visible={pendingRemoveId !== null}
            title="¿Quitar este hipódromo?"
            onCancel={() => setPendingRemoveId(null)}
            onConfirm={() => void confirmRemove()}
          />
        </>
      ) : (
        <Card>
          <Text className="text-base leading-6 text-ink">
            Estás viendo la agencia como operador. Podés cargar el día, los depósitos, los gastos y las cuentas corrientes. El resultado queda para el dueño.
          </Text>
        </Card>
      )}
      {persistence === "browser" && !readOnly ? <SecondaryButton label="Volver a los datos de agosto" onPress={() => void reset()} /> : null}
    </ScreenFrame>
  );
}
