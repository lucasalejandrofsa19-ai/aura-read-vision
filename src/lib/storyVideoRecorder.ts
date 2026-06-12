/**
 * Vertical 9:16 (Instagram Reels) slideshow recorder.
 * Each scene contains N segments (sentence + image). Image and caption
 * appear synchronized with the narration for that segment.
 */

export interface StorySegment {
  text: string;
  imageDataUrl: string;
}

export interface StoryScene {
  chapterTitle?: string;
  narration: string;
  segments: StorySegment[];
  audioDataUrl: string;
  isOutro?: boolean;
  // legacy fields (ignored)
  imageDataUrls?: string[];
  imageDataUrl?: string;
}

export interface RecordOptions {
  onProgress?: (p: number, label?: string) => void;
  title?: string;
  fontFamily?: string; // CSS font family for captions
  targetDurationSeconds?: number;
  captions?: boolean; // burn-in subtitles (default true)
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

// Cover-fit (no distortion). Uses object-cover semantics for the canvas size.
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

interface PreparedSegment {
  img: HTMLImageElement | null;
  text: string;
  start: number; // seconds within scene
  end: number;
}

function drawSceneFrame(
  ctx: CanvasRenderingContext2D,
  prepared: PreparedSegment[],
  chapterTitle: string | undefined,
  localT: number,
  width: number,
  height: number,
  fontFamily: string,
  showCaptions: boolean = true,
) {
  // Background
  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, width, height);

  // Determine active segment
  let activeIdx = 0;
  for (let i = prepared.length - 1; i >= 0; i--) {
    if (localT >= prepared[i].start) { activeIdx = i; break; }
  }
  const seg = prepared[activeIdx];
  const segDur = Math.max(0.01, seg.end - seg.start);
  const segLocalT = Math.max(0, localT - seg.start);
  const segP = Math.min(1, segLocalT / segDur);

  // Ken Burns
  const scaleA = 1.0 + 0.06 * segP;
  if (seg.img) drawCover(ctx, seg.img, 1, scaleA, width, height);

  // Crossfade to next image near the end of the segment
  const FADE = Math.min(0.6, segDur * 0.25);
  if (segLocalT > segDur - FADE && activeIdx + 1 < prepared.length) {
    const nxt = prepared[activeIdx + 1];
    const fadeP = Math.min(1, (segLocalT - (segDur - FADE)) / FADE);
    if (nxt.img) drawCover(ctx, nxt.img, fadeP, 1.0 + 0.04 * fadeP, width, height);
  }

