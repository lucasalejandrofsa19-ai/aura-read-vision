import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseAudiobookProps {
  extractedText?: string | null;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export const useAudiobook = ({ 
  extractedText, 
  totalPages, 
  currentPage,
  onPageChange 
}: UseAudiobookProps) => {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [currentAudioPage, setCurrentAudioPage] = useState(currentPage);

  // Split text into pages (approximate)
  const getPageText = useCallback((pageNum: number) => {
    if (!extractedText) return '';
    
    const avgCharsPerPage = Math.ceil(extractedText.length / totalPages);
    const start = (pageNum - 1) * avgCharsPerPage;
    const end = pageNum * avgCharsPerPage;
    
    return extractedText.slice(start, end);
  }, [extractedText, totalPages]);

  const generateAudio = useCallback(async (text: string): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para usar o audiobook",
          variant: "destructive"
        });
        return null;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audiobook-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ text }),
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
      console.error('Error generating audio:', error);
      toast({
        title: "Erro",
        description: "Falha ao gerar áudio. Tente novamente.",
        variant: "destructive"
      });
      return null;
    }
  }, [toast]);

  const playPage = useCallback(async (pageNum: number) => {
    const text = getPageText(pageNum);
    
    if (!text.trim()) {
      toast({
        title: "Aviso",
        description: "Não há texto disponível nesta página",
        variant: "default"
      });
      return;
    }

    setIsLoading(true);
    setCurrentAudioPage(pageNum);

    const audioUrl = await generateAudio(text);
    
    if (!audioUrl) {
      setIsLoading(false);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
    }

    const audio = new Audio(audioUrl);
    audio.playbackRate = playbackRate;
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      setProgress(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      // Auto-play next page
      if (pageNum < totalPages) {
        playPage(pageNum + 1);
        onPageChange(pageNum + 1);
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

    try {
      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing audio:', error);
    }
    
    setIsLoading(false);
  }, [getPageText, generateAudio, playbackRate, totalPages, onPageChange, toast]);

  const play = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else if (!audioRef.current) {
      playPage(currentPage);
    }
  }, [currentPage, playPage]);

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
    if (currentAudioPage < totalPages) {
      const nextPage = currentAudioPage + 1;
      stop();
      playPage(nextPage);
      onPageChange(nextPage);
    }
  }, [currentAudioPage, totalPages, stop, playPage, onPageChange]);

  const skipBackward = useCallback(() => {
    if (currentAudioPage > 1) {
      const prevPage = currentAudioPage - 1;
      stop();
      playPage(prevPage);
      onPageChange(prevPage);
    }
  }, [currentAudioPage, stop, playPage, onPageChange]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    isPlaying,
    isLoading,
    playbackRate,
    progress,
    duration,
    sleepTimer,
    sleepTimerRemaining,
    currentAudioPage,
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
