import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "day-photos";
const MAX_BYTES = 5 * 1024 * 1024;

export type DayPhotoFile = {
  name: string;
  bytes: ArrayBuffer;
  contentType: string;
};

export function dayPhotoContentType(contentType: string, name: string): string {
  if (contentType === "image/jpg") {
    return "image/jpeg";
  }
  if (contentType === "image/jpeg" || contentType === "image/png" || contentType === "image/webp") {
    return contentType;
  }
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  return "";
}

/** Spanish message when the file cannot be kept. Null when it can. */
export function dayPhotoProblem(file: { size: number; contentType: string; name: string }): string | null {
  const contentType = dayPhotoContentType(file.contentType, file.name);
  if (!contentType) {
    return "La imagen tiene que ser jpeg, png o webp.";
  }
  if (file.size > MAX_BYTES) {
    return "La imagen no puede pasar de 5 MB.";
  }
  if (file.size <= 0) {
    return "La imagen está vacía.";
  }
  return null;
}

function photoPath(agencyId: string, dayId: string): string {
  return `${agencyId}/${dayId}`;
}

export async function listDayPhotoIds(client: SupabaseClient, agencyId: string): Promise<Set<string>> {
  const { data, error } = await client.storage.from(BUCKET).list(agencyId, { limit: 1000 });
  if (error || !data) {
    return new Set();
  }
  return new Set(data.filter((entry) => entry.id && entry.name).map((entry) => entry.name));
}

export async function uploadDayPhoto(
  client: SupabaseClient,
  agencyId: string,
  dayId: string,
  file: DayPhotoFile,
): Promise<void> {
  const contentType = dayPhotoContentType(file.contentType, file.name);
  const { error } = await client.storage.from(BUCKET).upload(photoPath(agencyId, dayId), file.bytes, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw error;
  }
}

export async function deleteDayPhoto(client: SupabaseClient, agencyId: string, dayId: string): Promise<void> {
  const { error } = await client.storage.from(BUCKET).remove([photoPath(agencyId, dayId)]);
  if (error) {
    throw error;
  }
}

export async function dayPhotoUrl(client: SupabaseClient, agencyId: string, dayId: string): Promise<string | null> {
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(photoPath(agencyId, dayId), 60 * 10);
  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
}
