import type { SupabaseClient } from "@supabase/supabase-js";

import { browserSupabase } from "@/modules/ledger/adapters/outbound/supabase-browser";
import { readSupabaseConfig } from "@/modules/ledger/adapters/outbound/supabase-config";

import { supportQuestionProblem } from "./support-question";

export type SupportSource = "entrada" | "ayuda";

export type SupportQuestionInput = {
  name: string;
  phone: string;
  question: string;
  source: SupportSource;
  userId?: string;
  agencyId?: string;
};

export type SupportQuestion = {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  question: string;
  source: SupportSource;
  agencyId: string | null;
  answeredAt: string | null;
};

/** The tab's only Supabase client, with the session when there is one. Null without Supabase. */
export function supportClient(): SupabaseClient | null {
  const config = readSupabaseConfig();
  if (!config || config === "incomplete") {
    return null;
  }
  return browserSupabase(config);
}

/** Null when it was saved. Otherwise the message to show. */
export async function sendSupportQuestion(input: SupportQuestionInput): Promise<string | null> {
  const problem = supportQuestionProblem(input.name, input.phone, input.question);
  if (problem) {
    return problem;
  }
  const client = supportClient();
  if (!client) {
    return "No se pudo enviar. Probá de nuevo más tarde.";
  }
  const { error } = await client.from("support_questions").insert({
    name: input.name.trim().replace(/\s+/g, " "),
    phone: input.phone.trim(),
    question: input.question.trim(),
    source: input.source,
    user_id: input.userId || null,
    agency_id: input.agencyId || null,
  });
  return error ? "No se pudo enviar. Probá de nuevo más tarde." : null;
}

function supportQuestionFrom(value: unknown): SupportQuestion | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.phone !== "string" || typeof row.question !== "string") {
    return null;
  }
  return {
    id: row.id,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    name: typeof row.name === "string" ? row.name : "",
    phone: row.phone,
    question: row.question,
    source: row.source === "ayuda" ? "ayuda" : "entrada",
    agencyId: typeof row.agency_id === "string" ? row.agency_id : null,
    answeredAt: typeof row.answered_at === "string" ? row.answered_at : null,
  };
}

/** Newest first. Only a profile that can create agencies gets rows back. */
export async function listSupportQuestions(): Promise<SupportQuestion[] | string> {
  const client = supportClient();
  if (!client) {
    return "No se pudo cargar la lista.";
  }
  const { data, error } = await client
    .from("support_questions")
    .select("id, created_at, name, phone, question, source, agency_id, answered_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) {
    return "No se pudo cargar la lista.";
  }
  return data.map(supportQuestionFrom).filter((row): row is SupportQuestion => row !== null);
}

export async function markSupportQuestionAnswered(id: string, userId: string): Promise<string | null> {
  const client = supportClient();
  if (!client) {
    return "No se pudo guardar.";
  }
  const { error } = await client
    .from("support_questions")
    .update({ answered_at: new Date().toISOString(), answered_by: userId || null })
    .eq("id", id);
  return error ? "No se pudo guardar." : null;
}
