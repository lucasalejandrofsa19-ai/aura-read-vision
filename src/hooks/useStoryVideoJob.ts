import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Scene = {
  chapterTitle: string;
  narration: string;
  audioDataUrl: string;
  segments: { text: string; imageDataUrl: string }[];
};

export type StoryVideoResult = {
  title: string;
  author?: string;
  scenes: Scene[];
  targetDurationSeconds?: number;
};

export type JobStatus = "idle" | "pending" | "processing" | "completed" | "failed";

export type JobProgress = {
  current: number;
  total: number;
  stage: "starting" | "image" | "narration" | "scene_done" | "finalizing" | "completed" | string;
  sceneTitle: string | null;
  etaSeconds: number;
};

export type NarrationTone = "neutro" | "alegre" | "serio" | "empolgado" | "dramatico" | "calmo";

export type DraftScene = {
  chapterTitle: string;
  narration: string;
  imagePrompt?: string;
  highlightId?: string;
};

export type StartParams = {
  book_id: string;
  mode?: "summary" | "chapter" | "custom" | "highlights";
  text?: string;
  voice?: string;
  tone?: NarrationTone;
  scenesCount?: number;
  variationSeed?: string | number;
  scenesOverride?: DraftScene[];
};

const POLL_INTERVAL_MS = 2500;
const VIDEO_TIMEOUT_MS = 10 * 60 * 1000;

type JobRow = {
  status: string;
  error: string | null;
  result: unknown;
  attempts: number | null;
  progress: unknown;
  created_at: string;
  updated_at: string;
};

export function useStoryVideoJob() {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StoryVideoResult | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const markTimedOut = useCallback((message = "A geração excedeu o tempo limite. Cancele ou tente novamente.") => {
    setTimedOut(true);
    setStatus("failed");
    setError(message);
    stopPolling();
  }, [stopPolling]);

  const fetchJob = useCallback(async (id: string) => {
    const { data, error: e } = await supabase
      .from("story_video_jobs")
      .select("status, error, result, attempts, progress, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();
    if (e) {
      setError(e.message);
      return;
    }
    if (!data) return;
    const job = data as JobRow;
    const ageMs = Date.now() - new Date(job.created_at).getTime();
    setCreatedAt(job.created_at);
    setUpdatedAt(job.updated_at);
    if ((job.status === "pending" || job.status === "processing") && ageMs > VIDEO_TIMEOUT_MS) {
      markTimedOut();
      return;
    }
    setStatus(job.status as JobStatus);
    setAttempts(job.attempts ?? 0);
    const p = job.progress as JobProgress | null;
    if (p && typeof p.total === "number" && p.total > 0) setProgress(p);
    if (job.status === "completed") {
      if (job.result) {
        setResult(job.result as StoryVideoResult);
        queryClient.invalidateQueries({ queryKey: ["story-video-quota"] });
      } else {
        setError("Vídeo concluído sem dados de resultado. Tente novamente.");
      }
      stopPolling();
    } else if (job.status === "failed") {
      setError(job.error || "Falha na geração");
      stopPolling();
    }
  }, [markTimedOut, stopPolling, queryClient]);

  const startPolling = useCallback((id: string) => {
    stopPolling();
    fetchJob(id);
    timerRef.current = window.setInterval(() => fetchJob(id), POLL_INTERVAL_MS);
  }, [fetchJob, stopPolling]);

  const start = useCallback(async (params: StartParams) => {
    setError(null);
    setResult(null);
    setProgress(null);
    setCreatedAt(null);
    setUpdatedAt(null);
    setTimedOut(false);
    setStatus("pending");
    const { data, error: invokeErr } = await supabase.functions.invoke(
      "generate-story-video-start",
      { body: params }
    );
    if (invokeErr) {
      setStatus("failed");
      setError(invokeErr.message);
      return null;
    }
    const id = (data as { job_id?: string })?.job_id ?? null;
    if (!id) {
      setStatus("failed");
      setError((data as { error?: string })?.error || "Resposta inválida do servidor");
      return null;
    }
    setJobId(id);
    setCreatedAt((data as { created_at?: string })?.created_at ?? null);
    startPolling(id);
    return id;
  }, [startPolling]);

  const cancel = useCallback(async () => {
    const id = jobId;
    if (id) {
      await supabase.functions.invoke("cancel-story-video-job", { body: { job_id: id } }).catch(() => null);
    }
    stopPolling();
    setStatus("idle");
    setError(null);
    setTimedOut(false);
  }, [jobId, stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setJobId(null);
    setStatus("idle");
    setError(null);
    setResult(null);
    setAttempts(0);
    setProgress(null);
    setCreatedAt(null);
    setUpdatedAt(null);
    setTimedOut(false);
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { jobId, status, error, result, attempts, progress, createdAt, updatedAt, timedOut, start, cancel, reset };
}

export async function fetchStoryVideoScript(params: {
  book_id: string;
  mode: "summary" | "highlights";
  scenesCount?: number;
  text?: string;
  variationSeed?: string | number;
}): Promise<{ title: string; author: string; scenes: DraftScene[] }> {
  const { data, error } = await supabase.functions.invoke("generate-story-video-script", { body: params });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as { title: string; author: string; scenes: DraftScene[] };
}

