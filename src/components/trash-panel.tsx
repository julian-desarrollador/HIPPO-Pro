import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ConfirmDialog, Dialog, Feedback, Field, TextField } from "@/components/form-controls";
import { archivedAgencyDetail } from "@/modules/identity/archived-agency";
import { useAgencyAdmin, type ArchivedAgency } from "@/modules/identity/agency-admin";
import { removalNameMatches } from "@/modules/identity/agency-invite";
import { useAgencyVisit, useLedger } from "@/modules/ledger";

/** Papelera: removed agencies. Only the account with can_manage_trash opens it. */
export function TrashPanel({
  visible,
  onClose,
  onBack,
}: {
  visible: boolean;
  onClose: () => void;
  onBack?: () => void;
}) {
  const admin = useAgencyAdmin();
  const visit = useAgencyVisit();
  const { snapshot } = useLedger();
  const viewedAgencyId = snapshot.agencyId;
  const [agencies, setAgencies] = useState<ArchivedAgency[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<ArchivedAgency | null>(null);
  const [pendingPurge, setPendingPurge] = useState<ArchivedAgency | null>(null);
  const [purgeName, setPurgeName] = useState("");
  const [purgeError, setPurgeError] = useState("");

  useEffect(() => {
    if (!visible || !admin) {
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    setMessage("");
    const directory = admin;
    void (async () => {
      try {
        const rows = await directory.listArchived();
        if (alive) {
          setAgencies(rows);
          setLoading(false);
        }
      } catch {
        if (alive) {
          setAgencies([]);
          setError("No se pudo cargar la lista.");
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [admin, visible]);

  if (!admin) {
    return null;
  }
  const directory = admin;

  function drop(agency: ArchivedAgency) {
    if (agency.agencyId === viewedAgencyId) {
      visit?.leave();
    }
    setAgencies((rows) => rows.filter((row) => row.agencyId !== agency.agencyId));
  }

  async function look(agency: ArchivedAgency) {
    if (busy || !visit) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const opened = await directory.read(agency.agencyId);
    setBusy(false);
    if (typeof opened === "string") {
      setError(opened);
      return;
    }
    visit.open(opened);
    onClose();
  }

  async function confirmRestore() {
    if (!pendingRestore || busy) {
      return;
    }
    const agency = pendingRestore;
    setBusy(true);
    setError("");
    setMessage("");
    const problem = await directory.restore(agency);
    setBusy(false);
    setPendingRestore(null);
    if (problem) {
      setError(problem);
      return;
    }
    drop(agency);
    setMessage(`${agency.name} volvió a la lista.`);
  }

  function askPurge(agency: ArchivedAgency) {
    setPurgeName("");
    setPurgeError("");
    setPendingPurge(agency);
  }

  function cancelPurge() {
    if (busy) {
      return;
    }
    setPendingPurge(null);
    setPurgeName("");
    setPurgeError("");
  }

  async function confirmPurge() {
    if (!pendingPurge || busy || !removalNameMatches(purgeName, pendingPurge.name)) {
      return;
    }
    const agency = pendingPurge;
    setBusy(true);
    setPurgeError("");
    setError("");
    setMessage("");
    const problem = await directory.purge(agency, purgeName);
    setBusy(false);
    if (problem) {
      setPurgeError(problem);
      return;
    }
    drop(agency);
    setPendingPurge(null);
    setPurgeName("");
    setMessage(`${agency.name} se borró para siempre.`);
  }

  return (
    <>
      <Dialog visible={visible} title="Papelera" onClose={onClose} onBack={onBack}>
        <Text className="text-[17px] font-semibold leading-6 text-navy">
          Lo que se quita en Agencias queda acá, con sus datos. Solo vos lo ves.
        </Text>
        {loading ? <Text className="text-[17px] font-semibold text-navy">Cargando…</Text> : null}
        {!loading && !error && agencies.length === 0 ? (
          <Text className="text-[17px] text-ink">No hay agencias quitadas.</Text>
        ) : null}
        {agencies.map((agency) => (
          <View key={agency.agencyId} className="gap-2 rounded-[14px] border border-line px-4 py-3">
            <Text className="text-[17px] font-semibold text-navy">{agency.name}</Text>
            <Text className="text-[15px] leading-5 text-muted">{archivedAgencyDetail(agency)}</Text>
            <View className="flex-row flex-wrap items-center gap-x-5 gap-y-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Mirar ${agency.name}`}
                onPress={() => void look(agency)}
                className="cursor-pointer py-1"
              >
                <Text className="text-[17px] font-semibold text-accent">Mirar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Restaurar ${agency.name}`}
                onPress={() => setPendingRestore(agency)}
                className="cursor-pointer py-1"
              >
                <Text className="text-[17px] font-semibold text-accent">Restaurar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Borrar ${agency.name} para siempre`}
                onPress={() => askPurge(agency)}
                className="cursor-pointer py-1"
              >
                <Text className="text-[17px] font-semibold text-negative">Borrar para siempre</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <Feedback error={error} message={message} />
      </Dialog>
      <ConfirmDialog
        visible={pendingRestore !== null}
        title={pendingRestore ? `¿Restaurar ${pendingRestore.name}?` : "¿Restaurar esta agencia?"}
        detail={
          pendingRestore?.kind === "personal"
            ? "Vuelve a la lista de quien la creó, con lo que tenía."
            : "Vuelve a la lista y su gente puede entrar de nuevo, con lo que tenía."
        }
        confirmLabel={busy ? "Restaurando…" : "Restaurar"}
        onCancel={() => setPendingRestore(null)}
        onConfirm={() => void confirmRestore()}
      />
      <ConfirmDialog
        visible={pendingPurge !== null}
        title={pendingPurge ? `¿Borrar ${pendingPurge.name} para siempre?` : "¿Borrar esta agencia para siempre?"}
        detail="Se borran el libro, la lotería, las fotos y las cuentas que solo estaban en esta agencia. No se puede deshacer."
        confirmLabel="Borrar para siempre"
        destructive
        confirmEnabled={!busy && pendingPurge !== null && removalNameMatches(purgeName, pendingPurge.name)}
        onCancel={cancelPurge}
        onConfirm={() => void confirmPurge()}
      >
        <Field label={pendingPurge ? `Escribí ${pendingPurge.name} para confirmar` : "Escribí el nombre para confirmar"}>
          <TextField
            value={purgeName}
            onChangeText={(text) => {
              setPurgeName(text);
              setPurgeError("");
            }}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={pendingPurge?.name ?? ""}
            accessibilityLabel="Nombre de la agencia para confirmar"
          />
        </Field>
        {busy ? <Text className="mt-2 text-[15px] text-muted">Borrando…</Text> : null}
        {purgeError ? <Text className="mt-2 text-[15px] text-negative">{purgeError}</Text> : null}
      </ConfirmDialog>
    </>
  );
}
