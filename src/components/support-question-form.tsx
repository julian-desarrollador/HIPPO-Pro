import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { TextField } from "@/components/form-controls";
import { usePalette } from "@/constants/palette";
import { sendSupportQuestion, type SupportSource } from "@/modules/support/support-questions";

// Many readers are older: labels, hints and messages are large and dark.
const inputStyle = { fontSize: 19, paddingVertical: 14 } as const;

/** A question the FAQ did not answer. Federico and Julián answer it by WhatsApp. */
export function SupportQuestionForm({
  source,
  initialName = "",
  userId,
  agencyId,
}: {
  source: SupportSource;
  initialName?: string;
  userId?: string;
  agencyId?: string;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const problem = await sendSupportQuestion({ name, phone, question, source, userId, agencyId });
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    setQuestion("");
    setMessage("Listo. Te escribimos por WhatsApp.");
  }

  return (
    <View className="gap-5">
      <View className="flex-row items-start gap-3.5">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-accent">
          <Ionicons name="logo-whatsapp" size={26} color="white" />
        </View>
        <View className="min-w-0 flex-1 gap-1.5">
          <Text className="text-[22px] font-bold text-navy">¿No encontraste tu duda?</Text>
          <Text className="text-[18px] leading-7 text-ink">
            Dejanos la pregunta y tu WhatsApp. Te escribimos nosotros, una persona, no un robot.
          </Text>
        </View>
      </View>
      <BigField label="Tu nombre" hint="Si querés.">
        <TextField value={name} onChangeText={setName} placeholder="Nombre" accessibilityLabel="Tu nombre" maxLength={80} style={inputStyle} />
      </BigField>
      <BigField label="Tu WhatsApp" hint="Con el código de área. Por ejemplo: 11 5555-5555.">
        <TextField
          value={phone}
          onChangeText={setPhone}
          placeholder="11 5555-5555"
          accessibilityLabel="Tu WhatsApp"
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={30}
          style={inputStyle}
        />
      </BigField>
      <BigField label="Tu pregunta">
        <TextField
          value={question}
          onChangeText={setQuestion}
          placeholder="Escribí lo que quieras saber"
          accessibilityLabel="Tu pregunta"
          multiline
          maxLength={1000}
          style={[inputStyle, { minHeight: 120, textAlignVertical: "top" }]}
        />
      </BigField>
      <Pressable
        accessibilityRole="button"
        onPress={() => void send()}
        className="cursor-pointer flex-row items-center justify-center gap-2.5 rounded-[12px] bg-accent px-5 py-4"
      >
        <Ionicons name="send" size={20} color="white" />
        <Text className="text-[19px] font-bold text-white">{busy ? "Enviando…" : "Enviar pregunta"}</Text>
      </Pressable>
      {error ? (
        <Notice icon="alert-circle" tone="text-negative">
          {error}
        </Notice>
      ) : null}
      {message ? (
        <Notice icon="checkmark-circle" tone="text-positive">
          {message}
        </Notice>
      ) : null}
    </View>
  );
}

function BigField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <View className="gap-0.5">
        <Text className="text-[19px] font-semibold text-navy">{label}</Text>
        {hint ? <Text className="text-[17px] leading-6 text-ink">{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Notice({ icon, tone, children }: { icon: "alert-circle" | "checkmark-circle"; tone: string; children: ReactNode }) {
  const palette = usePalette();
  return (
    <View className="flex-row items-start gap-2.5">
      <View style={{ marginTop: 2 }}>
        <Ionicons name={icon} size={24} color={icon === "alert-circle" ? palette.negative : palette.positive} />
      </View>
      <Text className={`min-w-0 flex-1 text-[18px] font-semibold leading-7 ${tone}`}>{children}</Text>
    </View>
  );
}
