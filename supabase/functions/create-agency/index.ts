// Creates an agency with an empty book and invites its first owner. An email
// that already has an account gets the agency added to it (multi-agency.sql).
// A repeated name answers code name-taken unless allowDuplicateName comes, and
// an email with an account answers code existing-account unless confirmExisting
// comes. Both before anything is created, so the app can ask first.
// read returns another agency's racing book and, if it has one, its lottery
// book, for a read-only visit.
// create-personal makes an empty book for the caller only, with no invite
// and no change to the caller's profile. list hides other people's personal
// agencies. archive removes a real agency from the list and from sign-in, and
// keeps its books, people and photos. Its name can be used again by a new
// agency with the next free id. delete-personal archives a test agency the
// same way. Only a profile with can_create_agencies may call it.
// list-archived, restore and purge are the trash: only a profile that also has
// can_manage_trash may call them. purge is the only action that deletes an
// agency's data for good.
// Runs with the service role inside Supabase.
// The app calls it with the caller's session and the anon key only.
// Keep the Spanish messages aligned with src/modules/identity/agency-invite.ts.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import { accountFor, addPersonToAgency, agencyCount, hasFullAccess, removePersonFromAgency } from "../_shared/memberships.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const publishedOrigin = "https://hippopro.com.ar";
const legacyOrigin = "https://hippo-pro.vercel.app";

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

function personalAgencyNameProblem(agencyName: string): string | null {
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
  return null;
}

function personalAgencyId(name: string): string {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  return `${agencyIdFromName(name)}-${suffix}`;
}

