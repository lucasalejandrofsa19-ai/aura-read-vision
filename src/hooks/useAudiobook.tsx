import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { pdfjs } from 'react-pdf';

// Worker is configured globally in src/lib/pdfjsWorker.ts

const OPENAI_CHUNK_SIZE = 1000;
const ELEVENLABS_SAFE_CHUNK_SIZE = 450; // helps fit quota/low-credit situations better than large chunks
const CHUNK_SIZE = ELEVENLABS_SAFE_CHUNK_SIZE; // default splitter size (safe for ElevenLabs)

export type TTSProvider = 'elevenlabs' | 'openai' | 'browser';

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
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>('browser');

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
    // Cancel any ongoing browser speech
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    setTtsProvider(provider);
    setIsPlaying(false);
    
    // Clear any cached chunks when switching providers
    chunksRef.current.forEach(chunk => {
      if (chunk.audioUrl && chunk.audioUrl !== 'browser-tts') {
        URL.revokeObjectURL(chunk.audioUrl);
      }
    });
    chunksRef.current = [];
    setTotalChunks(0);
    setCurrentChunk(0);
    
    if (!user) return;
    
    await supabase
      .from('profiles')
      .update({ tts_provider: provider })
      .eq('id', user.id);
      
    const providerNames: Record<TTSProvider, string> = {
      elevenlabs: 'ElevenLabs',
      openai: 'OpenAI',
      browser: 'Navegador (gratuito)',
    };
    
    toast({
      title: "Provedor alterado",
      description: `Audiobook usará ${providerNames[provider]} para síntese de voz`,
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

  // Browser TTS state
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const browserChunkIndexRef = useRef(0);

  // Generate audio for a chunk with request stitching (for ElevenLabs/OpenAI)
  const generateChunkAudio = useCallback(async (
    chunk: AudioChunk,
    prevChunk?: AudioChunk,
    nextChunk?: AudioChunk
  ): Promise<string | null> => {
    // Browser TTS doesn't pre-generate audio files, but we still keep premium/auth gating
    if (ttsProvider === 'browser') {
      try {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
          toast({
            title: "TTS do navegador indisponível",
            description: "Seu navegador não suporta leitura em voz alta (Web Speech API).",
            variant: "destructive",
          });
          return null;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          toast({
            title: "Faça login",
            description: "Entre na sua conta para usar o audiobook.",
            variant: "destructive",
          });
          return null;
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
          return null;
        }

        return 'browser-tts'; // Placeholder to indicate browser TTS
      } catch (e) {
        console.error('Browser TTS gating error:', e);
        toast({
          title: "Erro",
          description: "Não foi possível iniciar o TTS do navegador.",
          variant: "destructive",
        });
        return null;
      }
    }

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
          const shouldSuggestAlternative = 
            providerStatus === 'detected_unusual_activity' ||
            providerStatus === 'quota_exceeded' ||
            providerStatus === 'missing_permissions';

          if (shouldSuggestAlternative) {
            const statusMessages: Record<string, string> = {
              detected_unusual_activity: "O ElevenLabs bloqueou o uso por atividade incomum.",
              quota_exceeded: "Créditos insuficientes no ElevenLabs.",
              missing_permissions: "API key do ElevenLabs sem permissão TTS.",
            };
            
            toast({
              title: "ElevenLabs indisponível",
              description: `${statusMessages[providerStatus] || 'Erro no ElevenLabs.'} Use o TTS do navegador (gratuito).`,
              variant: "destructive",
              action: (
                <button 
                  onClick={() => changeTtsProvider('browser')}
                  className="ml-2 rounded bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Usar Navegador
                </button>
              ),
            });
          } else {
            toast({
              title: "Erro ElevenLabs",
              description: providerMessage ? `${edgeError}: ${providerMessage}` : edgeError,
              variant: "destructive",
            });
          }
        } else {
          // OpenAI error handling
          const isQuotaError = 
            response.status === 429 || 
            providerCode === 'insufficient_quota';
          
          if (response.status === 401 && providerCode === 'invalid_api_key') {
            toast({
              title: "Chave OpenAI inválida",
              description:
                "Atualize a chave OPENAI_API_KEY no backend e tente novamente.",
              variant: "destructive",
            });
          } else if (isQuotaError) {
            toast({
              title: "Créditos OpenAI esgotados",
              description:
                "A conta OpenAI excedeu a cota. Use o TTS do navegador (gratuito) ou adicione créditos.",
              variant: "destructive",
              action: (
                <button 
                  onClick={() => changeTtsProvider('browser')}
                  className="ml-2 rounded bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Usar Navegador
                </button>
              ),
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
  }, [toast, ttsProvider, changeTtsProvider]);

  // Initialize chunks without pre-generating audio (on-demand approach)
  const initializeChunks = useCallback(() => {
    if (!fullText) return false;
    
    if (chunksRef.current.length === 0) {
      const chunks = splitIntoChunks(fullText);
      chunksRef.current = chunks;
      setTotalChunks(chunks.length);
    }
    
    return chunksRef.current.length > 0;
  }, [fullText, splitIntoChunks]);

  // Ref to hold generateAndPlayChunk to avoid circular dependency
  const generateAndPlayChunkRef = useRef<(index: number) => Promise<void>>();

  // Play chunk using browser TTS (Web Speech API)
  const playChunkWithBrowserTTS = useCallback((index: number) => {
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
    
    const utterance = new SpeechSynthesisUtterance(chunk.text);
    utterance.rate = playbackRate;
    utterance.lang = 'pt-BR'; // Portuguese
    
    // Estimate duration (rough: ~150 words per minute)
    const words = chunk.text.split(/\s+/).length;
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
      
      // Calculate approximate page
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
  }, [playbackRate, onPageChange, saveProgress, toast, currentAudioPage]);

  // Play a specific chunk (for ElevenLabs/OpenAI)
  const playChunk = useCallback((index: number) => {
    // Use browser TTS flow
    if (ttsProvider === 'browser') {
      playChunkWithBrowserTTS(index);
      return;
    }
    
    const chunks = chunksRef.current;
    if (index < 0 || index >= chunks.length) return;
    
    const chunk = chunks[index];
    if (!chunk.audioUrl || chunk.audioUrl === 'browser-tts') return;
    
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
      // Auto-play next chunk (on-demand)
      if (index < chunks.length - 1) {
        const nextChunk = chunks[index + 1];
        if (nextChunk.audioUrl && nextChunk.audioUrl !== 'browser-tts') {
          // Already pre-fetched, play directly
          playChunk(index + 1);
        } else if (generateAndPlayChunkRef.current) {
          // Generate on-demand
          generateAndPlayChunkRef.current(index + 1);
        }
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
  }, [playbackRate, onPageChange, saveProgress, toast, currentAudioPage, ttsProvider, playChunkWithBrowserTTS]);

  // Generate and play a chunk on-demand
  const generateAndPlayChunk = useCallback(async (index: number) => {
    const chunks = chunksRef.current;
    if (index < 0 || index >= chunks.length) return;

    const chunk = chunks[index];

    // If audio already generated, just play it
    if (chunk.audioUrl && chunk.audioUrl !== 'browser-tts') {
      playChunk(index);
      return;
    }

    setIsLoading(true);

    let audioUrl: string | null = null;

    try {
      // Generate audio for this chunk
      audioUrl = await generateChunkAudio(
        chunk,
        index > 0 ? chunks[index - 1] : undefined,
        index < chunks.length - 1 ? chunks[index + 1] : undefined,
      );
    } catch (error) {
      console.error('Error generating chunk audio:', error);
      toast({
        title: "Erro",
        description:
          "Não foi possível gerar o áudio. Tente novamente ou altere o provedor de voz.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (!audioUrl) {
      setIsLoading(false);
      return;
    }

    chunk.audioUrl = audioUrl;
    chunksRef.current[index] = chunk;

    // Play the chunk
    playChunk(index);

    // Pre-fetch next chunk in background (if not browser TTS)
    if (ttsProvider !== 'browser' && index < chunks.length - 1) {
      const nextChunk = chunks[index + 1];
      if (!nextChunk.audioUrl) {
        generateChunkAudio(
          nextChunk,
          chunk,
          index + 2 < chunks.length ? chunks[index + 2] : undefined,
        )
          .then((url) => {
            if (url) {
              nextChunk.audioUrl = url;
              chunksRef.current[index + 1] = nextChunk;
            }
          })
          .catch((e) => {
            console.error('Error prefetching next chunk:', e);
          });
      }
    }
  }, [generateChunkAudio, ttsProvider, playChunk, toast]);

  // Keep ref updated
  useEffect(() => {
    generateAndPlayChunkRef.current = generateAndPlayChunk;
  }, [generateAndPlayChunk]);

  const play = useCallback(() => {
    if (ttsProvider === 'browser') {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPlaying(true);
      } else if (!initializeChunks()) {
        toast({
          title: "Texto não disponível",
          description: "Não foi possível extrair o texto do livro.",
          variant: "destructive",
        });
      } else {
        generateAndPlayChunk(browserChunkIndexRef.current);
      }
    } else {
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play();
        setIsPlaying(true);
      } else if (!initializeChunks()) {
        toast({
          title: "Texto não disponível",
          description: "Não foi possível extrair o texto do livro.",
          variant: "destructive",
        });
      } else {
        generateAndPlayChunk(currentChunkIndexRef.current);
      }
    }
  }, [initializeChunks, generateAndPlayChunk, ttsProvider, toast]);

  const pause = useCallback(() => {
    if (ttsProvider === 'browser') {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        setIsPlaying(false);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [ttsProvider]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const stop = useCallback(() => {
    if (ttsProvider === 'browser') {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setProgress(0);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
        setProgress(0);
      }
    }
    currentChunkIndexRef.current = 0;
    browserChunkIndexRef.current = 0;
  }, [ttsProvider]);

  const seekTo = useCallback((time: number) => {
    // Note: Browser TTS doesn't support seeking
    if (ttsProvider !== 'browser' && audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  }, [ttsProvider]);

  const changePlaybackRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (ttsProvider === 'browser') {
      // Browser TTS rate will apply on next chunk
      // Note: speechSynthesis doesn't allow changing rate mid-speech
      toast({
        title: "Velocidade alterada",
        description: "A nova velocidade será aplicada no próximo trecho",
      });
    } else if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, [ttsProvider, toast]);

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
    } else if (chunkIndex >= 0) {
      // Generate on-demand
      generateAndPlayChunk(chunkIndex);
    } else {
      // Initialize and play first chunk
      if (initializeChunks()) {
        generateAndPlayChunk(0);
      }
    }
  }, [playChunk, initializeChunks, generateAndPlayChunk]);

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
