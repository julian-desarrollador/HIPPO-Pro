// Opens a lottery agency for someone who does not have an account yet.
// Always lottery. Racing and both stay on create-agency, which needs a session.
// Deploy with JWT verification off: supabase functions deploy signup-lottery --no-verify-jwt
// The app calls it with the anon key only. Never put the service role in the app.
// Keep the Spanish messages aligned with lotterySignupProblem in src/modules/identity/agency-invite.ts.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const agencyNameMaxLength = 80;
const doloresRacetrackIds = ["san-isidro", "palermo", "la-plata"];
const doloresPartnerCategoryIds = ["adelanto-fede", "adelanto-mati", "retiro-sag-fede", "retiro-sag-mati"];

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function agencyIdFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

function signupProblem(agencyName: string, ownerName: string, ownerEmail: string, password: string): string | null {
  const name = agencyName.trim();
  if (!name) {
    return "Escribí el nombre de la agencia.";
  }
  if (name.length > agencyNameMaxLength) {
    return "El nombre de la agencia es muy largo.";
  }
  if (!agencyIdFromName(name)) {
    return "El nombre de la agencia necesita letras o números.";
  }
  if (!ownerName.trim()) {
    return "Escribí el nombre del dueño.";
  }
  const cleanEmail = ownerEmail.trim();
  if (!cleanEmail) {
    return "Escribí el correo.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return "El correo no es válido.";
  }
  if (password.length < 6) {
    return "La contraseña tiene que tener al menos 6 caracteres.";
  }
  return null;
}

function currentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

function emptyAgencySnapshot(agencyId: string): Record<string, unknown> {
  return {
    agencyId,
    month: currentMonth(),
    days: [],
    deposits: [],
    expenses: [],
    openingBalances: [],
    hiddenRacetrackIds: doloresRacetrackIds,
    hiddenCategoryIds: doloresPartnerCategoryIds,
  };
}

function readText(body: object, key: string): string {
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function alreadyRegistered(message: string): boolean {
  return /already|registered|exists/i.test(message);
}

async function removeAgency(admin: SupabaseClient, agencyId: string): Promise<void> {
  await admin.from("ledgers").delete().eq("agency_id", agencyId);
  await admin.from("agencies").delete().eq("agency_id", agencyId);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { message: "No se pudo completar." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { message: "No se pudo crear la agencia." });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: object = {};
  try {
    const parsed: unknown = await req.json();
    if (parsed && typeof parsed === "object") {
      body = parsed;
    }
  } catch {
    return json(400, { message: "No se pudo crear la agencia." });
  }

  const agencyName = readText(body, "agencyName");
  const ownerName = readText(body, "ownerName");
  const ownerEmail = readText(body, "ownerEmail");
  const password = readText(body, "password");
  const problem = signupProblem(agencyName, ownerName, ownerEmail, password);
  if (problem) {
    return json(400, { message: problem });
  }

  const name = agencyName.trim().replace(/\s+/g, " ");
  const agencyId = agencyIdFromName(name);
  const cleanOwner = ownerName.trim();
  const cleanEmail = ownerEmail.trim().toLowerCase();

  const { error: agencyError } = await admin.from("agencies").insert({
    agency_id: agencyId,
    name,
    product_mode: "lottery",
  });
  if (agencyError) {
    return agencyError.code === "23505"
      ? json(409, { message: "Ya hay una agencia con ese nombre." })
      : json(400, { message: "No se pudo crear la agencia." });
  }

  const { error: ledgerError } = await admin
    .from("ledgers")
    .insert({ agency_id: agencyId, snapshot: emptyAgencySnapshot(agencyId) });
  if (ledgerError) {
    await removeAgency(admin, agencyId);
    return json(400, { message: "No se pudo crear la agencia." });
  }

  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
  });
  if (userError || !created.user) {
    await removeAgency(admin, agencyId);
    const message = userError?.message ?? "";
    return json(alreadyRegistered(message) ? 409 : 400, {
      message: alreadyRegistered(message) ? "Ese correo ya tiene una cuenta." : "No se pudo crear la cuenta.",
    });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    user_id: created.user.id,
    agency_id: agencyId,
    role: "owner",
    display_name: cleanOwner,
    email: cleanEmail,
    can_invite_owners: true,
    can_create_agencies: false,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    await removeAgency(admin, agencyId);
    return json(400, { message: "No se pudo crear el dueño." });
  }

  return json(200, { ok: true });
});
