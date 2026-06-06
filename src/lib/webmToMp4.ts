/**
 * Lazy-loaded WebM → MP4 converter using ffmpeg.wasm (single-thread, browser only).
 * The core wasm is fetched from unpkg on first use (~25MB) and cached by the browser.
 */
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ff = new FFmpeg();
    if (onLog) ff.on("log", ({ message }) => onLog(message));
    const base = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ff.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ff;
    return ff;
  })();

  return loadingPromise;
}

export async function convertWebmToMp4(
  webmBlob: Blob,
  onProgress?: (p: number, label?: string) => void,
): Promise<Blob> {
  onProgress?.(0.02, "Carregando conversor MP4…");
  const ff = await getFFmpeg();

  ff.on("progress", ({ progress }) => {
    if (Number.isFinite(progress)) onProgress?.(0.1 + 0.85 * Math.min(1, Math.max(0, progress)), "Convertendo para MP4…");
  });

  const inputName = "in.webm";
  const outputName = "out.mp4";
  onProgress?.(0.08, "Preparando vídeo…");
  await ff.writeFile(inputName, await fetchFile(webmBlob));

  await ff.exec([
    "-i", inputName,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "160k",
    "-movflags", "+faststart",
    outputName,
  ]);

  const data = await ff.readFile(outputName);
  onProgress?.(1, "MP4 pronto");
  const bytes = data as Uint8Array;
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([ab], { type: "video/mp4" });
}
