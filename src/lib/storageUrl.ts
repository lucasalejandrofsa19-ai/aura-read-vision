import { supabase } from "@/integrations/supabase/client";

/**
 * Convert a stored value (full public URL or bare path) into a signed URL
 * for a now-private bucket. Returns the original value if signing fails.
 */
export async function getSignedStorageUrl(
  bucket: string,
  stored: string | null | undefined,
  expiresIn = 60 * 60
): Promise<string> {
  if (!stored) return "";

  let path = stored;
  // If it's a full URL (legacy public URL), extract the path after /<bucket>/
  const marker = `/${bucket}/`;
  const idx = stored.indexOf(marker);
  if (idx !== -1) {
    path = stored.substring(idx + marker.length).split("?")[0];
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    console.warn(`[storageUrl] Failed to sign ${bucket}/${path}:`, error);
    return stored;
  }
  return data.signedUrl;
}
