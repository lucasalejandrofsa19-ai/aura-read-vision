/**
 * Slideshow video recorder: renders book story scenes (chapters) with multiple images
 * (continuous crossfade during narration) + TTS audio to a webm video using Canvas
 * captureStream + Web Audio API + MediaRecorder. Branded outro scene supported.
 */

export interface StoryScene {
  chapterTitle?: string;
  narration: string;
  /** Multiple images shown sequentially during the scene narration. */
  imageDataUrls?: string[];
  /** Backward compatible single-image field. */
  imageDataUrl?: string;
  audioDataUrl: string;
  /** Branded outro card (no AI image) */
  isOutro?: boolean;
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

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  alpha: number,
  scale: number,
  width: number,
  height: number,
) {
  const ir = img.width / img.height;
  const cr = width / height;
  let dw: number, dh: number;
  if (ir > cr) { dh = height * scale; dw = dh * ir; }
  else { dw = width * scale; dh = dw / ir; }
  const dx = (width - dw) / 2;
  const dy = (height - dh) / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function drawSceneFrame(
  ctx: CanvasRenderingContext2D,
  images: (HTMLImageElement | null)[],
  chapterTitle: string | undefined,
  text: string,
  localT: number,
  sceneDur: number,
  width: number,
  height: number,
) {
  // Background
  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, width, height);

  // Continuous slideshow with crossfade across N images
  const valid = images.filter((i): i is HTMLImageElement => !!i);
  if (valid.length > 0) {
    const perImg = sceneDur / valid.length;
    const FADE = Math.min(0.8, perImg * 0.35);
    const idxF = localT / perImg;
    const idx = Math.min(valid.length - 1, Math.floor(idxF));
    const next = Math.min(valid.length - 1, idx + 1);
    const localImgT = localT - idx * perImg;

    // Ken Burns subtle scale per image
    const p = Math.min(1, localImgT / perImg);
    const scaleA = 1.0 + 0.08 * p;
    drawCover(ctx, valid[idx], 1, scaleA, width, height);

    // Crossfade to next near the end of this image's window
    if (next !== idx && localImgT > perImg - FADE) {
      const fadeP = Math.min(1, (localImgT - (perImg - FADE)) / FADE);
      const scaleB = 1.0 + 0.04 * fadeP;
      drawCover(ctx, valid[next], fadeP, scaleB, width, height);
    }
  }

  // Dark gradient overlay at bottom for legibility
  const grad = ctx.createLinearGradient(0, height * 0.5, 0, height);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.88)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, height * 0.5, width, height * 0.5);

  // Chapter title (top)
  if (chapterTitle) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, width, 80);
    ctx.fillStyle = "#ffd166";
    ctx.font = "700 28px Inter, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(chapterTitle.toUpperCase(), 40, 40);
    ctx.restore();
  }

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

function drawOutroFrame(
  ctx: CanvasRenderingContext2D,
  localT: number,
  sceneDur: number,
  width: number,
  height: number,
) {
  // Animated gradient background
  const t = localT / Math.max(0.1, sceneDur);
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, `hsl(${260 + t * 30}, 70%, 18%)`);
  grad.addColorStop(1, `hsl(${200 + t * 40}, 80%, 12%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Decorative orbs
  for (let i = 0; i < 5; i++) {
    const cx = (width / 5) * i + (width / 10) + Math.sin(t * Math.PI * 2 + i) * 30;
    const cy = height / 2 + Math.cos(t * Math.PI * 2 + i) * 40;
    const r = 120 + i * 20;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `hsla(${280 + i * 20}, 90%, 60%, 0.25)`);
    g.addColorStop(1, "hsla(0,0%,0%,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Logo / brand
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  ctx.font = "800 96px Inter, system-ui, sans-serif";
  const grad2 = ctx.createLinearGradient(0, height / 2 - 60, 0, height / 2 + 20);
  grad2.addColorStop(0, "#fef3c7");
  grad2.addColorStop(1, "#f59e0b");
  ctx.fillStyle = grad2;
  ctx.fillText("AURA READ", width / 2, height / 2 - 60);

  ctx.font = "500 32px Inter, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText("Transforme livros em experiências com IA", width / 2, height / 2 + 20);

  // CTA pill
  const ctaText = "auraread.store";
  ctx.font = "700 36px Inter, system-ui, sans-serif";
  const tw = ctx.measureText(ctaText).width;
  const pw = tw + 80;
  const ph = 70;
  const px = (width - pw) / 2;
  const py = height / 2 + 80;
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  // rounded rect
  const r = 35;
  ctx.moveTo(px + r, py);
  ctx.arcTo(px + pw, py, px + pw, py + ph, r);
  ctx.arcTo(px + pw, py + ph, px, py + ph, r);
  ctx.arcTo(px, py + ph, px, py, r);
  ctx.arcTo(px, py, px + pw, py, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1a0f00";
  ctx.fillText(ctaText, width / 2, py + ph / 2 + 2);

  ctx.textAlign = "start";
}

export async function recordStoryVideo(
  scenes: StoryScene[],
  opts: { onProgress?: (p: number, label?: string) => void; title?: string } = {},
): Promise<Blob> {
  const { onProgress } = opts;
  const width = 1280;
  const height = 720;

  onProgress?.(0.05, "Carregando imagens…");
  // Per-scene: array of images
  const sceneImages: (HTMLImageElement | null)[][] = await Promise.all(
    scenes.map(async s => {
      const urls = (s.imageDataUrls && s.imageDataUrls.length > 0)
        ? s.imageDataUrls
        : (s.imageDataUrl ? [s.imageDataUrl] : []);
      return Promise.all(urls.map(u => loadImage(u).catch(() => null)));
    }),
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
  // Prime first frame
  if (scenes[0]?.isOutro) drawOutroFrame(ctx, 0, 1, width, height);
  else drawSceneFrame(ctx, sceneImages[0] || [], scenes[0]?.chapterTitle, scenes[0]?.narration ?? "", 0, 1, width, height);

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

  // Compute scene timings (with gap between). Fallback duration when audio missing.
  const GAP = 0.5;
  const durations = audioBuffers.map((b, i) => {
    if (b) return b.duration;
    // Estimate by narration length (~14 chars/sec) when TTS unavailable
    const words = (scenes[i]?.narration || "").length;
    return Math.max(4, Math.min(12, words / 14));
  });
  const starts: number[] = [];
  let acc = 0.2;
  for (let i = 0; i < scenes.length; i++) {
    starts.push(acc);
    acc += durations[i] + GAP;
  }
  const total = acc + 0.8;

  // start with timeslice so webm carries proper cluster timestamps -> playable in all players
  recorder.start(1000);


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
      const sc = scenes[idx];
      if (sc.isOutro) {
        drawOutroFrame(ctx, localT, sceneDur, width, height);
      } else {
        drawSceneFrame(ctx, sceneImages[idx] || [], sc.chapterTitle, sc.narration, localT, sceneDur, width, height);
      }
      onProgress?.(0.15 + 0.8 * Math.min(1, t / total), "Gravando vídeo…");
      requestAnimationFrame(frame);
    }
    frame();
  });

  try { recorder.requestData(); } catch {}
  recorder.stop();
  const blob = await finished;
  try { audioCtx.close(); } catch {}
  onProgress?.(1, "Pronto!");
  return blob;
}
