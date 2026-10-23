import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

import {
  ChoiceChips,
  ConfirmDialog,
  Dialog,
  Feedback,
  Field,
  PrimaryButton,
  TextField,
} from "@/components/form-controls";
import { SectionTitle } from "@/components/screen-frame";
import { wideLayout } from "@/constants/layout";
import { usePalette } from "@/constants/palette";
import {
  useAgencyAdmin,
  type AgencyEntry,
} from "@/modules/identity/agency-admin";
import { useAgencyVisit, useLedger, type AgencyMode } from "@/modules/ledger";

export function AgencyMenuList({
  active,
  onEntered,
}: {
  active: boolean;
  onEntered: () => void;
}) {
  const admin = useAgencyAdmin();
  const visit = useAgencyVisit();
  const { snapshot, sessionAgencyId } = useLedger();
  const viewedAgencyId = snapshot.agencyId;
  const [agencies, setAgencies] = useState<AgencyEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<AgencyEntry | null>(null);
  const palette = usePalette();

  useEffect(() => {
    if (!active || !admin) {
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    const directory = admin;
    void (async () => {
      try {
        const rows = await directory.list();
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
  }, [active, admin]);

  if (!admin || !visit) {
    return null;
  }
  const directory = admin;
  const openVisit = visit.open;
  const openPersonalVisit = visit.openPersonal;
  const leaveVisit = visit.leave;

  async function confirmRemoval() {
    if (!pendingRemoval || busy) {
      return;
    }
    const agency = pendingRemoval;
    setBusy(true);
    setError("");
    const problem = await directory.removePersonal(agency.agencyId);
    if (problem) {
      setError(problem);
      setBusy(false);
      setPendingRemoval(null);
      return;
    }
    if (agency.agencyId === viewedAgencyId) {
      leaveVisit();
    }
    setAgencies((rows) => rows.filter((row) => row.agencyId !== agency.agencyId));
    setBusy(false);
    setPendingRemoval(null);
  }

  async function enter(agency: AgencyEntry) {
    if (busy || agency.agencyId === sessionAgencyId || agency.agencyId === viewedAgencyId) {
      return;
    }
    setBusy(true);
    setError("");
    if (agency.kind === "personal") {
      const problem = await openPersonalVisit(agency.agencyId, agency.name);
      if (problem) {
        setError(problem);
        setBusy(false);
        return;
      }
      setBusy(false);
      onEntered();
      return;
    }
    const opened = await directory.read(agency.agencyId);
    if (typeof opened === "string") {
      setError(opened);
      setBusy(false);
      return;
    }
    openVisit(opened);
    setBusy(false);
    onEntered();
  }

  return (
    <View className="gap-2">
      {loading || agencies.length > 0 ? (
      <View className="overflow-hidden rounded-[14px] border border-line">
        {loading && agencies.length === 0 ? (
          <Text className="px-4 py-3 text-[17px] text-ink">Cargando…</Text>
        ) : null}
        {agencies.map((agency, index) => {
          const isSession = agency.agencyId === sessionAgencyId;
          const choosable = !isSession && agency.agencyId !== viewedAgencyId;
          const last = index === agencies.length - 1;
          const label = (
            <>
              <Text className="min-w-0 flex-1 text-[17px] font-semibold text-navy" numberOfLines={1}>
                {agency.name}
              </Text>
              {choosable && agency.kind === "personal" ? (
                <Text className="shrink-0 text-[15px] text-muted">Prueba</Text>
              ) : null}
              {choosable ? (
                <Ionicons name="chevron-forward" size={18} color={palette.accent} />
              ) : (
                <Text className="shrink-0 text-[15px] text-muted">{isSession ? "Tu agencia" : "Mirando"}</Text>
              )}
            </>
          );
          return (
            <View
              key={agency.agencyId}
              className={
                last
                  ? "flex-row items-center gap-3 px-4 py-3"
                  : "flex-row items-center gap-3 border-b border-line px-4 py-3"
              }
            >
              {choosable ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Entrar a ${agency.name}`}
                  onPress={() => void enter(agency)}
                  className="min-w-0 flex-1 cursor-pointer flex-row items-center gap-3"
                  style={({ pressed }) => (pressed ? { backgroundColor: palette.tint } : undefined)}
                >
                  {label}
                </Pressable>
              ) : (
                <View className="min-w-0 flex-1 flex-row items-center gap-3">{label}</View>
              )}
              {agency.kind === "personal" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar ${agency.name}`}
                  onPress={() => setPendingRemoval(agency)}
                  className="cursor-pointer"
                >
                  <Text className="text-[15px] font-semibold text-negative">Quitar</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
      ) : null}
      {error ? <Text className="text-[15px] text-negative">{error}</Text> : null}
      <ConfirmDialog
        visible={pendingRemoval !== null}
        title={pendingRemoval ? `¿Quitar ${pendingRemoval.name}?` : "¿Quitar esta agencia?"}
        detail="Se borra el libro y las fotos. No se puede deshacer."
        confirmLabel="Quitar"
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => void confirmRemoval()}
      />
    </View>
  );
}

export function AgenciesPanel({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const admin = useAgencyAdmin();
  const visit = useAgencyVisit();
  const { snapshot, sessionAgencyId } = useLedger();
  const viewedAgencyId = snapshot.agencyId;
  const [agencies, setAgencies] = useState<AgencyEntry[]>([]);
  const [agencyName, setAgencyName] = useState("");
  const [personalName, setPersonalName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [createMode, setCreateMode] = useState<AgencyMode>("racing");
  const [personalMode, setPersonalMode] = useState<AgencyMode>("racing");
  const [error, setError] = useState("");
  const [personalError, setPersonalError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [personalBusy, setPersonalBusy] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<AgencyEntry | null>(null);
  const wide = useWindowDimensions().width >= wideLayout;

  useEffect(() => {
    if (!visible || !admin) {
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    const directory = admin;
    void (async () => {
      try {
        const rows = await directory.list();
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

  function close() {
    setAgencyName("");
    setPersonalName("");
    setOwnerName("");
    setOwnerEmail("");
    setCreateMode("racing");
    setPersonalMode("racing");
    setError("");
    setPersonalError("");
    setMessage("");
    onClose();
  }

  async function createPersonalAgency() {
    if (busy || personalBusy || !visit) {
      return;
    }
    setPersonalBusy(true);
    setPersonalError("");
    setError("");
    setMessage("");
    const created = await directory.createPersonal(personalName, personalMode);
    if (typeof created === "string") {
      setPersonalError(created);
      setPersonalBusy(false);
      return;
    }
    const problem = await visit.openPersonal(created.agencyId, created.name, personalMode);
    if (problem) {
      setPersonalError(problem);
      setPersonalBusy(false);
      return;
    }
    setPersonalName("");
    setPersonalBusy(false);
    close();
  }

  async function create() {
    if (busy || personalBusy) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const problem = await directory.create(agencyName, ownerName, ownerEmail, createMode);
    if (problem) {
      setError(problem);
      setBusy(false);
      return;
    }
    const created = agencyName.trim();
    setAgencyName("");
    setOwnerName("");
    setOwnerEmail("");
    setMessage(
      `${created} quedó creada. Le enviamos al dueño un correo para que elija su contraseña.`,
    );
    try {
      setAgencies(await directory.list());
    } catch {
      setError("No se pudo cargar la lista.");
    }
    setBusy(false);
  }

  async function enter(agency: AgencyEntry) {
    if (busy || personalBusy || !visit) {
      return;
    }
    setBusy(true);
    setError("");
    setPersonalError("");
    setMessage("");
    if (agency.kind === "personal") {
      const problem = await visit.openPersonal(agency.agencyId, agency.name);
      if (problem) {
        setError(problem);
        setBusy(false);
        return;
      }
      setBusy(false);
      close();
      return;
    }
    const opened = await directory.read(agency.agencyId);
    if (typeof opened === "string") {
      setError(opened);
      setBusy(false);
      return;
    }
    visit.open(opened);
    setBusy(false);
    close();
  }

  async function confirmRemoval() {
    if (!pendingRemoval || busy || personalBusy || !visit) {
      return;
    }
    const agency = pendingRemoval;
    setBusy(true);
    setError("");
    const problem = await directory.removePersonal(agency.agencyId);
    if (problem) {
      setError(problem);
      setBusy(false);
      setPendingRemoval(null);
      return;
    }
    if (agency.agencyId === viewedAgencyId) {
      visit.leave();
    }
    setAgencies((rows) => rows.filter((row) => row.agencyId !== agency.agencyId));
    setBusy(false);
    setPendingRemoval(null);
  }

  return (
    <>
    <Dialog visible={visible} title="Agencias" onClose={close} wide={wide}>
      <View
        className={
          wide ? "flex-row items-start gap-6" : "w-full flex-col gap-5"
        }
      >
        <View className={wide ? "min-w-0 flex-1 gap-4" : "w-full gap-4"}>
          <Text className="text-[17px] leading-6 text-ink">
            El dueño recibe un correo, elige su contraseña y entra a un libro
            vacío. Vos no quedás en esa agencia.
          </Text>
          <Field label="Nombre de la agencia">
            <TextField
              value={agencyName}
              onChangeText={setAgencyName}
              placeholder="Agencia Norte"
              accessibilityLabel="Nombre de la agencia"
            />
          </Field>
          <Field label="Nombre del dueño">
            <TextField
              value={ownerName}
              onChangeText={setOwnerName}
              placeholder="Nombre"
              accessibilityLabel="Nombre del dueño"
            />
          </Field>
          <Field label="Correo del dueño">
            <TextField
              value={ownerEmail}
              onChangeText={setOwnerEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="correo@agencia.com"
              accessibilityLabel="Correo del dueño"
            />
          </Field>
          <ModeField value={createMode} onChange={setCreateMode} />
          <PrimaryButton
            label={busy ? "Enviando…" : "Crear e invitar"}
            onPress={() => void create()}
          />
          <Feedback error={error} message={message} />
          <View className="gap-4 border-t border-line pt-4">
            <Text className="text-[17px] leading-6 text-ink">
              Queda a tu nombre. Nadie más entra. El libro empieza vacío.
            </Text>
            <Field label="Nombre de la prueba">
              <TextField
                value={personalName}
                onChangeText={setPersonalName}
                placeholder="Agencia Norte"
                accessibilityLabel="Nombre de la prueba"
              />
            </Field>
            <ModeField value={personalMode} onChange={setPersonalMode} />
            <PrimaryButton
              label={personalBusy ? "Creando…" : "Crear y entrar"}
              onPress={() => void createPersonalAgency()}
            />
            <Feedback error={personalError} message="" />
          </View>
        </View>
        <View className={wide ? "min-w-0 flex-1 gap-3" : "w-full gap-3"}>
          <SectionTitle title="Agencias" />
          {loading ? (
            <Text className="text-[17px] text-ink">Cargando…</Text>
          ) : null}
          {agencies.map((agency) => (
            <View
              key={agency.agencyId}
              className="flex-row items-center gap-3 rounded-[14px] border border-line px-4 py-3"
            >
              <Text
                className="min-w-0 flex-1 text-[17px] font-semibold text-navy"
                numberOfLines={1}
              >
                {agency.name}
              </Text>
              {visit && agency.agencyId !== sessionAgencyId && agency.agencyId !== viewedAgencyId ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Entrar a ${agency.name}`}
                  onPress={() => void enter(agency)}
                  className="cursor-pointer"
                >
                  <Text className="text-[17px] font-semibold text-accent">
                    Entrar
                  </Text>
                </Pressable>
              ) : null}
              {agency.kind === "personal" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar ${agency.name}`}
                  onPress={() => setPendingRemoval(agency)}
                  className="cursor-pointer"
                >
                  <Text className="text-[17px] font-semibold text-negative">Quitar</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </Dialog>
    <ConfirmDialog
      visible={pendingRemoval !== null}
      title={pendingRemoval ? `¿Quitar ${pendingRemoval.name}?` : "¿Quitar esta agencia?"}
      detail="Se borra el libro y las fotos. No se puede deshacer."
      confirmLabel="Quitar"
      onCancel={() => setPendingRemoval(null)}
      onConfirm={() => void confirmRemoval()}
    />
    </>
  );
}

const MODE_OPTIONS: { id: AgencyMode; label: string }[] = [
  { id: "racing", label: "Hípica" },
  { id: "lottery", label: "Lotería" },
  { id: "both", label: "Las dos" },
];

function ModeField({ value, onChange }: { value: AgencyMode; onChange: (mode: AgencyMode) => void }) {
  return (
    <Field label="Qué usa">
      <ChoiceChips options={MODE_OPTIONS} value={value} onChange={onChange} />
    </Field>
  );
}