function newAgencyProblem(agencyName: string, ownerName: string, ownerEmail: string): string | null {
  const nameProblem = personalAgencyNameProblem(agencyName);
  if (nameProblem) {
    return nameProblem;
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

/** Keep aligned with createEmptyAgencySnapshot in src/modules/ledger/adapters/outbound/starting-snapshot.ts. */
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

function allowedRedirect(value: unknown): string {
  if (typeof value !== "string") {
    return publishedOrigin;
  }
  try {
    const url = new URL(value);
    if (url.origin === publishedOrigin || url.origin === legacyOrigin) {
      return url.origin;
    }
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
      return url.origin;
    }
  } catch {
    // A bad redirect falls back to the published site.
  }
  return publishedOrigin;
}

function productModeOf(value: unknown): "racing" | "lottery" | "both" {
  return value === "lottery" || value === "both" ? value : "racing";
}

/** A new agency starts with one service. Both is added later by the owner. */
function startingModeOf(value: unknown): "racing" | "lottery" {
  return value === "lottery" ? "lottery" : "racing";
}

/** Keep aligned with removalNameMatches in src/modules/identity/agency-invite.ts. */
function removalNameMatches(typed: string, name: string): boolean {
  const clean = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-AR");
  return clean(typed).length > 0 && clean(typed) === clean(name);
}

function readText(body: object, key: string): string {
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

const photoBuckets = ["day-photos", "deposit-photos", "expense-photos", "cash-photos"];

/** Photos live at {agencyId}/{id}. Lists in pages of 1000 until the folder is empty. */
async function removePhotoFolder(admin: SupabaseClient, bucket: string, agencyId: string): Promise<boolean> {
  for (let round = 0; round < 100; round += 1) {
    const { data, error } = await admin.storage.from(bucket).list(agencyId, { limit: 1000 });
    if (error) {
      return false;
    }
    const paths = (data ?? [])
      .map((file) => file.name)
      .filter((name) => name.length > 0)
      .map((name) => `${agencyId}/${name}`);
    if (paths.length === 0) {
      return true;
    }
    const { error: removeError } = await admin.storage.from(bucket).remove(paths);
    if (removeError) {
      return false;
    }
  }
  return false;
}

/** The agency row and both books. Undoes a half-made agency, and ends a purge. */
async function removeAgency(admin: SupabaseClient, agencyId: string): Promise<boolean> {
  const { error: lotteryError } = await admin.from("lottery_ledgers").delete().eq("agency_id", agencyId);
  if (lotteryError) {
    return false;
  }
  const { error: ledgerError } = await admin.from("ledgers").delete().eq("agency_id", agencyId);
  if (ledgerError) {
    return false;
  }
  const { error: agencyError } = await admin.from("agencies").delete().eq("agency_id", agencyId);
  return !agencyError;
}

/** Who a user is, for the trash list: the name, or else the email. */
async function peopleNames(admin: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (userIds.length === 0) {
    return names;
  }
  const { data } = await admin.from("profiles").select("user_id, display_name, email").in("user_id", userIds);
  for (const row of data ?? []) {
    const name = typeof row.display_name === "string" && row.display_name.trim() ? row.display_name.trim() : row.email;
    if (typeof row.user_id === "string" && typeof name === "string" && name) {
      names.set(row.user_id, name);
    }
  }
  return names;
}

type AgencyInsert = { agencyId: string } | { status: number; message: string; code?: string };

/**
 * A new agency gets the first free id (-2, -3...). A live agency with the same
 * name stops it with code name-taken, so the app can warn; with
 * allowDuplicateName it goes on to the next id. An id held by a removed agency,
 * or by an agency with another name, is skipped the same way.
 */
async function insertAgency(
  admin: SupabaseClient,
  baseId: string,
  name: string,
  productMode: string,
  allowDuplicateName = false,
): Promise<AgencyInsert> {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const agencyId = attempt === 1 ? baseId : `${baseId}-${attempt}`;
    const { error } = await admin.from("agencies").insert({ agency_id: agencyId, name, product_mode: productMode });
    if (!error) {
      return { agencyId };
    }
    if (error.code !== "23505") {
      return { status: 400, message: "No se pudo crear la agencia." };
    }
    const { data: existing } = await admin
      .from("agencies")
      .select("name, archived_at")
      .eq("agency_id", agencyId)
      .maybeSingle();
    // "Lavalle 1442 2" also owns lavalle-1442-2, but it is another name: skip it.
    const sameName = typeof existing?.name === "string" && agencyIdFromName(existing.name) === baseId;
    if (existing?.archived_at == null && sameName && !allowDuplicateName) {
      return { status: 409, message: "Ya hay una agencia con ese nombre.", code: "name-taken" };
    }
  }
  return { status: 400, message: "No se pudo crear la agencia." };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { message: "No se pudo completar." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(500, { message: "No se pudo completar." });
  }

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return json(401, { message: "Tenés que entrar para hacer esto." });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  const callerId = userData.user?.id;
  if (userError || !callerId) {
    return json(401, { message: "Tenés que entrar para hacer esto." });
  }

  // One row per agency the caller is in (multi-agency.sql). The marks count for the
  // person if any row has them. "*" keeps this working before agency-trash.sql.
  const { data: callerRows, error: callerError } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", callerId);

  if (callerError || !callerRows || !callerRows.some((row) => row.can_create_agencies === true)) {
    return json(403, { message: "Esta cuenta no puede crear agencias." });
  }
  const managesTrash = callerRows.some((row) => row.can_manage_trash === true);
  const fullAccess = hasFullAccess(callerRows);
  const memberIds = new Set(
    callerRows.map((row) => row.agency_id).filter((id): id is string => typeof id === "string"),
  );

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { message: "No se pudo completar." });
  }
  if (!body || typeof body !== "object") {
    return json(400, { message: "No se pudo completar." });
  }

  const action = "action" in body ? body.action : null;

  if (action === "read") {
    const agencyId = readText(body, "agencyId");
    if (!agencyId) {
      return json(400, { message: "No se pudo abrir la agencia." });
    }
    const { data: agency, error: agencyError } = await admin
      .from("agencies")
      .select("name, personal_user_id, product_mode, archived_at")
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (agencyError || !agency || typeof agency.name !== "string" || !agency.name.trim()) {
      return json(400, { message: "No se pudo abrir la agencia." });
    }
    // Whoever manages the trash looks at a removed agency, or at someone's test, before deleting it.
    if (agency.archived_at != null && !managesTrash) {
      return json(400, { message: "No se pudo abrir la agencia." });
    }
    if (typeof agency.personal_user_id === "string" && agency.personal_user_id !== callerId && !managesTrash) {
      return json(400, { message: "No se pudo abrir la agencia." });
    }
    const { data: ledger, error: ledgerError } = await admin
      .from("ledgers")
      .select("snapshot")
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (ledgerError || !ledger || ledger.snapshot === null || typeof ledger.snapshot !== "object") {
      return json(400, { message: "No se pudo abrir la agencia." });
    }
    // The lottery book is in its own table. Its policy only lets an agency read its own row,
    // so a visit gets it here, with the service role, like the racing book. No row: null.
    const { data: lottery, error: lotteryError } = await admin
      .from("lottery_ledgers")
      .select("snapshot")
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (lotteryError) {
      return json(400, { message: "No se pudo abrir la agencia." });
    }
    const lotterySnapshot = lottery && lottery.snapshot !== null && typeof lottery.snapshot === "object" ? lottery.snapshot : null;
    return json(200, {
      name: agency.name.trim(),
      productMode: productModeOf(agency.product_mode),
      snapshot: ledger.snapshot,
      lotterySnapshot,
    });
  }

  if (action === "list") {
    const { data, error } = await admin
      .from("agencies")
      .select("agency_id, name, personal_user_id, product_mode")
      .is("archived_at", null)
      .order("created_at");
    if (error || !data) {
      return json(400, { message: "No se pudo cargar la lista." });
    }
    // Someone else's test stays private, except for whoever manages the trash.
    const rows = data.filter((row) => row.personal_user_id == null || row.personal_user_id === callerId || managesTrash);
    const owners = [
      ...new Set(
        rows
          .map((row) => row.personal_user_id)
          .filter((id): id is string => typeof id === "string" && id !== callerId),
      ),
    ];
    const names = await peopleNames(admin, owners);
    const agencies = rows.map((row) => {
      const othersTest = typeof row.personal_user_id === "string" && row.personal_user_id !== callerId;
      return {
        agencyId: row.agency_id,
        name: row.name,
        kind: memberIds.has(row.agency_id) ? "home" : othersTest ? "test" : row.personal_user_id === callerId ? "personal" : "other",
        // member: the caller is in it. full: a real agency the caller opens with full access.
        access: memberIds.has(row.agency_id) ? "member" : fullAccess && row.personal_user_id == null ? "full" : null,
        productMode: productModeOf(row.product_mode),
        testOf: othersTest ? names.get(row.personal_user_id) ?? "" : "",
      };
    });
    return json(200, { agencies });
  }

  if (action === "create-personal") {
    const agencyName = readText(body, "agencyName");
    const problem = personalAgencyNameProblem(agencyName);
    if (problem) {
      return json(400, { message: problem });
    }
    const name = agencyName.trim().replace(/\s+/g, " ");
    const productMode = startingModeOf(readText(body, "productMode"));
    let agencyId = "";
    let created = false;
    for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
      agencyId = personalAgencyId(name);
      const { error: agencyError } = await admin.from("agencies").insert({
        agency_id: agencyId,
        name,
        personal_user_id: callerId,
        product_mode: productMode,
      });
      if (!agencyError) {
        created = true;
        break;
      }
      if (agencyError.code !== "23505") {
        return json(400, { message: "No se pudo crear la agencia." });
      }
    }
    if (!created) {
      return json(400, { message: "No se pudo crear la agencia." });
    }
    const { error: ledgerError } = await admin
      .from("ledgers")
      .insert({ agency_id: agencyId, snapshot: emptyAgencySnapshot(agencyId) });
    if (ledgerError) {
      await removeAgency(admin, agencyId);
      return json(400, { message: "No se pudo crear la agencia." });
    }
    return json(200, { agencyId, name, productMode });
  }

  // Kept under its old name so an older app still works. A test agency now goes
  // to the trash like a real one: it can be restored, or purged from there.
  if (action === "delete-personal") {
    const agencyId = readText(body, "agencyId");
    if (!agencyId || memberIds.has(agencyId)) {
      return json(400, { message: "No se pudo quitar la agencia." });
    }
    const { data: agency, error: agencyError } = await admin
      .from("agencies")
      .select("personal_user_id, archived_at")
      .eq("agency_id", agencyId)
      .maybeSingle();
    const ownTest = agency?.personal_user_id === callerId;
    const othersTest = managesTrash && typeof agency?.personal_user_id === "string";
    if (agencyError || !agency || !(ownTest || othersTest) || agency.archived_at != null) {
      return json(400, { message: "No se pudo quitar la agencia." });
    }
    const { error: archiveError } = await admin
      .from("agencies")
      .update({ archived_at: new Date().toISOString(), archived_by: callerId })
      .eq("agency_id", agencyId)
      .is("archived_at", null);
    if (archiveError) {
      return json(400, { message: "No se pudo quitar la agencia." });
    }
    return json(200, { ok: true });
  }

  if ((action === "list-archived" || action === "restore" || action === "purge") && !managesTrash) {
    return json(403, { message: "Esta cuenta no maneja las agencias quitadas." });
  }

  if (action === "list-archived") {
    const { data, error } = await admin
      .from("agencies")
      .select("agency_id, name, personal_user_id, product_mode, archived_at, archived_by")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false });
    if (error || !data) {
      return json(400, { message: "No se pudo cargar la lista." });
    }
    const people = [
      ...new Set(
        data
          .flatMap((row) => [row.archived_by, row.personal_user_id])
          .filter((id): id is string => typeof id === "string"),
      ),
    ];
    const names = await peopleNames(admin, people);
    const agencies = data.map((row) => ({
      agencyId: row.agency_id,
      name: row.name,
      kind: row.personal_user_id == null ? "agency" : "personal",
      productMode: productModeOf(row.product_mode),
      archivedAt: row.archived_at,
      archivedBy: typeof row.archived_by === "string" ? names.get(row.archived_by) ?? "" : "",
      testOf: typeof row.personal_user_id === "string" ? names.get(row.personal_user_id) ?? "" : "",
    }));
    return json(200, { agencies });
  }

  if (action === "restore") {
    const agencyId = readText(body, "agencyId");
    if (!agencyId) {
      return json(400, { message: "No se pudo restaurar la agencia." });
    }
    const { data: agency, error: agencyError } = await admin
      .from("agencies")
      .select("name, personal_user_id, archived_at")
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (agencyError || !agency || agency.archived_at == null || typeof agency.name !== "string") {
      return json(400, { message: "No se pudo restaurar la agencia." });
    }
    // A real agency's name may have gone to a new agency meanwhile. Two live ones cannot share it.
    if (agency.personal_user_id == null) {
      const baseId = agencyIdFromName(agency.name);
      const { data: live, error: liveError } = await admin
        .from("agencies")
        .select("agency_id, name")
        .is("archived_at", null)
        .is("personal_user_id", null);
      if (liveError) {
        return json(400, { message: "No se pudo restaurar la agencia." });
      }
      const taken = (live ?? []).some(
        (row) => row.agency_id !== agencyId && typeof row.name === "string" && agencyIdFromName(row.name) === baseId,
      );
      if (taken) {
        return json(409, { message: "Ya hay otra agencia activa con ese nombre." });
      }
    }
    const { error: restoreError } = await admin
      .from("agencies")
      .update({ archived_at: null, archived_by: null })
      .eq("agency_id", agencyId)
      .not("archived_at", "is", null);
    if (restoreError) {
      return json(400, { message: "No se pudo restaurar la agencia." });
    }
    return json(200, { ok: true });
  }

  // Each step can run again: the agency row goes last, so after a failure it is
  // still in the trash and pressing the button again finishes the job.
  if (action === "purge") {
    const agencyId = readText(body, "agencyId");
    const confirmName = readText(body, "confirmName");
    if (!agencyId) {
      return json(400, { message: "No se pudo borrar la agencia." });
    }
    if (agencyId === "agencia-dolores" || memberIds.has(agencyId)) {
      return json(400, { message: "Esta agencia no se puede borrar." });
    }
    const { data: agency, error: agencyError } = await admin
      .from("agencies")
      .select("name, archived_at")
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (agencyError || !agency || typeof agency.name !== "string") {
      return json(400, { message: "No se pudo borrar la agencia." });
    }
    if (agency.archived_at == null) {
      return json(400, { message: "Primero hay que quitarla de la lista." });
    }
    if (!removalNameMatches(confirmName, agency.name)) {
      return json(400, { message: "El nombre no coincide." });
    }
    const { data: people, error: peopleError } = await admin
      .from("profiles")
      .select("*")
      .eq("agency_id", agencyId);
    if (peopleError || !people) {
      return json(400, { message: "No se pudo borrar la agencia." });
    }
    // An account that creates agencies, and is in no other agency, would be deleted with it.
    for (const person of people) {
      if (person.can_create_agencies === true || person.can_manage_trash === true) {
        const count = await agencyCount(admin, person.user_id);
        if (count === null || count <= 1) {
          return json(400, { message: "Esta agencia tiene una cuenta que crea agencias. Se borra desde Supabase." });
        }
      }
    }
    for (const bucket of photoBuckets) {
      if (!await removePhotoFolder(admin, bucket, agencyId)) {
        return json(400, { message: "No se pudieron borrar las fotos. La agencia sigue en la lista: volvé a intentar." });
      }
    }
    // Each person leaves this agency. The account goes only if no other agency is left.
    for (const person of people) {
      if (!await removePersonFromAgency(admin, person.user_id, agencyId)) {
        const who = typeof person.email === "string" && person.email ? person.email : "una persona";
        return json(400, { message: `No se pudo borrar la cuenta de ${who}. La agencia sigue en la lista: volvé a intentar.` });
      }
    }
    // The questions stay in the inbox, without the agency. No table yet: nothing to unlink.
    await admin.from("support_questions").update({ agency_id: null }).eq("agency_id", agencyId);
    if (!await removeAgency(admin, agencyId)) {
      return json(400, { message: "No se pudo terminar de borrar la agencia. Sigue en la lista: volvé a intentar." });
    }
    return json(200, { ok: true });
  }

  if (action === "archive") {
    const agencyId = readText(body, "agencyId");
    const confirmName = readText(body, "confirmName");
    if (!agencyId) {
      return json(400, { message: "No se pudo quitar la agencia." });
    }
    const { data: agency, error: agencyError } = await admin
      .from("agencies")
      .select("name, personal_user_id, archived_at")
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (agencyError || !agency || agency.archived_at != null || agency.personal_user_id != null) {
      return json(400, { message: "No se pudo quitar la agencia." });
    }
    if (memberIds.has(agencyId) || agencyId === "agencia-dolores") {
      return json(400, { message: "Esta agencia no se puede quitar." });
    }
    if (typeof agency.name !== "string" || !removalNameMatches(confirmName, agency.name)) {
      return json(400, { message: "El nombre no coincide." });
    }
    const { error: archiveError } = await admin
      .from("agencies")
      .update({ archived_at: new Date().toISOString(), archived_by: callerId })
      .eq("agency_id", agencyId)
      .is("archived_at", null);
    if (archiveError) {
      return json(400, { message: "No se pudo quitar la agencia." });
    }
    return json(200, { ok: true });
  }

  if (action === "create") {
    const agencyName = readText(body, "agencyName");
    const ownerName = readText(body, "ownerName");
    const ownerEmail = readText(body, "ownerEmail");
    const problem = newAgencyProblem(agencyName, ownerName, ownerEmail);
    if (problem) {
      return json(400, { message: problem });
    }

    const name = agencyName.trim().replace(/\s+/g, " ");
    const productMode = startingModeOf(readText(body, "productMode"));
    const baseId = agencyIdFromName(name);
    const cleanOwner = ownerName.trim();
    const cleanEmail = ownerEmail.trim().toLowerCase();

    const allowDuplicateName = (body as Record<string, unknown>).allowDuplicateName === true;
    const confirmExisting = (body as Record<string, unknown>).confirmExisting === true;
    if (!allowDuplicateName) {
      const { data: sameName } = await admin
        .from("agencies")
        .select("agency_id, name")
        .is("archived_at", null)
        .is("personal_user_id", null);
      if ((sameName ?? []).some((row) => typeof row.name === "string" && agencyIdFromName(row.name) === baseId)) {
        return json(409, { message: "Ya hay una agencia con ese nombre.", code: "name-taken" });
      }
    }
    if (!confirmExisting && await accountFor(admin, cleanEmail)) {
      return json(409, { message: "Ese correo ya tiene una cuenta.", code: "existing-account" });
    }
    const created = await insertAgency(admin, baseId, name, productMode, allowDuplicateName);
    if ("message" in created) {
      return json(created.status, created.code ? { message: created.message, code: created.code } : { message: created.message });
    }
    const agencyId = created.agencyId;

    const { error: ledgerError } = await admin
      .from("ledgers")
      .insert({ agency_id: agencyId, snapshot: emptyAgencySnapshot(agencyId) });
    if (ledgerError) {
      await removeAgency(admin, agencyId);
      return json(400, { message: "No se pudo crear la agencia." });
    }

    const redirectTo = allowedRedirect(readText(body, "redirectTo") || null);
    const joined = await addPersonToAgency(admin, {
      email: cleanEmail,
      agencyId,
      role: "owner",
      displayName: cleanOwner,
      canInviteOwners: true,
      redirectTo,
      confirmExisting: true,
    });
    if (joined.kind === "error" || joined.kind === "needs-confirmation" || joined.kind === "already-in") {
      await removeAgency(admin, agencyId);
      return joined.kind === "error"
        ? json(joined.status, { message: joined.message })
        : json(400, { message: "No se pudo crear el dueño." });
    }

    return json(200, {
      ok: true,
      agencyId,
      outcome: joined.kind,
      passwordLinkSent: joined.kind === "existing" && joined.passwordLinkSent,
    });
  }

  return json(400, { message: "No se pudo completar." });
});
