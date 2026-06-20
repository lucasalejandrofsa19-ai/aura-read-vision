// Helper to pick the best supported MediaRecorder mimeType for the
// "Baixar vídeo" button. Chrome supports MP4 (avc1/aac); Firefox does not,
// so we fall back to WebM (vp9/opus). If neither is supported, return null
// so the caller can surface a friendly error.

export const MP4_MIME = "video/mp4;codecs=avc1.42E01E,mp4a.40.2";
export const WEBM_MIME = "video/webm;codecs=vp9,opus";

export type VideoMimeChoice = {
  mimeType: string;
  ext: "mp4" | "webm";
} | null;

type MediaRecorderLike = { isTypeSupported: (t: string) => boolean };

export function pickVideoMimeType(
  recorder: MediaRecorderLike | undefined = typeof MediaRecorder !== "undefined"
    ? (MediaRecorder as unknown as MediaRecorderLike)
    : undefined,
): VideoMimeChoice {
  if (!recorder || typeof recorder.isTypeSupported !== "function") return null;
  if (recorder.isTypeSupported(MP4_MIME)) return { mimeType: MP4_MIME, ext: "mp4" };
  if (recorder.isTypeSupported(WEBM_MIME)) return { mimeType: WEBM_MIME, ext: "webm" };
  return null;
}
