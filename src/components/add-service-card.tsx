import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { ConfirmDialog } from "@/components/form-controls";
import { lotteryPalette, palette } from "@/constants/palette";
import { seesLottery, seesRacing, type AgencyMode, type AgencyService } from "@/modules/ledger";

const COPY: Record<AgencyService, { title: string; detail: string; confirm: string; button: string }> = {
  lottery: {
    title: "¿Sumar lotería?",
    detail: "Se abre la quiniela en esta agencia. La hípica sigue igual.",
    confirm: "Sumar lotería",
    button: "Sumar lotería",
  },
  racing: {
    title: "¿Sumar hípica?",
    detail: "Se abre el libro de hípica en esta agencia. La quiniela sigue igual.",
    confirm: "Sumar hípica",
    button: "Sumar hípica",
  },
};

function problemOf(caught: unknown): string {
  if (caught instanceof Error && caught.message) {
    return caught.message;
  }
  return "No se pudo ampliar.";
}

/**
 * Button for the account menu, plus its confirm dialog.
 * The dialog stays mounted when the menu closes, so the confirm is not lost.
 */
export function AddServiceAction({
  service,
  onAdd,
  children,
}: {
  service: AgencyService;
  onAdd: () => Promise<void>;
  children: (open: () => void) => ReactNode;
}) {
  const copy = COPY[service];
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (saving) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onAdd();
      setOpen(false);
    } catch (caught) {
      setError(problemOf(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {children(() => {
        setError("");
        setOpen(true);
      })}
      <ConfirmDialog
        visible={open}
        title={copy.title}
        detail={error || copy.detail}
        confirmLabel={saving ? "Guardando…" : copy.confirm}
        onCancel={() => {
          if (!saving) {
            setOpen(false);
          }
        }}
        onConfirm={() => void confirm()}
      />
    </>
  );
}

const SERVICE_LOOK: Record<AgencyService, { name: string; wash: string; ink: string; accent: string }> = {
  racing: { name: "Hípica", wash: palette.tint, ink: palette.navy, accent: palette.accent },
  lottery: { name: "Lotería", wash: lotteryPalette.tint, ink: lotteryPalette.navy, accent: lotteryPalette.accent },
};

function serviceOn(mode: AgencyMode, service: AgencyService): boolean {
  return service === "racing" ? seesRacing(mode) : seesLottery(mode);
}

function ServiceCard({
  service,
  mode,
  onAdd,
  onRemove,
}: {
  service: AgencyService;
  mode: AgencyMode;
  onAdd?: () => void;
  onRemove?: (service: AgencyService) => void;
}) {
  const look = SERVICE_LOOK[service];
  const on = serviceOn(mode, service);
  const canAdd = !on && onAdd;
  const canRemove = on && mode === "both" && onRemove;

  return (
    <View
      className="flex-row overflow-hidden rounded-[14px] border"
      style={{ backgroundColor: look.wash, borderColor: look.accent }}
    >
      <View style={{ width: 6, backgroundColor: look.accent }} />
      <View className="min-w-0 flex-1 gap-2 px-3 py-3">
        <Text className="text-[17px] font-semibold" style={{ color: look.ink }}>
          {look.name}
        </Text>
        <Text className="text-[15px] font-semibold" style={{ color: look.ink }}>
          {on ? "En uso" : "Sin sumar"}
        </Text>
        {canAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sumar ${look.name}`}
            onPress={onAdd}
            className="cursor-pointer items-center rounded-[10px] px-4 py-2.5"
            style={{ backgroundColor: look.accent }}
          >
            <Text className="text-[16px] font-semibold text-white">Sumar</Text>
          </Pressable>
        ) : null}
        {canRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Quitar ${look.name}`}
            onPress={() => onRemove(service)}
            className="cursor-pointer items-center rounded-[10px] border px-4 py-2.5"
            style={{ borderColor: look.accent, backgroundColor: look.wash }}
          >
            <Text className="text-[16px] font-semibold" style={{ color: look.accent }}>
              Quitar
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Both services, in their own color, for the agency that is open. */
export function AgencyServiceCards({
  mode,
  onAdd,
  onRemove,
}: {
  mode: AgencyMode;
  onAdd?: () => void;
  onRemove?: (service: AgencyService) => void;
}) {
  return (
    <View className="gap-2">
      <ServiceCard service="racing" mode={mode} onAdd={onAdd} onRemove={onRemove} />
      <ServiceCard service="lottery" mode={mode} onAdd={onAdd} onRemove={onRemove} />
    </View>
  );
}

const REMOVE_COPY: Record<AgencyService, { title: string; detail: string; confirm: string; button: string }> = {
  lottery: {
    title: "¿Quitar lotería?",
    detail: "La quiniela deja de verse. Lo cargado queda guardado. La hípica sigue.",
    confirm: "Quitar lotería",
    button: "Quitar lotería",
  },
  racing: {
    title: "¿Quitar hípica?",
    detail: "La hípica deja de verse. Lo cargado queda guardado. La quiniela sigue.",
    confirm: "Quitar hípica",
    button: "Quitar hípica",
  },
};

function removeProblem(caught: unknown): string {
  if (caught instanceof Error && caught.message) {
    return caught.message;
  }
  return "No se pudo quitar.";
}

/**
 * Both remove buttons for the current agency row, plus the confirm.
 */
export function RemoveServiceActions({
  onRemove,
  children,
}: {
  onRemove: (service: AgencyService) => Promise<void>;
  children: (open: (service: AgencyService) => void) => ReactNode;
}) {
  const [pending, setPending] = useState<AgencyService | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const copy = pending ? REMOVE_COPY[pending] : null;

  async function confirm() {
    if (!pending || saving) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onRemove(pending);
      setPending(null);
    } catch (caught) {
      setError(removeProblem(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {children((service) => {
        setError("");
        setPending(service);
      })}
      <ConfirmDialog
        visible={pending !== null}
        title={copy?.title ?? "¿Quitar este servicio?"}
        detail={error || copy?.detail}
        confirmLabel={saving ? "Guardando…" : copy?.confirm ?? "Quitar servicio"}
        onCancel={() => {
          if (!saving) {
            setPending(null);
          }
        }}
        onConfirm={() => void confirm()}
      />
    </>
  );
}

