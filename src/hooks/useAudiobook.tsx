import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { pdfjs } from 'react-pdf';

// Worker is configured globally in src/lib/pdfjsWorker.ts

const CHUNK_SIZE = 1000; // Reduced to work with limited ElevenLabs credits

export type TTSProvider = 'elevenlabs' | 'openai';

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
  audioUrl?: string;
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>('elevenlabs');

  // Load TTS provider preference from profile
  useEffect(() => {
    if (!user) return;
    
    const loadProviderPreference = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('tts_provider')
        .eq('id', user.id)
        .maybeSingle();

      if (data?.tts_provider && !error) {
        setTtsProvider(data.tts_provider as TTSProvider);
      }
    };

    loadProviderPreference();
  }, [user]);

  // Save TTS provider preference
  const changeTtsProvider = useCallback(async (provider: TTSProvider) => {
    setTtsProvider(provider);
    
    // Clear any cached chunks when switching providers
    chunksRef.current.forEach(chunk => {
      if (chunk.audioUrl) URL.revokeObjectURL(chunk.audioUrl);
    });
    chunksRef.current = [];
    setTotalChunks(0);
    setCurrentChunk(0);
    
    if (!user) return;
    
    await supabase
      .from('profiles')
      .update({ tts_provider: provider })
      .eq('id', user.id);
      
    toast({
      title: "Provedor alterado",
      description: `Audiobook usará ${provider === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI'} para síntese de voz`,
    });
  }, [user, toast]);

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
        .eq('user_id', user.id)
        .eq('book_id', bookId)
        .maybeSingle();

      if (data && !error) {
        setSavedProgress({ page: data.current_page, position: Number(data.playback_position) });
        setPlaybackRate(Number(data.playback_rate));
        setCurrentAudioPage(data.current_page);
      }
    };

    loadProgress();
  }, [user, bookId]);

  // Save progress to database (debounced)
  const saveProgress = useCallback(async (page: number, position: number, rate: number) => {
    if (!user || !bookId) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from('audiobook_progress')
        .upsert({
          user_id: user.id,
          book_id: bookId,
          current_page: page,
          playback_position: position,
          playback_rate: rate,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,book_id'
        });

      if (error) {
        console.error('Error saving audiobook progress:', error);
      }
    }, 2000);
  }, [user, bookId]);

  // Split text into chunks
  const splitIntoChunks = useCallback((text: string): AudioChunk[] => {
    const chunks: AudioChunk[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = '';
    let chunkIndex = 0;
    
    const charsPerPage = Math.ceil(text.length / totalPages);
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > CHUNK_SIZE && currentChunk.length > 0) {
        const startChar = chunks.reduce((sum, c) => sum + c.text.length, 0);
        const endChar = startChar + currentChunk.length;
        
        chunks.push({
          text: currentChunk.trim(),
          startPage: Math.floor(startChar / charsPerPage) + 1,
          endPage: Math.floor(endChar / charsPerPage) + 1,
        });
        currentChunk = sentence;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }
    
    if (currentChunk.trim()) {
      const startChar = chunks.reduce((sum, c) => sum + c.text.length, 0);
      const endChar = startChar + currentChunk.length;
      
      chunks.push({
        text: currentChunk.trim(),
        startPage: Math.floor(startChar / charsPerPage) + 1,
        endPage: Math.min(Math.floor(endChar / charsPerPage) + 1, totalPages),
      });
    }
    
    return chunks;
  }, [totalPages]);

  // Generate audio for a chunk with request stitching
  const generateChunkAudio = useCallback(async (
    chunk: AudioChunk,
    prevChunk?: AudioChunk,
    nextChunk?: AudioChunk
  ): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      // Choose endpoint based on provider
      const endpoint = ttsProvider === 'openai' 
        ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-tts`
        : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audiobook-tts`;

      // Build request body based on provider
      const requestBody = ttsProvider === 'openai'
        ? { text: chunk.text, voice: 'alloy' }
        : {
            text: chunk.text,
            previousText: prevChunk?.text?.slice(-200),
            nextText: nextChunk?.text?.slice(0, 200),
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 403) {
        toast({
          title: "Acesso Premium",
          description: "O audiobook está disponível apenas para assinantes premium",
          variant: "destructive",
        });
        return null;
      }

      if (!response.ok) {
        let serverError: any = null;
        const contentType = response.headers.get('content-type') ?? '';

        if (contentType.includes('application/json')) {
          serverError = await response.json().catch(() => null);
        } else {
          const text = await response.text().catch(() => '');
          serverError = { error: `HTTP ${response.status}`, details: text };
        }

        const edgeError = typeof serverError?.error === 'string'
          ? serverError.error
          : `Falha ao gerar áudio (HTTP ${response.status})`;

        const rawDetails = typeof serverError?.details === 'string' ? serverError.details : '';

        let providerStatus: string | null = null;
        let providerMessage: string | null = null;
        let providerCode: string | null = null;
        try {
          const parsed = rawDetails ? JSON.parse(rawDetails) : null;
          providerStatus = parsed?.detail?.status ?? null;
          providerMessage = parsed?.detail?.message ?? parsed?.error?.message ?? null;
          providerCode = parsed?.error?.code ?? null;
        } catch {
          // ignore
        }

        // Friendly, actionable messaging for common failures
        if (ttsProvider === 'elevenlabs') {
          if (response.status === 401 && providerStatus === 'detected_unusual_activity') {
            toast({
              title: "ElevenLabs indisponível",
              description:
                "O ElevenLabs bloqueou o uso. Troque para OpenAI TTS nas configurações ou use um plano pago do ElevenLabs.",
              variant: "destructive",
            });
          } else if (response.status === 401 && providerStatus === 'missing_permissions') {
            toast({
              title: "Permissão ausente",
              description:
                "API key do ElevenLabs sem permissão TTS. Troque para OpenAI TTS ou atualize sua key.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Erro ElevenLabs",
              description: providerMessage ? `${edgeError}: ${providerMessage}` : edgeError,
              variant: "destructive",
            });
          }
        } else {
          if (response.status === 401 && providerCode === 'invalid_api_key') {
            toast({
              title: "Chave OpenAI inválida",
              description:
                "Atualize a chave OPENAI_API_KEY no backend e tente novamente.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Erro OpenAI TTS",
              description: providerMessage ? `${edgeError}: ${providerMessage}` : edgeError,
              variant: "destructive",
            });
          }
        }

        return null;
      }

      const audioBlob = await response.blob();
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      console.error('Error generating chunk audio:', error);
      toast({
        title: "Erro ao gerar áudio",
        description: "Não foi possível gerar o áudio. Tente novamente.",
        variant: "destructive",
      });
      return null;
    }
  }, [toast, ttsProvider]);

  // Process entire book
  const processFullBook = useCallback(async () => {
    if (!fullText || isProcessing) return;
    
    setIsProcessing(true);
    setProcessingProgress(0);
    
    const chunks = splitIntoChunks(fullText);
    chunksRef.current = chunks;
    
    toast({
      title: "Processando audiobook",
      description: `Gerando áudio para ${chunks.length} partes...`,
    });

    // Generate audio for all chunks sequentially with progress
    for (let i = 0; i < chunks.length; i++) {
      const audioUrl = await generateChunkAudio(
        chunks[i],
        i > 0 ? chunks[i - 1] : undefined,
        i < chunks.length - 1 ? chunks[i + 1] : undefined
      );
      
      if (!audioUrl) {
        setIsProcessing(false);
        // generateChunkAudio already shows a specific toast message
        return;
      }
      
      chunks[i].audioUrl = audioUrl;
      setProcessingProgress(Math.round(((i + 1) / chunks.length) * 100));
    }
    
    chunksRef.current = chunks;
    setTotalChunks(chunks.length);
    setIsProcessing(false);
    
    toast({
      title: "Audiobook pronto",
      description: "O audiobook foi processado com sucesso!",
    });
    
    // Start playing immediately
    playChunk(0);
  }, [fullText, isProcessing, splitIntoChunks, generateChunkAudio, toast]);

  // Play a specific chunk
  const playChunk = useCallback((index: number) => {
    const chunks = chunksRef.current;
    if (index < 0 || index >= chunks.length) return;
    
    const chunk = chunks[index];
    if (!chunk.audioUrl) return;
    
    currentChunkIndexRef.current = index;
    setCurrentChunk(index + 1);
    setCurrentAudioPage(chunk.startPage);
    onPageChange(chunk.startPage);
    
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
    }

    const audio = new Audio(chunk.audioUrl);
    audio.playbackRate = playbackRate;
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      setProgress(audio.currentTime);
      
      // Calculate approximate page based on progress within chunk
      const progressRatio = audio.currentTime / audio.duration;
      const pageRange = chunk.endPage - chunk.startPage;
      const currentPageEstimate = Math.floor(chunk.startPage + (progressRatio * pageRange));
      
      if (currentPageEstimate !== currentAudioPage && currentPageEstimate <= chunk.endPage) {
        setCurrentAudioPage(currentPageEstimate);
        onPageChange(currentPageEstimate);
      }
      
      saveProgress(currentPageEstimate, audio.currentTime, playbackRate);
    });

    audio.addEventListener('ended', () => {
      // Auto-play next chunk
      if (index < chunks.length - 1) {
        playChunk(index + 1);
      } else {
        setIsPlaying(false);
        toast({
          title: "Audiobook finalizado",
          description: "Você chegou ao final do livro!",
        });
      }
    });

    audio.addEventListener('error', () => {
      setIsPlaying(false);
      setIsLoading(false);
      toast({
        title: "Erro",
        description: "Erro ao reproduzir áudio",
        variant: "destructive"
      });
    });

    audio.play().then(() => {
      setIsPlaying(true);
      setIsLoading(false);
    }).catch(error => {
      console.error('Error playing audio:', error);
      setIsLoading(false);
    });
  }, [playbackRate, onPageChange, saveProgress, toast, currentAudioPage]);

  const play = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else if (!audioRef.current || chunksRef.current.length === 0) {
      processFullBook();
    }
  }, [processFullBook]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
    }
    currentChunkIndexRef.current = 0;
  }, []);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  }, []);

  const changePlaybackRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const skipForward = useCallback(() => {
    const nextIndex = currentChunkIndexRef.current + 1;
    if (nextIndex < chunksRef.current.length) {
      playChunk(nextIndex);
    }
  }, [playChunk]);

  const skipBackward = useCallback(() => {
    const prevIndex = currentChunkIndexRef.current - 1;
    if (prevIndex >= 0) {
      playChunk(prevIndex);
    }
  }, [playChunk]);

  const startSleepTimer = useCallback((minutes: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    setSleepTimer(minutes);
    setSleepTimerRemaining(minutes * 60);
    
    timerRef.current = setInterval(() => {
      setSleepTimerRemaining(prev => {
        if (prev === null || prev <= 1) {
          pause();
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setSleepTimer(null);
          toast({
            title: "Timer",
            description: "Audiobook pausado pelo timer de sono",
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
      timerRef.current = null;
    }
    setSleepTimer(null);
    setSleepTimerRemaining(null);
  }, []);

  // Play from a specific page
  const playPage = useCallback(async (pageNum: number) => {
    // Find chunk containing this page
    const chunkIndex = chunksRef.current.findIndex(
      c => pageNum >= c.startPage && pageNum <= c.endPage
    );
    
    if (chunkIndex >= 0 && chunksRef.current[chunkIndex].audioUrl) {
      playChunk(chunkIndex);
    } else {
      // Need to process first
      setIsLoading(true);
      await processFullBook();
    }
  }, [playChunk, processFullBook]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      // Cleanup all chunk audio URLs
      chunksRef.current.forEach(chunk => {
        if (chunk.audioUrl) URL.revokeObjectURL(chunk.audioUrl);
      });
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
    ttsProvider,
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
    changeTtsProvider,
  };
};
