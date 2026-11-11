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
import { AddServiceAction, AgencyServiceCards, RemoveServiceActions } from "@/components/add-service-card";
import { SectionTitle } from "@/components/screen-frame";
import { ServiceIcons } from "@/components/service-tags";
import { ConfirmNotice, NoticeLine, NoticeName } from "@/components/confirm-notice";
import { wideLayout } from "@/constants/layout";
import { usePalette } from "@/constants/palette";
import {
  useAgencyAdmin,
  type AgencyEntry,
  type CreateAgencyOptions,
} from "@/modules/identity/agency-admin";
import { removalNameMatches } from "@/modules/identity/agency-invite";
import { canAddService, useAgencyVisit, useLedger, type AgencyMode, type AgencyService } from "@/modules/ledger";

/** Tests can be removed from the list. Someone else's shows up only for whoever manages the trash. */
function isTest(agency: AgencyEntry): boolean {
  return agency.kind === "personal" || agency.kind === "test";
}

/** Under the name: a test, or another agency of this same account. */
function testTag(agency: AgencyEntry): string | null {
  if (agency.kind === "home") {
    return "Tuya";
  }
  if (agency.kind === "personal") {
    return "Prueba";
  }
  if (agency.kind === "test") {
    return agency.testOf ? `Prueba de ${agency.testOf}` : "Prueba de otra persona";
  }
  return null;
}

