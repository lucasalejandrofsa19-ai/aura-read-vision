import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Timer,
  X,
  Loader2,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PremiumBadge } from "./PremiumBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AudiobookPlayerProps {
  bookId: string;
  bookTitle: string;
  extractedText: string | null;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onClose: () => void;
}

const VOICES = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George (Masculino)" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (Feminino)" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura (Feminino)" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam (Masculino)" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily (Feminino)" },
];

const SLEEP_TIMER_OPTIONS = [
  { value: 0, label: "Desligado" },
  { value: 5, label: "5 minutos" },
  { value: 15, label: "15 minutos" },
  { value: 30, label: "30 minutos" },
  { value: 60, label: "1 hora" },
];

export const AudiobookPlayer = ({
  bookId,
  bookTitle,
  extractedText,
  totalPages,
  currentPage,
  onPageChange,
  onClose,
}: AudiobookPlayerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [sleepTimer, setSleepTimer] = useState(0);
  const [sleepTimeRemaining, setSleepTimeRemaining] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Split text into pages (approximate)
  const getPageText = useCallback((pageNum: number) => {
    if (!extractedText) return "";
    const charsPerPage = Math.ceil(extractedText.length / totalPages);
    const start = (pageNum - 1) * charsPerPage;
    const end = start + charsPerPage;
    return extractedText.slice(start, end);
  }, [extractedText, totalPages]);

  // Generate audio for current page
  const generateAudio = async () => {
    const pageText = getPageText(currentPage);
    if (!pageText.trim()) {
      toast({
        title: "Sem texto",
        description: "Esta página não possui texto extraído",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech-audiobook`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            text: pageText,
            voiceId: selectedVoice,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Falha ao gerar áudio");
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      
      // Cleanup previous URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      setAudioUrl(url);
      
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.playbackRate = playbackRate;
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error: any) {
      console.error("Error generating audio:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao gerar áudio",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Play/Pause toggle
  const togglePlayPause = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!audioUrl) {
        await generateAudio();
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // Navigate pages
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setAudioUrl(null);
      setProgress(0);
      onPageChange(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setAudioUrl(null);
      setProgress(0);
      onPageChange(currentPage + 1);
    }
  };

  // Handle audio end - auto next page
  const handleAudioEnd = () => {
    setIsPlaying(false);
    if (currentPage < totalPages) {
      goToNextPage();
      // Auto-play next page
      setTimeout(() => generateAudio(), 500);
    }
  };

  // Volume control
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume || 1;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  // Playback rate
  const handlePlaybackRateChange = (rate: string) => {
    const newRate = parseFloat(rate);
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  };

  // Sleep timer
  const handleSleepTimerChange = (value: string) => {
    const minutes = parseInt(value);
    setSleepTimer(minutes);
    setSleepTimeRemaining(minutes * 60);
    
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
    }

    if (minutes > 0) {
      sleepTimerRef.current = setInterval(() => {
        setSleepTimeRemaining((prev) => {
          if (prev <= 1) {
            if (audioRef.current) {
              audioRef.current.pause();
              setIsPlaying(false);
            }
            setSleepTimer(0);
            if (sleepTimerRef.current) {
              clearInterval(sleepTimerRef.current);
            }
            toast({
              title: "Timer de sono",
              description: "Reprodução pausada",
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress(audio.currentTime);
      setDuration(audio.duration || 0);
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", updateProgress);
    audio.addEventListener("ended", handleAudioEnd);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", updateProgress);
      audio.removeEventListener("ended", handleAudioEnd);
    };
  }, [currentPage, totalPages]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
      }
    };
  }, [audioUrl]);

  // Regenerate when voice changes
  useEffect(() => {
    if (audioUrl) {
      setAudioUrl(null);
      setProgress(0);
      setIsPlaying(false);
    }
  }, [selectedVoice]);

  if (!extractedText) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <p className="text-muted-foreground">
            Este livro não possui texto extraído para audiobook
          </p>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
      <audio ref={audioRef} />
      
      {/* Collapse/Expand button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -top-8 left-1/2 -translate-x-1/2 bg-background border border-b-0 rounded-t-lg px-4 py-1"
      >
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>

      <div className={`max-w-4xl mx-auto p-4 ${isExpanded ? "" : "py-2"}`}>
        {/* Minimal view */}
        {!isExpanded && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlayPause}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
              <span className="text-sm truncate max-w-[200px]">{bookTitle}</span>
              <PremiumBadge />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Página {currentPage}/{totalPages}
              </span>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Full view */}
        {isExpanded && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate max-w-[300px]">{bookTitle}</h3>
                <PremiumBadge />
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <Slider
                value={[progress]}
                max={duration || 100}
                step={1}
                onValueChange={(value) => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = value[0];
                    setProgress(value[0]);
                  }
                }}
                className="cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{formatTime(progress)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Main controls */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPreviousPage}
                disabled={currentPage <= 1 || isLoading}
              >
                <SkipBack className="h-5 w-5" />
              </Button>

              <Button
                variant="default"
                size="lg"
                className="rounded-full w-14 h-14"
                onClick={togglePlayPause}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6 ml-1" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextPage}
                disabled={currentPage >= totalPages || isLoading}
              >
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>

            {/* Page indicator */}
            <div className="text-center text-sm text-muted-foreground mb-4">
              Página {currentPage} de {totalPages}
            </div>

            {/* Secondary controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Volume */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={toggleMute}>
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                  className="w-24"
                />
              </div>

              {/* Voice selector */}
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Voz" />
                </SelectTrigger>
                <SelectContent>
                  {VOICES.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Playback speed */}
              <Select value={playbackRate.toString()} onValueChange={handlePlaybackRateChange}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Velocidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5x</SelectItem>
                  <SelectItem value="0.75">0.75x</SelectItem>
                  <SelectItem value="1">1x</SelectItem>
                  <SelectItem value="1.25">1.25x</SelectItem>
                  <SelectItem value="1.5">1.5x</SelectItem>
                  <SelectItem value="2">2x</SelectItem>
                </SelectContent>
              </Select>

              {/* Sleep timer */}
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <Select value={sleepTimer.toString()} onValueChange={handleSleepTimerChange}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Timer" />
                  </SelectTrigger>
                  <SelectContent>
                    {SLEEP_TIMER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sleepTimeRemaining > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {formatTime(sleepTimeRemaining)}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
