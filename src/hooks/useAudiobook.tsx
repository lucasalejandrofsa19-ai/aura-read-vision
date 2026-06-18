import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useUserData } from '@/hooks/useUserData';
import { useQueryClient } from '@tanstack/react-query';
import { pdfjs } from 'react-pdf';

// Worker is configured globally in src/lib/pdfjsWorker.ts

const CHUNK_SIZE = 500; // smaller chunks for more natural pauses

interface UseAudiobookProps {
  bookId: string;
  pdfUrl?: string;
  extractedText?: string | null;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

interface AudioChunk {
  text: string;
  startPage: number;
  endPage: number;
}

export const useAudiobook = ({ 
  bookId,
  pdfUrl,
  extractedText, 
  totalPages, 
  currentPage,
  onPageChange 
}: UseAudiobookProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingProgressRef = useRef<{ page: number; position: number; rate: number } | null>(null);
  const lastBoundaryUpdateRef = useRef(0);
  const lastBoundaryCharIndexRef = useRef(0);
  const resumeRequestRef = useRef<{ chunkIndex: number; charIndex: number } | null>(null);

  // Used to prevent "auto-next chunk" when we intentionally pause/stop/cancel speech
  const cancelReasonRef = useRef<null | 'pause' | 'stop' | 'skip' | 'internal'>(null);

  // Fallback resume tracking (for browsers that don't emit reliable boundary events)
  const ttsStartTimeRef = useRef<number | null>(null);
  const ttsEstimatedDurationRef = useRef(0);
  const ttsFullLenRef = useRef(0);

  const pdfDocRef = useRef<any>(null);
  const chunksRef = useRef<AudioChunk[]>([]);
  const currentChunkIndexRef = useRef(0);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [currentAudioPage, setCurrentAudioPage] = useState(currentPage);
  const [savedProgress, setSavedProgress] = useState<{ page: number; position: number } | null>(null);
  const [fullText, setFullText] = useState<string>('');
  const [totalChunks, setTotalChunks] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [enhanceNarration, setEnhanceNarration] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState<number>(0);
  const [voicePitch, setVoicePitch] = useState(1);
  
  // Sync reading state
  const [syncEnabled, setSyncEnabledState] = useState(false);
  const [currentSpokenText, setCurrentSpokenText] = useState<string>('');
  const [syncPreferenceLoaded, setSyncPreferenceLoaded] = useState(false);

  // Load sync preference from cached profile
  const { profile, isLoading: profileLoading } = useUserData();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!user || profileLoading) return;
    if (profile?.sync_reading_enabled !== null && profile?.sync_reading_enabled !== undefined) {
      setSyncEnabledState(!!profile.sync_reading_enabled);
    }
    setSyncPreferenceLoaded(true);
  }, [user, profileLoading, profile?.sync_reading_enabled]);

  // Save sync preference to profile
  const setSyncEnabled = useCallback(async (enabled: boolean) => {
    setSyncEnabledState(enabled);

    if (!user) return;

    await supabase
      .from('profiles')
      .update({ sync_reading_enabled: enabled })
      .eq('id', user.id);
    queryClient.invalidateQueries({ queryKey: ["user-profile", user.id] });
  }, [user, queryClient]);


  // Browser TTS refs
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const browserChunkIndexRef = useRef(0);
  const browserTTSPausedRef = useRef(false);
  const isMountedRef = useRef(true);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load available browser voices - prioritize natural/premium voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices() || [];
      
      // Score voices for quality - prefer natural/premium Portuguese voices
      const scoreVoice = (v: SpeechSynthesisVoice): number => {
        let score = 0;
        const name = v.name.toLowerCase();
        const lang = v.lang.toLowerCase();
        
        // Prefer Portuguese
        if (lang.startsWith('pt-br')) score += 100;
        else if (lang.startsWith('pt')) score += 80;
        
        // Prefer natural/premium voices
        if (name.includes('natural')) score += 50;
        if (name.includes('premium')) score += 50;
        if (name.includes('enhanced')) score += 40;
        if (name.includes('neural')) score += 40;
        if (name.includes('wavenet')) score += 40;
        if (name.includes('google')) score += 30;
        if (name.includes('microsoft')) score += 25;
        if (name.includes('female') || name.includes('feminino')) score += 10;
        
        // Avoid robotic/compact voices
        if (name.includes('compact')) score -= 30;
        if (name.includes('espeak')) score -= 40;
        
        return score;
      };
      
      const sortedVoices = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
      setBrowserVoices(sortedVoices);
      
      // Auto-select best voice if none selected
      if (sortedVoices.length > 0 && selectedVoiceIndex === 0) {
        setSelectedVoiceIndex(0); // Already sorted by quality
      }
    };

    loadVoices();
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
    
    return () => {
      window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
    };
  }, [selectedVoiceIndex]);

  // Load PDF document and extract all text
  useEffect(() => {
    const loadAndExtractText = async () => {
      if (extractedText) {
        setFullText(extractedText);
        return;
      }

      if (!pdfUrl) return;
      
      try {
        const loadingTask = pdfjs.getDocument(pdfUrl);
        const pdfDoc = await loadingTask.promise;
        pdfDocRef.current = pdfDoc;
        
        let allText = '';
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          allText += pageText + '\n\n';
        }
        
        setFullText(allText.replace(/\s+/g, ' ').trim());
        console.log(`Extracted ${allText.length} characters from PDF`);
      } catch (error) {
        console.error('Error loading PDF for audiobook:', error);
      }
    };

    loadAndExtractText();

    return () => {
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [pdfUrl, extractedText]);

  // Load saved progress on mount
  useEffect(() => {
    if (!user || !bookId) return;

    const loadProgress = async () => {
      const { data, error } = await supabase
        .from('audiobook_progress')
        .select('current_page, playback_position, playback_rate')
        .eq('book_id', bookId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (data && !error) {
        setSavedProgress({ page: data.current_page, position: data.playback_position });
        setPlaybackRate(data.playback_rate || 1);
      }
    };

    loadProgress();
  }, [user, bookId]);

  // Save progress (throttled: keep latest values, flush every ~2s)
  const saveProgress = useCallback((page: number, position: number, rate: number) => {
    if (!user || !bookId) return;

    // Always keep the most recent progress
    pendingProgressRef.current = { page, position, rate };

    // If a flush is already scheduled, don't reschedule (prevents "debounce never fires")
    if (saveTimeoutRef.current) return;

    saveTimeoutRef.current = setTimeout(async () => {
      const payload = pendingProgressRef.current;
      saveTimeoutRef.current = null;
      if (!payload) return;

      await supabase
        .from('audiobook_progress')
        .upsert(
          {
            book_id: bookId,
            user_id: user.id,
            current_page: payload.page,
            playback_position: payload.position,
            playback_rate: payload.rate,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'book_id,user_id',
          }
        );
    }, 2000);
  }, [user, bookId]);

  // Split text into chunks
  const splitIntoChunks = useCallback((text: string): AudioChunk[] => {
    const chunks: AudioChunk[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunkText = '';
    
    const charsPerPage = Math.ceil(text.length / totalPages);
    
    for (const sentence of sentences) {
      if (currentChunkText.length + sentence.length > CHUNK_SIZE && currentChunkText.length > 0) {
        const startChar = chunks.reduce((sum, c) => sum + c.text.length, 0);
        const endChar = startChar + currentChunkText.length;
        
        chunks.push({
          text: currentChunkText.trim(),
          startPage: Math.floor(startChar / charsPerPage) + 1,
          endPage: Math.floor(endChar / charsPerPage) + 1,
        });
        currentChunkText = sentence;
      } else {
        currentChunkText += (currentChunkText ? ' ' : '') + sentence;
      }
    }
    
    if (currentChunkText.trim()) {
      const startChar = chunks.reduce((sum, c) => sum + c.text.length, 0);
      const endChar = startChar + currentChunkText.length;
      
      chunks.push({
        text: currentChunkText.trim(),
        startPage: Math.floor(startChar / charsPerPage) + 1,
        endPage: Math.min(Math.floor(endChar / charsPerPage) + 1, totalPages),
      });
    }
    
    return chunks;
  }, [totalPages]);

  // Enhance text with AI for better narration
  const enhanceTextWithAI = useCallback(async (text: string): Promise<string> => {
    if (!enhanceNarration) return text;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return text;

      setIsEnhancing(true);
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enhance-narration`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ text }),
        }
      );

      if (!response.ok) {
        console.warn('Failed to enhance narration, using original text');
        return text;
      }

      const data = await response.json();
      return data.enhancedText || text;
    } catch (error) {
      console.error('Error enhancing narration:', error);
      return text;
    } finally {
      setIsEnhancing(false);
    }
  }, [enhanceNarration]);

  // Verify premium access
  const verifyPremiumAccess = useCallback(async (): Promise<boolean> => {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        toast({
          title: "TTS do navegador indisponível",
          description: "Seu navegador não suporta leitura em voz alta (Web Speech API).",
          variant: "destructive",
        });
        return false;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Faça login",
          description: "Entre na sua conta para usar o audiobook.",
          variant: "destructive",
        });
        return false;
      }

      const { data: hasAccess, error: accessError } = await supabase.rpc('has_premium_access', {
        _user_id: session.user.id,
      });

      if (accessError || !hasAccess) {
        toast({
          title: "Acesso Premium",
          description: "O audiobook está disponível apenas para assinantes premium",
          variant: "destructive",
        });
        return false;
      }

      return true;
    } catch (e) {
      console.error('Browser TTS gating error:', e);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar o TTS do navegador.",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  // Initialize chunks
  const initializeChunks = useCallback(() => {
    if (!fullText) return false;
    
    if (chunksRef.current.length === 0) {
      const chunks = splitIntoChunks(fullText);
      chunksRef.current = chunks;
      setTotalChunks(chunks.length);
    }
    
    return chunksRef.current.length > 0;
  }, [fullText, splitIntoChunks]);

  // Play chunk using browser TTS
  const playChunkWithBrowserTTS = useCallback(async (index: number) => {
    const chunks = chunksRef.current;
    if (index < 0 || index >= chunks.length) return;

    const chunk = chunks[index];

    const resumeReq = resumeRequestRef.current;
    const resumeCharIndex =
      resumeReq && resumeReq.chunkIndex === index ? Math.max(0, resumeReq.charIndex || 0) : 0;
    const shouldResumeWithinChunk = resumeCharIndex > 0;

    // Consume resume request only when it matches this chunk
    if (shouldResumeWithinChunk) {
      resumeRequestRef.current = null;
    }

    // Cancel any ongoing speech (some browsers need a tick between cancel -> speak)
    if (
      window.speechSynthesis &&
      (window.speechSynthesis.speaking || window.speechSynthesis.pending)
    ) {
      cancelReasonRef.current = 'internal';
      window.speechSynthesis.cancel();
    }

    browserChunkIndexRef.current = index;
    currentChunkIndexRef.current = index;
    setCurrentChunk(index + 1);

    if (!shouldResumeWithinChunk) {
      setCurrentAudioPage(chunk.startPage);
      onPageChange(chunk.startPage);
      setProgress(0);
      lastBoundaryCharIndexRef.current = 0;
    }

    // Enhance text with AI if enabled
    const textToSpeak = await enhanceTextWithAI(chunk.text);

    // Add subtle pauses for more natural speech
    const processedText = textToSpeak
      .replace(/\.\s+/g, '. ... ') // Pause after periods
      .replace(/,\s+/g, ', .. ') // Shorter pause after commas
      .replace(/!\s+/g, '! ... ')
      .replace(/\?\s+/g, '? ... ')
      .replace(/:\s+/g, ': .. ')
      .replace(/;\s+/g, '; .. ');

    const fullTextToSpeak = processedText;
    const fullLen = Math.max(1, fullTextToSpeak.length);
    const normalizedResumeCharIndex = Math.min(resumeCharIndex, fullTextToSpeak.length);

    const utteranceText = shouldResumeWithinChunk
      ? fullTextToSpeak.slice(normalizedResumeCharIndex)
      : fullTextToSpeak;

    // If we "resume" but there's nothing left to say, just move to the next chunk
    if (shouldResumeWithinChunk && utteranceText.length === 0) {
      if (index < chunks.length - 1) {
        // Defer to avoid calling setState during render
        queueMicrotask(() => {
          if (isMountedRef.current) {
            playChunkWithBrowserTTS(index + 1);
          }
        });
      } else {
        queueMicrotask(() => {
          if (isMountedRef.current) {
            setIsPlaying(false);
          }
        });
      }
      return;
    }

    const utterance = new SpeechSynthesisUtterance(utteranceText);

    // Slightly slower for more natural sound
    utterance.rate = Math.max(0.85, playbackRate * 0.95);
    utterance.pitch = voicePitch;
    utterance.volume = 1;
    utterance.lang = 'pt-BR';

    // Set selected voice if available
    if (browserVoices.length > 0 && browserVoices[selectedVoiceIndex]) {
      utterance.voice = browserVoices[selectedVoiceIndex];
    }

    // Estimate duration (based on full chunk text, so UI doesn't jump back on resume)
    const words = fullTextToSpeak.split(/\s+/).filter(Boolean).length;
    const estimatedDuration = (words / 150) * 60 / playbackRate;
    setDuration(estimatedDuration);

    ttsEstimatedDurationRef.current = estimatedDuration;
    ttsFullLenRef.current = fullLen;

    const startOffsetSeconds = shouldResumeWithinChunk
      ? (normalizedResumeCharIndex / fullLen) * estimatedDuration
      : 0;

    if (shouldResumeWithinChunk) {
      setProgress(startOffsetSeconds);
      lastBoundaryCharIndexRef.current = normalizedResumeCharIndex;
    }

    let startTime = Date.now() - startOffsetSeconds * 1000;
    ttsStartTimeRef.current = startTime;

    utterance.onstart = () => {
      if (!isMountedRef.current) return;
      cancelReasonRef.current = null;
      startTime = Date.now() - startOffsetSeconds * 1000;
      ttsStartTimeRef.current = startTime;
      queueMicrotask(() => {
        if (isMountedRef.current) {
          setIsPlaying(true);
          setIsLoading(false);
        }
      });
    };

    utterance.onend = () => {
      if (!isMountedRef.current) return;

      const cancelReason = cancelReasonRef.current;
      if (cancelReason) {
        cancelReasonRef.current = null;
        return;
      }

      // Auto-play next chunk - defer to avoid React queue issues
      if (index < chunks.length - 1) {
        queueMicrotask(() => {
          if (isMountedRef.current) {
            playChunkWithBrowserTTS(index + 1);
          }
        });
      } else {
        queueMicrotask(() => {
          if (isMountedRef.current) {
            setIsPlaying(false);
            toast({
              title: 'Audiobook finalizado',
              description: 'Você chegou ao final do livro!',
            });
          }
        });
      }
    };

    utterance.onerror = (event) => {
      // Ignore 'interrupted' and 'canceled' errors - these happen on pause/stop
      const errorType = (event as any).error;
      if (errorType === 'interrupted' || errorType === 'canceled') {
        cancelReasonRef.current = null;
        console.log('Browser TTS interrupted/canceled (normal on pause)');
        return;
      }

      if (!isMountedRef.current) return;
      console.error('Browser TTS error:', event);
      queueMicrotask(() => {
        if (isMountedRef.current) {
          setIsPlaying(false);
          setIsLoading(false);
          toast({
            title: 'Erro',
            description: 'Erro ao reproduzir áudio com o navegador',
            variant: 'destructive',
          });
        }
      });
    };

    // Track progress (throttle UI updates to avoid freezes)
    utterance.onboundary = (event) => {
      if (!isMountedRef.current) return;

      const now = Date.now();
      if (now - lastBoundaryUpdateRef.current < 250) return;
      lastBoundaryUpdateRef.current = now;

      const evt = event as SpeechSynthesisEvent;
      const localCharIndex = typeof evt.charIndex === 'number' ? evt.charIndex : 0;
      const absoluteCharIndex = shouldResumeWithinChunk
        ? normalizedResumeCharIndex + localCharIndex
        : localCharIndex;
      lastBoundaryCharIndexRef.current = absoluteCharIndex;

      const elapsed = (now - startTime) / 1000;

      const progressRatio = estimatedDuration ? elapsed / estimatedDuration : 0;
      const pageRange = chunk.endPage - chunk.startPage;
      const rawPageEstimate = Math.floor(chunk.startPage + progressRatio * pageRange);
      const currentPageEstimate = Math.min(
        chunk.endPage,
        Math.max(chunk.startPage, Number.isFinite(rawPageEstimate) ? rawPageEstimate : chunk.startPage)
      );

      // Extract currently spoken words for sync highlighting
      if (syncEnabled && evt.name === 'word') {
        const chunkText = chunk.text;
        // Get ~30 chars around current position for highlighting
        const snippetStart = Math.max(0, absoluteCharIndex - 5);
        const snippetEnd = Math.min(chunkText.length, absoluteCharIndex + 40);
        const spokenSnippet = chunkText.slice(snippetStart, snippetEnd).trim();
        // Extract first 2-4 words from the snippet
        const words = spokenSnippet.split(/\s+/).slice(0, 4).join(' ');
        if (words.length > 3) {
          queueMicrotask(() => {
            if (isMountedRef.current) {
              setCurrentSpokenText(words);
            }
          });
        }
      }

      // Defer state updates to avoid React queue issues
      queueMicrotask(() => {
        if (!isMountedRef.current) return;
        setProgress(elapsed);

        if (currentPageEstimate !== currentAudioPage && currentPageEstimate <= chunk.endPage) {
          setCurrentAudioPage(currentPageEstimate);
          if (syncEnabled) {
            onPageChange(currentPageEstimate);
          }
        }

        saveProgress(currentPageEstimate, elapsed, playbackRate);
      });
    };

    speechSynthRef.current = utterance;

    // Speak on next tick (helps after cancel in some browsers)
    setTimeout(() => {
      if (isMountedRef.current) {
        window.speechSynthesis.speak(utterance);
      }
    }, 0);
  }, [playbackRate, voicePitch, browserVoices, selectedVoiceIndex, onPageChange, saveProgress, toast, currentAudioPage, enhanceTextWithAI, syncEnabled]);

  // Generate and play chunk
  const generateAndPlayChunk = useCallback(async (index: number) => {
    const chunks = chunksRef.current;
    if (index < 0 || index >= chunks.length) {
      toast({
        title: "Erro",
        description: "Chunk inválido",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const hasAccess = await verifyPremiumAccess();
    if (!hasAccess) {
      setIsLoading(false);
      return;
    }

    playChunkWithBrowserTTS(index);
  }, [verifyPremiumAccess, playChunkWithBrowserTTS, toast]);

  const play = useCallback(() => {
    // Prefer native resume when we were paused
    if (window.speechSynthesis.paused || browserTTSPausedRef.current) {
      cancelReasonRef.current = null;

      try {
        window.speechSynthesis.resume();
      } catch {
        // ignore
      }

      // If the browser successfully resumed, keep going
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        setIsPlaying(true);
        browserTTSPausedRef.current = false;
        resumeRequestRef.current = null;
        return;
      }

      // Some browsers cancel the utterance on pause; fall back to restarting the current chunk
      // (playChunkWithBrowserTTS will resume from last boundary when possible)
      browserTTSPausedRef.current = false;
    }

    if (!initializeChunks()) {
      toast({
        title: "Texto não disponível",
        description: "Não foi possível extrair o texto do livro.",
        variant: "destructive",
      });
      return;
    }

    generateAndPlayChunk(browserChunkIndexRef.current);
  }, [initializeChunks, generateAndPlayChunk, toast]);

  const pause = useCallback(() => {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      cancelReasonRef.current = 'pause';

      const now = Date.now();
      const startTime = ttsStartTimeRef.current;
      const estimatedDuration = ttsEstimatedDurationRef.current;
      const fullLen = ttsFullLenRef.current;

      const elapsed = startTime ? (now - startTime) / 1000 : progress;
      const ratio = estimatedDuration ? Math.min(1, Math.max(0, elapsed / estimatedDuration)) : 0;
      const estimatedCharIndex = fullLen ? Math.floor(ratio * fullLen) : 0;
      const charIndex = Math.max(lastBoundaryCharIndexRef.current || 0, estimatedCharIndex);

      // Store a resume point for browsers that don't truly resume (they cancel on pause)
      resumeRequestRef.current = {
        chunkIndex: browserChunkIndexRef.current,
        charIndex,
      };

      saveProgress(currentAudioPage, elapsed, playbackRate);

      window.speechSynthesis.pause();
      browserTTSPausedRef.current = true;
      setIsPlaying(false);
    }
  }, [currentAudioPage, progress, playbackRate, saveProgress]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const stop = useCallback(() => {
    cancelReasonRef.current = 'stop';
    window.speechSynthesis.cancel();
    browserTTSPausedRef.current = false;
    resumeRequestRef.current = null;
    lastBoundaryCharIndexRef.current = 0;
    ttsStartTimeRef.current = null;
    setIsPlaying(false);
    setProgress(0);
    browserChunkIndexRef.current = 0;
    currentChunkIndexRef.current = 0;
    setCurrentChunk(0);
  }, []);

  const seekTo = useCallback((time: number) => {
    // Browser TTS doesn't support seeking within utterance
    console.log('Seeking not supported for browser TTS');
  }, []);

  const changePlaybackRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    // Will apply to next chunk
  }, []);

  const skipForward = useCallback(() => {
    const nextIndex = browserChunkIndexRef.current + 1;
    if (nextIndex < chunksRef.current.length) {
      cancelReasonRef.current = 'skip';
      window.speechSynthesis.cancel();
      generateAndPlayChunk(nextIndex);
    }
  }, [generateAndPlayChunk]);

  const skipBackward = useCallback(() => {
    const prevIndex = browserChunkIndexRef.current - 1;
    if (prevIndex >= 0) {
      cancelReasonRef.current = 'skip';
      window.speechSynthesis.cancel();
      generateAndPlayChunk(prevIndex);
    }
  }, [generateAndPlayChunk]);

  const startSleepTimer = useCallback((minutes: number) => {
    setSleepTimer(minutes);
    setSleepTimerRemaining(minutes * 60);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setSleepTimerRemaining((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          pause();
          setSleepTimer(null);
          toast({
            title: "Timer encerrado",
            description: "O audiobook foi pausado automaticamente.",
          });
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [pause, toast]);

  const cancelSleepTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setSleepTimer(null);
    setSleepTimerRemaining(null);
  }, []);

  const playPage = useCallback((page: number) => {
    if (!initializeChunks()) return;

    const chunks = chunksRef.current;
    const chunkIndex = chunks.findIndex(
      (c) => page >= c.startPage && page <= c.endPage
    );

    if (chunkIndex !== -1) {
      cancelReasonRef.current = 'skip';
      window.speechSynthesis.cancel();
      generateAndPlayChunk(chunkIndex);
    }
  }, [initializeChunks, generateAndPlayChunk]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    isPlaying,
    isLoading,
    isProcessing,
    processingProgress,
    playbackRate,
    progress,
    duration,
    sleepTimer,
    sleepTimerRemaining,
    currentAudioPage,
    savedProgress,
    hasFullText: !!fullText,
    totalChunks,
    currentChunk,
    enhanceNarration,
    isEnhancing,
    browserVoices,
    selectedVoiceIndex,
    voicePitch,
    syncEnabled,
    currentSpokenText,
    play,
    pause,
    togglePlayPause,
    stop,
    seekTo,
    changePlaybackRate,
    skipForward,
    skipBackward,
    startSleepTimer,
    cancelSleepTimer,
    playPage,
    setEnhanceNarration,
    setSelectedVoiceIndex,
    setVoicePitch,
    setSyncEnabled,
  };
};
