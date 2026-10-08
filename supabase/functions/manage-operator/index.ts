// Invites or removes an operator, and an owner when the caller may invite owners.
// Runs with the service role inside Supabase.
// The app calls it with the owner's session and the anon key only.
// Keep the Spanish messages aligned with src/modules/identity/operator-invite.ts.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const publishedOrigin = "https://hippopro.com.ar";
const legacyOrigin = "https://hippo-pro.vercel.app";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function inviteProblem(displayName: string, email: string): string | null {
  if (!displayName.trim()) {
    return "Escribí el nombre.";
  }
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    return "Escribí el correo.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return "El correo no es válido.";
  }
  return null;
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

function alreadyRegistered(message: string): boolean {
  return /already|registered|exists/i.test(message);
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

  const { data: caller, error: callerError } = await admin
    .from("profiles")
    .select("agency_id, role, can_invite_owners")
    .eq("user_id", callerId)
    .maybeSingle();

  if (callerError || !caller || caller.role !== "owner" || typeof caller.agency_id !== "string") {
    return json(403, { message: "Solo un dueño puede hacer esto." });
  }
  const callerCanInviteOwners = caller.can_invite_owners === true;

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

  if (action === "invite") {
    const displayName = "displayName" in body && typeof body.displayName === "string" ? body.displayName : "";
    const email = "email" in body && typeof body.email === "string" ? body.email : "";
    const problem = inviteProblem(displayName, email);
    if (problem) {
      return json(400, { message: problem });
    }
    const role = "role" in body && body.role === "owner" ? "owner" : "operator";
    if (role === "owner" && !callerCanInviteOwners) {
      return json(403, { message: "Solo un dueño habilitado puede invitar dueños." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();
    const grantInvite = role === "owner" && callerCanInviteOwners && "canInviteOwners" in body && body.canInviteOwners === true;
    const redirectTo = allowedRedirect("redirectTo" in body ? body.redirectTo : null);
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(cleanEmail, {
      redirectTo,
      data: { password_pending: true },
    });

    if (inviteError || !invited.user) {
      const message = inviteError?.message ?? "";
      return json(alreadyRegistered(message) ? 409 : 400, {
        message: alreadyRegistered(message) ? "Ese correo ya tiene una cuenta." : "No se pudo enviar la invitación.",
      });
    }

    const { error: insertError } = await admin.from("profiles").insert({
      user_id: invited.user.id,
      agency_id: caller.agency_id,
      role,
      display_name: cleanName,
      email: cleanEmail,
      can_invite_owners: grantInvite,
    });

    if (insertError) {
      await admin.auth.admin.deleteUser(invited.user.id);
      return json(400, { message: role === "owner" ? "No se pudo crear el dueño." : "No se pudo crear el operador." });
    }

    return json(200, { ok: true });
  }

  if (action === "remove") {
    const userId = "userId" in body && typeof body.userId === "string" ? body.userId : "";
    if (!userId) {
      return json(400, { message: "No se pudo quitar." });
    }
    if (userId === callerId) {
      return json(403, { message: "No te podés quitar." });
    }

    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("agency_id, role, can_invite_owners")
      .eq("user_id", userId)
      .maybeSingle();

    if (targetError || !target || target.agency_id !== caller.agency_id) {
      return json(403, { message: "Esa persona no está en la agencia." });
    }
    if (target.role === "owner") {
      if (!callerCanInviteOwners) {
        return json(403, { message: "No se puede quitar a un dueño." });
      }
      const { data: owners, error: ownersError } = await admin
        .from("profiles")
        .select("user_id, can_invite_owners")
        .eq("agency_id", caller.agency_id)
        .eq("role", "owner");
      if (ownersError || !owners) {
        return json(400, { message: "No se pudo quitar." });
      }
      if (owners.length <= 1) {
        return json(403, { message: "Tiene que quedar un dueño." });
      }
      const flagged = owners.filter((owner) => owner.can_invite_owners === true);
      if (target.can_invite_owners === true && flagged.length <= 1) {
        return json(403, { message: "Tiene que quedar alguien que pueda crear dueños." });
      }
    } else if (target.role !== "operator") {
      return json(403, { message: "No se pudo quitar." });
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return json(400, { message: "No se pudo quitar." });
    }
    return json(200, { ok: true });
  }

  return json(400, { message: "No se pudo completar." });
});
