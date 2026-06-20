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

export type StartParams = {
  book_id: string;
  mode?: "summary" | "chapter" | "custom";
  text?: string;
  voice?: string;
  scenesCount?: number;
  variationSeed?: string | number;
};

const POLL_INTERVAL_MS = 2500;

export function useStoryVideoJob() {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StoryVideoResult | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const timerRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const fetchJob = useCallback(async (id: string) => {
    const { data, error: e } = await supabase
      .from("story_video_jobs")
      .select("status, error, result, attempts, progress")
      .eq("id", id)
      .maybeSingle();
    if (e) {
      setError(e.message);
      return;
    }
    if (!data) return;
    setStatus(data.status as JobStatus);
    setAttempts(data.attempts ?? 0);
    const p = data.progress as unknown as JobProgress | null;
    if (p && typeof p.total === "number" && p.total > 0) setProgress(p);
    if (data.status === "completed" && data.result) {
      setResult(data.result as unknown as StoryVideoResult);
      queryClient.invalidateQueries({ queryKey: ["story-video-quota"] });
      stopPolling();
    } else if (data.status === "failed") {
      setError(data.error || "Falha na geração");
      stopPolling();
    }
  }, [stopPolling, queryClient]);

  const startPolling = useCallback((id: string) => {
    stopPolling();
    fetchJob(id);
    timerRef.current = window.setInterval(() => fetchJob(id), POLL_INTERVAL_MS);
  }, [fetchJob, stopPolling]);

  const start = useCallback(async (params: StartParams) => {
    setError(null);
    setResult(null);
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
    startPolling(id);
    return id;
  }, [startPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setJobId(null);
    setStatus("idle");
    setError(null);
    setResult(null);
    setAttempts(0);
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { jobId, status, error, result, attempts, start, reset };
}
