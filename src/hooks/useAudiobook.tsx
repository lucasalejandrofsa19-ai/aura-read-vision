import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const CHUNK_SIZE = 4500; // Characters per chunk (ElevenLabs limit is 5000)

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
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const chunksRef = useRef<AudioChunk[]>([]);
  const currentChunkIndexRef = useRef(0);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [currentAudioPage, setCurrentAudioPage] = useState(currentPage);
  const [savedProgress, setSavedProgress] = useState<{ page: number; position: number } | null>(null);
  const [fullText, setFullText] = useState<string>('');

  // Load PDF document and extract all text
  useEffect(() => {
    const loadAndExtractText = async () => {
      if (extractedText) {
        setFullText(extractedText);
        return;
      }

      if (!pdfUrl) return;
      
      try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
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

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audiobook-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ 
            text: chunk.text,
            previousText: prevChunk?.text?.slice(-200),
            nextText: nextChunk?.text?.slice(0, 200),
          }),
        }
      );

      if (response.status === 403) {
        toast({
          title: "Acesso Premium",
          description: "O audiobook está disponível apenas para assinantes premium",
          variant: "destructive"
        });
        return null;
      }

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      const audioBlob = await response.blob();
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      console.error('Error generating chunk audio:', error);
      return null;
    }
  }, [toast]);

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
        toast({
          title: "Erro",
          description: "Falha ao processar audiobook. Tente novamente.",
          variant: "destructive"
        });
        return;
      }
      
      chunks[i].audioUrl = audioUrl;
      setProcessingProgress(Math.round(((i + 1) / chunks.length) * 100));
    }
    
    chunksRef.current = chunks;
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
    totalChunks: chunksRef.current.length,
    currentChunk: currentChunkIndexRef.current + 1,
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
  };
};
