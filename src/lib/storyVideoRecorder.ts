/**
 * Slideshow video recorder: renders book story scenes (image + TTS audio) to a webm video
 * using Canvas captureStream + Web Audio API + MediaRecorder. Runs entirely in the browser.
 */

export interface StoryScene {
  narration: string;
  imageDataUrl: string;
  audioDataUrl: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? current + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  text: string,
  localT: number,
  sceneDur: number,
  width: number,
  height: number,
) {
  // Background
  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, width, height);

  if (img) {
    // Ken Burns: subtle scale 1.0 -> 1.08
    const p = Math.min(1, localT / Math.max(0.1, sceneDur));
    const scale = 1.0 + 0.08 * p;
    const ir = img.width / img.height;
    const cr = width / height;
    let dw, dh;
    if (ir > cr) { dh = height * scale; dw = dh * ir; }
    else { dw = width * scale; dh = dw / ir; }
    const dx = (width - dw) / 2;
    const dy = (height - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  // Dark gradient overlay at bottom for legibility
  const grad = ctx.createLinearGradient(0, height * 0.55, 0, height);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, height * 0.55, width, height * 0.45);

  // Subtitle text
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 30px Inter, system-ui, sans-serif";
  ctx.textBaseline = "bottom";
  const maxW = width - 120;
  const lines = wrapText(ctx, text, maxW);
  const lineH = 40;
  let y = height - 60;
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = ctx.measureText(lines[i]);
    ctx.fillText(lines[i], (width - m.width) / 2, y);
    y -= lineH;
  }
}

export async function recordStoryVideo(
  scenes: StoryScene[],
  opts: { onProgress?: (p: number, label?: string) => void; title?: string } = {},
): Promise<Blob> {
  const { onProgress } = opts;
  const width = 1280;
  const height = 720;

  onProgress?.(0.05, "Carregando imagens…");
  const images = await Promise.all(
    scenes.map(s => s.imageDataUrl ? loadImage(s.imageDataUrl).catch(() => null) : Promise.resolve(null)),
  );

  onProgress?.(0.15, "Preparando áudio…");
  const AudioCtor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
  const audioCtx = new AudioCtor();
  const audioBuffers = await Promise.all(scenes.map(async s => {
    if (!s.audioDataUrl) return null;
    const res = await fetch(s.audioDataUrl);
    const buf = await res.arrayBuffer();
    try { return await audioCtx.decodeAudioData(buf); } catch { return null; }
  }));

  // Build canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  drawScene(ctx, images[0], scenes[0]?.narration ?? "", 0, 1, width, height);

  const dest = audioCtx.createMediaStreamDestination();
  const videoStream = canvas.captureStream(30);
  const combined = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : "video/webm";
  const recorder = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 3_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const finished = new Promise<Blob>(resolve => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  // Compute scene timings (with gap between)
  const GAP = 0.4;
  const durations = audioBuffers.map(b => (b ? b.duration : 3));
  const starts: number[] = [];
  let acc = 0.2;
  for (let i = 0; i < scenes.length; i++) {
    starts.push(acc);
    acc += durations[i] + GAP;
  }
  const total = acc + 0.5;

  recorder.start();

  // Schedule audio
  const baseAudioT = audioCtx.currentTime + 0.2;
  for (let i = 0; i < scenes.length; i++) {
    if (!audioBuffers[i]) continue;
    const src = audioCtx.createBufferSource();
    src.buffer = audioBuffers[i]!;
    src.connect(dest);
    src.start(baseAudioT + starts[i] - 0.2);
  }

  const startReal = performance.now();
  await new Promise<void>(resolve => {
    function frame() {
      const t = (performance.now() - startReal) / 1000;
      if (t >= total) { resolve(); return; }
      let idx = 0;
      for (let i = scenes.length - 1; i >= 0; i--) {
        if (t >= starts[i]) { idx = i; break; }
      }
      const localT = Math.max(0, t - starts[idx]);
      const sceneDur = durations[idx] + GAP;
      drawScene(ctx, images[idx], scenes[idx].narration, localT, sceneDur, width, height);
      onProgress?.(0.15 + 0.8 * Math.min(1, t / total), "Gravando vídeo…");
      requestAnimationFrame(frame);
    }
    frame();
  });

  recorder.stop();
  const blob = await finished;
  try { audioCtx.close(); } catch {}
  onProgress?.(1, "Pronto!");
  return blob;
}
