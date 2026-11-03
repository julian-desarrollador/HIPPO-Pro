import { useEffect, useState } from "react";
import { Linking, Pressable, Text, useWindowDimensions, View } from "react-native";

import { Dialog, Feedback } from "@/components/form-controls";
import { SectionTitle } from "@/components/screen-frame";
import { wideLayout } from "@/constants/layout";
import { whatsappGreeting, whatsappLink } from "@/modules/support/support-question";
import {
  listSupportQuestions,
  markSupportQuestionAnswered,
  type SupportQuestion,
} from "@/modules/support/support-questions";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Consultas: questions left from /entrada or Ayuda. Only for who can create agencies. */
export function SupportInbox({
  visible,
  onClose,
  onBack,
  userId,
}: {
  visible: boolean;
  onClose: () => void;
  onBack?: () => void;
  userId: string;
}) {
  // Null while the list loads. Closing the panel resets it, so opening it again reloads.
  const [loaded, setLoaded] = useState<SupportQuestion[] | null>(null);
  const [error, setError] = useState("");
  const wide = useWindowDimensions().width >= wideLayout;
  const loading = visible && loaded === null && !error;
  const rows = loaded ?? [];

  useEffect(() => {
    if (!visible) {
      return;
    }
    let alive = true;
    void listSupportQuestions().then((result) => {
      if (!alive) {
        return;
      }
      if (typeof result === "string") {
        setLoaded([]);
        setError(result);
      } else {
        setLoaded(result);
      }
    });
    return () => {
      alive = false;
    };
  }, [visible]);

  function reset() {
    setLoaded(null);
    setError("");
  }

  function close() {
    reset();
    onClose();
  }

  function back() {
    reset();
    (onBack ?? onClose)();
  }

  async function answer(row: SupportQuestion) {
    setError("");
    const problem = await markSupportQuestionAnswered(row.id, userId);
    if (problem) {
      setError(problem);
      return;
    }
    const answeredAt = new Date().toISOString();
    setLoaded((current) => (current ?? []).map((item) => (item.id === row.id ? { ...item, answeredAt } : item)));
  }

  const pending = rows.filter((row) => !row.answeredAt);
  const answered = rows.filter((row) => row.answeredAt);

  return (
    <Dialog visible={visible} title="Consultas" onClose={close} onBack={back} wide={wide} maxWidth={760}>
      <View className="gap-4">
        {loading ? <Text className="text-[17px] font-semibold text-navy">Cargando…</Text> : null}
        <Feedback error={error} />
        <SectionTitle title={`Sin responder (${pending.length})`} />
        {!loading && pending.length === 0 ? (
          <Text className="text-[17px] text-muted">No hay preguntas nuevas.</Text>
        ) : null}
        {pending.map((row) => (
          <QuestionRow key={row.id} row={row} onAnswered={() => void answer(row)} />
        ))}
        {answered.length > 0 ? (
          <>
            <SectionTitle title={`Respondidas (${answered.length})`} />
            {answered.map((row) => (
              <QuestionRow key={row.id} row={row} />
            ))}
          </>
        ) : null}
      </View>
    </Dialog>
  );
}

function QuestionRow({ row, onAnswered }: { row: SupportQuestion; onAnswered?: () => void }) {
  const link = whatsappLink(row.phone, whatsappGreeting(row.name));
  const origin = row.source === "ayuda" ? `Desde adentro${row.agencyId ? ` · ${row.agencyId}` : ""}` : "Desde la entrada";

  return (
    <View className={row.answeredAt ? "gap-2 rounded-[12px] border border-line bg-card p-4 opacity-70" : "gap-2 rounded-[12px] border border-line bg-card p-4"}>
      <View className="flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
        <Text className="text-[17px] font-semibold text-navy">{row.name || "Sin nombre"}</Text>
        <Text className="text-[15px] text-muted">{row.phone}</Text>
        <Text className="text-[14px] text-muted">
          {formatWhen(row.createdAt)} · {origin}
        </Text>
      </View>
      <Text className="text-[16px] leading-6 text-ink">{row.question}</Text>
      <View className="flex-row flex-wrap items-center gap-4 pt-1">
        {link ? (
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(link)} className="cursor-pointer">
            <Text className="text-[16px] font-semibold text-accent">Abrir WhatsApp</Text>
          </Pressable>
        ) : (
          <Text className="text-[15px] text-muted">No se pudo armar el WhatsApp con ese número.</Text>
        )}
        {onAnswered ? (
          <Pressable accessibilityRole="button" onPress={onAnswered} className="cursor-pointer">
            <Text className="text-[16px] font-semibold text-navy">Marcar respondida</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