  // Top dark gradient
  const topGrad = ctx.createLinearGradient(0, 0, 0, height * 0.18);
  topGrad.addColorStop(0, "rgba(0,0,0,0.7)");
  topGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, height * 0.18);

  // Bottom dark gradient (legibility for caption)
  if (showCaptions) {
    const grad = ctx.createLinearGradient(0, height * 0.55, 0, height);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.92)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, height * 0.55, width, height * 0.45);
  }

  // Chapter title (top)
  if (chapterTitle) {
    ctx.save();
    ctx.fillStyle = "#ffd166";
    ctx.font = `700 36px ${fontFamily}, Inter, system-ui, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(chapterTitle.toUpperCase(), 50, 50);
    ctx.restore();
  }

  if (showCaptions) {
    // Dynamic caption (subtitle) — only the active segment text, with pop-in animation
    const popIn = Math.min(1, segLocalT / 0.25); // 250ms pop-in
    const captionAlpha = popIn;
    const captionScale = 0.92 + 0.08 * popIn;

    ctx.save();
    ctx.globalAlpha = captionAlpha;
    const fontSize = 52;
    ctx.font = `800 ${fontSize}px ${fontFamily}, Inter, system-ui, sans-serif`;
    ctx.textBaseline = "bottom";
    ctx.textAlign = "center";
    const maxW = width - 120;
    const lines = wrapText(ctx, seg.text, maxW);
    const lineH = fontSize * 1.18;

    const cx = width / 2;
    const baseY = height - 120;

    ctx.translate(cx, baseY);
    ctx.scale(captionScale, captionScale);

    for (let i = lines.length - 1; i >= 0; i--) {
      const y = -((lines.length - 1 - i) * lineH);
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(lines[i], 0, y);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(lines[i], 0, y);
    }
    ctx.restore();
  }

  // Progress bar (segment progression) at top
  const total = prepared[prepared.length - 1].end;
  const pTotal = Math.min(1, localT / total);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(0, 0, width, 6);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(0, 0, width * pTotal, 6);
}

// Cartão separador de capítulo: tela cheia com número e título do capítulo.
function drawChapterIntro(
  ctx: CanvasRenderingContext2D,
  chapterIndex: number,
  chapterTitle: string,
  localT: number,
  duration: number,
  width: number,
  height: number,
  fontFamily: string,
) {
  const p = Math.min(1, localT / duration);
  // Fundo gradiente animado
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, `hsl(${220 + chapterIndex * 25}, 65%, 12%)`);
  grad.addColorStop(1, `hsl(${260 + chapterIndex * 20}, 70%, 8%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Linha decorativa
  const lineW = width * 0.4 * p;
  ctx.fillStyle = "#ffd166";
  ctx.fillRect((width - lineW) / 2, height / 2 - 140, lineW, 4);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // "CAPÍTULO N"
  ctx.globalAlpha = Math.min(1, p * 2);
  ctx.fillStyle = "#ffd166";
  ctx.font = `700 38px ${fontFamily}, Inter, system-ui, sans-serif`;
  ctx.fillText(`CAPÍTULO ${chapterIndex + 1}`, width / 2, height / 2 - 60);

  // Título
  ctx.globalAlpha = Math.min(1, Math.max(0, (p - 0.2) * 1.6));
  ctx.fillStyle = "#ffffff";
  const titleSize = 64;
  ctx.font = `800 ${titleSize}px ${fontFamily}, Inter, system-ui, sans-serif`;
  const lines = wrapText(ctx, chapterTitle.toUpperCase(), width - 120);
  let y = height / 2 + 30;
  for (const ln of lines) {
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.strokeText(ln, width / 2, y);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(ln, width / 2, y);
    y += titleSize * 1.15;
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}



function drawOutroFrame(
  ctx: CanvasRenderingContext2D,
  prepared: PreparedSegment[],
  localT: number,
  width: number,
  height: number,
  fontFamily: string,
) {
  // Animated gradient background
  const total = prepared[prepared.length - 1].end;
  const t = Math.min(1, localT / Math.max(0.1, total));
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, `hsl(${260 + t * 30}, 70%, 18%)`);
  grad.addColorStop(1, `hsl(${200 + t * 40}, 80%, 12%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Orbs
  for (let i = 0; i < 6; i++) {
    const cx = (width / 5) * i + (width / 10) + Math.sin(t * Math.PI * 2 + i) * 40;
    const cy = height / 2 + Math.cos(t * Math.PI * 2 + i) * 60;
    const r = 180 + i * 30;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `hsla(${280 + i * 20}, 90%, 60%, 0.25)`);
    g.addColorStop(1, "hsla(0,0%,0%,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  // Brand
  ctx.font = `800 130px ${fontFamily}, Inter, system-ui, sans-serif`;
  const grad2 = ctx.createLinearGradient(0, height / 2 - 200, 0, height / 2 - 80);
  grad2.addColorStop(0, "#fef3c7");
  grad2.addColorStop(1, "#f59e0b");
  ctx.fillStyle = grad2;
  ctx.fillText("AURA READ", width / 2, height / 2 - 140);

  ctx.font = `500 42px ${fontFamily}, Inter, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText("Livros + IA", width / 2, height / 2 - 50);

  // Dynamic caption (active segment text)
  let activeIdx = 0;
  for (let i = prepared.length - 1; i >= 0; i--) {
    if (localT >= prepared[i].start) { activeIdx = i; break; }
  }
  const seg = prepared[activeIdx];
  ctx.font = `700 46px ${fontFamily}, Inter, system-ui, sans-serif`;
  ctx.fillStyle = "#ffffff";
  const maxW = width - 140;
  const lines = wrapText(ctx, seg.text, maxW);
  const lineH = 60;
  let y = height / 2 + 80;
  for (const ln of lines) {
    ctx.lineWidth = 8; ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.strokeText(ln, width / 2, y);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(ln, width / 2, y);
    y += lineH;
  }

  // CTA pill
  const ctaText = "auraread.store";
  ctx.font = `700 48px ${fontFamily}, Inter, system-ui, sans-serif`;
  const tw = ctx.measureText(ctaText).width;
  const pw = tw + 100;
  const ph = 90;
  const px = (width - pw) / 2;
  const py = height - 240;
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  const r = 45;
  ctx.moveTo(px + r, py);
  ctx.arcTo(px + pw, py, px + pw, py + ph, r);
  ctx.arcTo(px + pw, py + ph, px, py + ph, r);
  ctx.arcTo(px, py + ph, px, py, r);
  ctx.arcTo(px, py, px + pw, py, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1a0f00";
  ctx.fillText(ctaText, width / 2, py + ph / 2 + 4);

  ctx.textAlign = "start";
}

export async function recordStoryVideo(
  scenes: StoryScene[],
  opts: RecordOptions = {},
): Promise<Blob> {
  const { onProgress, fontFamily = "Inter", targetDurationSeconds = 90 } = opts;
  // 9:16 vertical. 720p keeps browser recording/export stable on phones.
  const width = 720;
  const height = 1280;

  onProgress?.(0.05, "Carregando imagens…");
  // Ensure scenes have segments (legacy fallback)
  const normScenes: StoryScene[] = scenes.map(s => {
    if (s.segments && s.segments.length > 0) return s;
    const urls = (s.imageDataUrls && s.imageDataUrls.length > 0)
      ? s.imageDataUrls
      : (s.imageDataUrl ? [s.imageDataUrl] : []);
    const sentences = (s.narration || "").split(/(?<=[.!?])\s+/).filter(Boolean);
    const n = Math.max(urls.length || sentences.length, 1);
    const segs: StorySegment[] = [];
    for (let i = 0; i < n; i++) {
      segs.push({ text: sentences[i] || s.narration || "", imageDataUrl: urls[i] || urls[urls.length - 1] || "" });
    }
    return { ...s, segments: segs };
  });

  const sceneImages: (HTMLImageElement | null)[][] = await Promise.all(
    normScenes.map(s => Promise.all(s.segments.map(seg => seg.imageDataUrl ? loadImage(seg.imageDataUrl).catch(() => null) : Promise.resolve(null)))),
  );

  onProgress?.(0.15, "Preparando áudio…");
  const AudioCtor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
  const audioCtx = new AudioCtor();
  const audioBuffers = await Promise.all(normScenes.map(async s => {
    if (!s.audioDataUrl) return null;
    const res = await fetch(s.audioDataUrl);
    const buf = await res.arrayBuffer();
    try { return await audioCtx.decodeAudioData(buf); } catch { return null; }
  }));

  // Pre-warm font (ensure caption font is loaded before rendering)
  try {
    if ((document as any).fonts?.load) {
      await (document as any).fonts.load(`800 52px ${fontFamily}`);
      await (document as any).fonts.load(`700 48px ${fontFamily}`);
    }
  } catch {}

  const INTRO = 1.5;
  const GAP = 0.25;
  const naturalDurations = normScenes.map((s, i) => audioBuffers[i]?.duration
    ?? Math.max(5, Math.min(16, s.narration.length / 15)));
  const introTotal = normScenes.reduce((sum, s) => sum + (s.isOutro ? 0 : INTRO), 0);
  const gapTotal = Math.max(0, normScenes.length - 1) * GAP;
  const availableNarration = Math.max(20, targetDurationSeconds - introTotal - gapTotal - 1);
  const naturalTotal = naturalDurations.reduce((a, b) => a + b, 0) || availableNarration;
  const timelineScale = availableNarration / naturalTotal;

  // Build per-scene prepared segments with timings (distribute adjusted audio duration
  // proportionally to segment text length so longer sentences hold longer).
  const scenePrepared: PreparedSegment[][] = [];
  const sceneDurations: number[] = [];
  const playbackRates: number[] = [];
  for (let i = 0; i < normScenes.length; i++) {
    const segs = normScenes[i].segments;
    const naturalDur = naturalDurations[i];
    const audioDur = Math.max(1.8, naturalDur * timelineScale);
    playbackRates.push(naturalDur / audioDur);
    const totals = segs.reduce((a, s) => a + Math.max(8, s.text.length), 0);
    let acc = 0;
    const prep: PreparedSegment[] = segs.map((s, k) => {
      const w = Math.max(8, s.text.length) / totals;
      const dur = Math.max(1.2, audioDur * w);
      const start = acc;
      const end = (k === segs.length - 1) ? audioDur : acc + dur;
      acc = end;
      return { img: sceneImages[i][k], text: s.text, start, end };
    });
    scenePrepared.push(prep);
    sceneDurations.push(audioDur);
  }

  // Canvas setup
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  // Prime
  if (normScenes[0]?.isOutro) drawOutroFrame(ctx, scenePrepared[0], 0, width, height, fontFamily);
  else drawSceneFrame(ctx, scenePrepared[0], normScenes[0]?.chapterTitle, 0, width, height, fontFamily);

  const dest = audioCtx.createMediaStreamDestination();
  const videoStream = canvas.captureStream(24);
  const combined = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const mimeCandidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm",
  ];
  const mime = mimeCandidates.find(m => MediaRecorder.isTypeSupported(m)) || "";
  const recorder = new MediaRecorder(combined, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 2_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const finished = new Promise<Blob>(resolve => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime || "video/webm" }));
  });

  // Scene start offsets — cada capítulo ganha um cartão intro curto para caber em ~1min30 total
  const starts: number[] = []; // início da NARRAÇÃO de cada cena (após intro)
  const introStarts: number[] = []; // início do cartão intro
  let acc = 0.2;
  for (let i = 0; i < normScenes.length; i++) {
    const hasIntro = !normScenes[i].isOutro;
    introStarts.push(acc);
    if (hasIntro) acc += INTRO;
    starts.push(acc);
    acc += sceneDurations[i] + GAP;
  }
  const total = acc + 0.8;

  recorder.start(1000);

  // Schedule audio (após o intro de cada cena)
  const baseAudioT = audioCtx.currentTime + 0.2;
  for (let i = 0; i < normScenes.length; i++) {
    if (!audioBuffers[i]) continue;
    const src = audioCtx.createBufferSource();
    src.buffer = audioBuffers[i]!;
    src.playbackRate.value = playbackRates[i] || 1;
    src.connect(dest);
    src.start(baseAudioT + starts[i] - 0.2);
  }

  const startReal = performance.now();
  await new Promise<void>(resolve => {
    function frame() {
      const t = (performance.now() - startReal) / 1000;
      if (t >= total) { resolve(); return; }
      let idx = 0;
      for (let i = normScenes.length - 1; i >= 0; i--) {
        if (t >= introStarts[i]) { idx = i; break; }
      }
      const sc = normScenes[idx];
      // Está no cartão de intro?
      if (!sc.isOutro && t < starts[idx]) {
        const localIntro = t - introStarts[idx];
        drawChapterIntro(ctx, idx, sc.chapterTitle || `Capítulo ${idx + 1}`, localIntro, INTRO, width, height, fontFamily);
      } else {
        const localT = Math.max(0, t - starts[idx]);
        if (sc.isOutro) {
          drawOutroFrame(ctx, scenePrepared[idx], localT, width, height, fontFamily);
        } else {
          drawSceneFrame(ctx, scenePrepared[idx], sc.chapterTitle, localT, width, height, fontFamily);
        }
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
