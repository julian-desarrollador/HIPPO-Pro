import type { SupabaseClient } from "@supabase/supabase-js";

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

type AgencyPhotos = {
  list: (client: SupabaseClient, agencyId: string) => Promise<Set<string>>;
  upload: (client: SupabaseClient, agencyId: string, id: string, file: DayPhotoFile) => Promise<void>;
  remove: (client: SupabaseClient, agencyId: string, id: string) => Promise<void>;
  url: (client: SupabaseClient, agencyId: string, id: string) => Promise<string | null>;
};

function agencyPhotos(bucket: string): AgencyPhotos {
  const path = (agencyId: string, id: string) => `${agencyId}/${id}`;
  return {
    async list(client, agencyId) {
      const { data, error } = await client.storage.from(bucket).list(agencyId, { limit: 1000 });
      if (error || !data) {
        return new Set();
      }
      return new Set(data.filter((entry) => entry.id && entry.name).map((entry) => entry.name));
    },
    async upload(client, agencyId, id, file) {
      const contentType = dayPhotoContentType(file.contentType, file.name);
      const { error } = await client.storage.from(bucket).upload(path(agencyId, id), file.bytes, {
        contentType,
        upsert: true,
      });
      if (error) {
        throw error;
      }
    },
    async remove(client, agencyId, id) {
      const { error } = await client.storage.from(bucket).remove([path(agencyId, id)]);
      if (error) {
        throw error;
      }
    },
    async url(client, agencyId, id) {
      const { data, error } = await client.storage.from(bucket).createSignedUrl(path(agencyId, id), 60 * 10);
      if (error || !data?.signedUrl) {
        return null;
      }
      return data.signedUrl;
    },
  };
}

const dayPhotos = agencyPhotos("day-photos");
const depositPhotos = agencyPhotos("deposit-photos");

export const listDayPhotoIds = dayPhotos.list;
export const uploadDayPhoto = dayPhotos.upload;
export const deleteDayPhoto = dayPhotos.remove;
export const dayPhotoUrl = dayPhotos.url;

export const listDepositPhotoIds = depositPhotos.list;
export const uploadDepositPhoto = depositPhotos.upload;
export const deleteDepositPhoto = depositPhotos.remove;
export const depositPhotoUrl = depositPhotos.url;