export function AgencyMenuList({
  active,
  onEntered,
}: {
  active: boolean;
  onEntered: () => void;
}) {
  const admin = useAgencyAdmin();
  const visit = useAgencyVisit();
  const { snapshot, sessionAgencyId, switchAgency } = useLedger();
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
    if (agency.kind === "home" && switchAgency) {
      switchAgency(agency.agencyId);
      onEntered();
      return;
    }
    setBusy(true);
    setError("");
    if (agency.kind === "personal") {
      const problem = await openPersonalVisit(agency.agencyId, agency.name, agency.productMode);
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
          <Text className="px-4 py-3 text-[17px] font-semibold text-navy">Cargando…</Text>
        ) : null}
        {agencies.map((agency, index) => {
          const isSession = agency.agencyId === sessionAgencyId;
          const choosable = !isSession && agency.agencyId !== viewedAgencyId;
          const last = index === agencies.length - 1;
          const label = (
            <>
              {/* The tag goes under the name, so a long one does not cut the name on a phone. */}
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="shrink text-[17px] font-semibold text-navy" numberOfLines={1}>
                    {agency.name}
                  </Text>
                  <ServiceIcons mode={agency.productMode} />
                </View>
                {choosable && testTag(agency) ? (
                  <Text className="text-[15px] text-muted" numberOfLines={1}>
                    {testTag(agency)}
                  </Text>
                ) : null}
              </View>
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
              {isTest(agency) ? (
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
        detail="Sale de la lista. Si fue un error, se puede recuperar."
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
  onBack,
}: {
  visible: boolean;
  onClose: () => void;
  onBack?: () => void;
}) {
  const admin = useAgencyAdmin();
  const visit = useAgencyVisit();
  const { snapshot, sessionAgencyId, role, readOnly, agencyMode, addService, removeService, switchAgency } = useLedger();
  const viewedAgencyId = snapshot.agencyId;
  const serviceToAdd = role === "owner" && !readOnly ? canAddService(agencyMode) : null;
  const canRemoveService = role === "owner" && !readOnly && agencyMode === "both" && removeService !== null;
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
  const [pendingArchive, setPendingArchive] = useState<AgencyEntry | null>(null);
  const [archiveName, setArchiveName] = useState("");
  const [archiveError, setArchiveError] = useState("");
  const [archiveBusy, setArchiveBusy] = useState(false);
  /** Something to confirm before creating: a repeated name, or an owner email with an account. */
  const [ask, setAsk] = useState<{ kind: "name-taken" | "existing-account"; options: CreateAgencyOptions } | null>(null);
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

  function reset() {
    setAgencyName("");
    setPersonalName("");
    setOwnerName("");
    setOwnerEmail("");
    setCreateMode("racing");
    setPersonalMode("racing");
    setError("");
    setPersonalError("");
    setMessage("");
    setAsk(null);
  }

  function close() {
    reset();
    onClose();
  }

  function back() {
    reset();
    if (onBack) {
      onBack();
      return;
    }
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

  async function create(options: CreateAgencyOptions = {}) {
    if (busy || personalBusy) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const result = await directory.create(agencyName, ownerName, ownerEmail, createMode, options);
    if (result.status === "name-taken" || result.status === "existing-account") {
      setAsk({ kind: result.status, options });
      setBusy(false);
      return;
    }
    if (result.status === "error") {
      setError(result.message);
      setBusy(false);
      return;
    }
    const created = agencyName.trim();
    setAgencyName("");
    setOwnerName("");
    setOwnerEmail("");
    setMessage(
      `${created} quedó creada. ${result.notice ?? "Le enviamos al dueño un correo para que elija su contraseña."}`,
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
    if (agency.kind === "home" && switchAgency) {
      switchAgency(agency.agencyId);
      close();
      return;
    }
    setBusy(true);
    setError("");
    setPersonalError("");
    setMessage("");
    if (agency.kind === "personal") {
      const problem = await visit.openPersonal(agency.agencyId, agency.name, agency.productMode);
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

  function askArchive(agency: AgencyEntry) {
    setArchiveName("");
    setArchiveError("");
    setPendingArchive(agency);
  }

  function cancelArchive() {
    if (archiveBusy) {
      return;
    }
    setPendingArchive(null);
    setArchiveName("");
    setArchiveError("");
  }

  async function confirmArchive() {
    if (!pendingArchive || archiveBusy || !removalNameMatches(archiveName, pendingArchive.name)) {
      return;
    }
    const agency = pendingArchive;
    setArchiveBusy(true);
    setArchiveError("");
    const problem = await directory.archive(agency, archiveName);
    if (problem) {
      setArchiveError(problem);
      setArchiveBusy(false);
      return;
    }
    if (agency.agencyId === viewedAgencyId) {
      visit?.leave();
    }
    setAgencies((rows) => rows.filter((row) => row.agencyId !== agency.agencyId));
    setMessage(`${agency.name} se quitó. Sus datos quedan guardados.`);
    setArchiveBusy(false);
    setPendingArchive(null);
    setArchiveName("");
  }

  const panel = (openAdd?: () => void, openRemove?: (service: AgencyService) => void) => (
    <>
    <Dialog visible={visible} title="Agencias" onClose={close} onBack={onBack ? back : undefined} wide={wide}>
      <View
        className={
          wide ? "flex-row items-start gap-6" : "w-full flex-col gap-5"
        }
      >
        <View className={wide ? "min-w-0 flex-1 gap-4" : "w-full gap-4"}>
          <Text className="text-[17px] font-semibold leading-6 text-navy">
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
            <Text className="text-[17px] font-semibold leading-6 text-navy">
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
            <Text className="text-[17px] font-semibold text-navy">Cargando…</Text>
          ) : null}
          {agencies.map((agency) => {
            const current = agency.agencyId === viewedAgencyId;
            const isSession = agency.agencyId === sessionAgencyId;
            const place = current ? (isSession ? "Tu agencia" : "Mirando") : isSession ? "Tu agencia" : null;
            return (
            <View
              key={agency.agencyId}
              className="gap-3 rounded-[14px] border border-line px-4 py-3"
            >
              <View className="flex-row items-center gap-3">
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="shrink text-[17px] font-semibold text-navy" numberOfLines={1}>
                      {agency.name}
                    </Text>
                    <ServiceIcons mode={agency.productMode} />
                  </View>
                  {!place && testTag(agency) ? (
                    <Text className="text-[15px] text-muted" numberOfLines={1}>
                      {testTag(agency)}
                    </Text>
                  ) : null}
                </View>
                {place ? <Text className="shrink-0 text-[15px] text-muted">{place}</Text> : null}
                {visit && agency.agencyId !== sessionAgencyId && !current ? (
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
                {isTest(agency) ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar ${agency.name}`}
                    onPress={() => setPendingRemoval(agency)}
                    className="cursor-pointer"
                  >
                    <Text className="text-[17px] font-semibold text-negative">Quitar</Text>
                  </Pressable>
                ) : null}
                {agency.kind === "other" && !isSession ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar ${agency.name}`}
                    onPress={() => askArchive(agency)}
                    className="cursor-pointer"
                  >
                    <Text className="text-[17px] font-semibold text-negative">Quitar</Text>
                  </Pressable>
                ) : null}
              </View>
              {current && (serviceToAdd || canRemoveService) ? (
                <AgencyServiceCards
                  mode={agencyMode}
                  onAdd={serviceToAdd && openAdd ? openAdd : undefined}
                  onRemove={canRemoveService && openRemove ? openRemove : undefined}
                />
              ) : null}
            </View>
            );
          })}
        </View>
      </View>
    </Dialog>
    <ConfirmDialog
      visible={pendingRemoval !== null}
      title={pendingRemoval ? `¿Quitar ${pendingRemoval.name}?` : "¿Quitar esta agencia?"}
      detail="Sale de la lista. Si fue un error, se puede recuperar."
      confirmLabel="Quitar"
      onCancel={() => setPendingRemoval(null)}
      onConfirm={() => void confirmRemoval()}
    />
    <ConfirmDialog
      visible={ask !== null}
      title={ask?.kind === "name-taken" ? "Ya hay una agencia con ese nombre" : "Ese correo ya tiene cuenta"}
      confirmLabel="Continuar"
      onCancel={() => setAsk(null)}
      onConfirm={() => {
        const pending = ask;
        setAsk(null);
        if (pending) {
          void create(
            pending.kind === "name-taken"
              ? { ...pending.options, allowDuplicateName: true }
              : { ...pending.options, confirmExisting: true },
          );
        }
      }}
    >
      {ask?.kind === "name-taken" ? (
        <ConfirmNotice subject={agencyName.trim()}>
          <NoticeLine>Si es otra agencia, podés crearla igual.</NoticeLine>
          <NoticeLine>
            Si querías volver a invitar al dueño, cancelá: crearla de nuevo arma otra agencia vacía.
          </NoticeLine>
        </ConfirmNotice>
      ) : (
        <ConfirmNotice subject={ownerEmail.trim().toLowerCase()}>
          <NoticeLine>Ya entra a HippoPro.</NoticeLine>
          <NoticeLine>
            Si seguís, <NoticeName>{agencyName.trim()}</NoticeName> se suma a su cuenta y entra con su contraseña de siempre.
          </NoticeLine>
        </ConfirmNotice>
      )}
    </ConfirmDialog>
    <ConfirmDialog
      visible={pendingArchive !== null}
      title={pendingArchive ? `¿Quitar ${pendingArchive.name}?` : "¿Quitar esta agencia?"}
      detail="Sale de la lista y su gente ya no entra. El libro, las personas y las fotos quedan guardados. Si fue un error, se puede recuperar."
      confirmLabel="Quitar"
      confirmEnabled={!archiveBusy && pendingArchive !== null && removalNameMatches(archiveName, pendingArchive.name)}
      onCancel={cancelArchive}
      onConfirm={() => void confirmArchive()}
    >
      <Field label={pendingArchive ? `Escribí ${pendingArchive.name} para confirmar` : "Escribí el nombre para confirmar"}>
        <TextField
          value={archiveName}
          onChangeText={(text) => {
            setArchiveName(text);
            setArchiveError("");
          }}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={pendingArchive?.name ?? ""}
          accessibilityLabel="Nombre de la agencia para confirmar"
        />
      </Field>
      {archiveBusy ? <Text className="mt-2 text-[15px] text-muted">Quitando…</Text> : null}
      {archiveError ? <Text className="mt-2 text-[15px] text-negative">{archiveError}</Text> : null}
    </ConfirmDialog>
    </>
  );

  if (serviceToAdd && addService) {
    const add = addService;
    return (
      <AddServiceAction service={serviceToAdd} onAdd={() => add(serviceToAdd)}>
        {(openAdd) => panel(openAdd)}
      </AddServiceAction>
    );
  }
  if (canRemoveService && removeService) {
    return (
      <RemoveServiceActions onRemove={removeService}>
        {(openRemove) => panel(undefined, openRemove)}
      </RemoveServiceActions>
    );
  }
  return panel();
}

const MODE_OPTIONS: { id: AgencyMode; label: string }[] = [
  { id: "racing", label: "Hípica" },
  { id: "lottery", label: "Lotería" },
];

function ModeField({ value, onChange }: { value: AgencyMode; onChange: (mode: AgencyMode) => void }) {
  return (
    <Field label="Qué usa">
      <ChoiceChips options={MODE_OPTIONS} value={value} onChange={onChange} />
    </Field>
  );
}
