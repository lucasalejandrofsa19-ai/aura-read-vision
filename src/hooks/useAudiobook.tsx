import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { pdfjs } from 'react-pdf';

// Worker is configured globally in src/lib/pdfjsWorker.ts

const CHUNK_SIZE = 1000; // characters per chunk for browser TTS

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

  // Browser TTS refs
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const browserChunkIndexRef = useRef(0);
  const browserTTSPausedRef = useRef(false);

  // Load available browser voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices() || [];
      const portugueseVoices = voices.filter(v => 
        v.lang.startsWith('pt') || v.lang.includes('Portuguese')
      );
      const sortedVoices = [
        ...portugueseVoices,
        ...voices.filter(v => !portugueseVoices.includes(v))
      ];
      setBrowserVoices(sortedVoices);
      
      if (sortedVoices.length > 0 && selectedVoiceIndex === 0) {
        const bestVoice = sortedVoices.findIndex(v => 
          v.lang === 'pt-BR' && v.name.toLowerCase().includes('google')
        );
        if (bestVoice !== -1) {
          setSelectedVoiceIndex(bestVoice);
        }
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

  // Save progress (debounced)
  const saveProgress = useCallback((page: number, position: number, rate: number) => {
    if (!user || !bookId) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await supabase
        .from('audiobook_progress')
        .upsert({
          book_id: bookId,
          user_id: user.id,
          current_page: page,
          playback_position: position,
          playback_rate: rate,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'book_id,user_id'
        });
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
    
    // Cancel any ongoing speech
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    browserChunkIndexRef.current = index;
    currentChunkIndexRef.current = index;
    setCurrentChunk(index + 1);
    setCurrentAudioPage(chunk.startPage);
    onPageChange(chunk.startPage);

    // Enhance text with AI if enabled
    const textToSpeak = await enhanceTextWithAI(chunk.text);
    
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = playbackRate;
    utterance.pitch = voicePitch;
    utterance.volume = 1;
    utterance.lang = 'pt-BR';
    
    // Set selected voice if available
    if (browserVoices.length > 0 && browserVoices[selectedVoiceIndex]) {
      utterance.voice = browserVoices[selectedVoiceIndex];
    }
    
    // Estimate duration
    const words = textToSpeak.split(/\s+/).length;
    const estimatedDuration = (words / 150) * 60 / playbackRate;
    setDuration(estimatedDuration);
    
    let startTime = Date.now();
    
    utterance.onstart = () => {
      startTime = Date.now();
      setIsPlaying(true);
      setIsLoading(false);
    };
    
    utterance.onend = () => {
      // Auto-play next chunk
      if (index < chunks.length - 1) {
        playChunkWithBrowserTTS(index + 1);
      } else {
        setIsPlaying(false);
        toast({
          title: "Audiobook finalizado",
          description: "Você chegou ao final do livro!",
        });
      }
    };
    
    utterance.onerror = (event) => {
      // Ignore 'interrupted' and 'canceled' errors - these happen on pause/stop
      const errorType = (event as any).error;
      if (errorType === 'interrupted' || errorType === 'canceled') {
        console.log('Browser TTS interrupted/canceled (normal on pause)');
        return;
      }
      
      console.error('Browser TTS error:', event);
      setIsPlaying(false);
      setIsLoading(false);
      toast({
        title: "Erro",
        description: "Erro ao reproduzir áudio com o navegador",
        variant: "destructive"
      });
    };
    
    // Track progress
    utterance.onboundary = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      setProgress(elapsed);
      
      const progressRatio = elapsed / estimatedDuration;
      const pageRange = chunk.endPage - chunk.startPage;
      const currentPageEstimate = Math.floor(chunk.startPage + (progressRatio * pageRange));
      
      if (currentPageEstimate !== currentAudioPage && currentPageEstimate <= chunk.endPage) {
        setCurrentAudioPage(currentPageEstimate);
        onPageChange(currentPageEstimate);
      }
      
      saveProgress(currentPageEstimate, elapsed, playbackRate);
    };
    
    speechSynthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [playbackRate, voicePitch, browserVoices, selectedVoiceIndex, onPageChange, saveProgress, toast, currentAudioPage, enhanceTextWithAI]);

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
    // Try to resume first if paused
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      browserTTSPausedRef.current = false;
      return;
    }
    
    // If was paused but synthesis got cancelled, restart from current chunk
    if (browserTTSPausedRef.current) {
      browserTTSPausedRef.current = false;
      if (!initializeChunks()) {
        toast({
          title: "Texto não disponível",
          description: "Não foi possível extrair o texto do livro.",
          variant: "destructive",
        });
        return;
      }
      generateAndPlayChunk(browserChunkIndexRef.current);
      return;
    }
    
    if (!initializeChunks()) {
      toast({
        title: "Texto não disponível",
        description: "Não foi possível extrair o texto do livro.",
        variant: "destructive",
      });
    } else {
      generateAndPlayChunk(browserChunkIndexRef.current);
    }
  }, [initializeChunks, generateAndPlayChunk, toast]);

  const pause = useCallback(() => {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.pause();
      browserTTSPausedRef.current = true;
      setIsPlaying(false);
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    browserTTSPausedRef.current = false;
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
      window.speechSynthesis.cancel();
      generateAndPlayChunk(nextIndex);
    }
  }, [generateAndPlayChunk]);

  const skipBackward = useCallback(() => {
    const prevIndex = browserChunkIndexRef.current - 1;
    if (prevIndex >= 0) {
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
  };
};
