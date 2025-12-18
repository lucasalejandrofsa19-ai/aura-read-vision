import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  Moon,
  X,
  Loader2,
  Headphones
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAudiobook } from '@/hooks/useAudiobook';
import { PremiumBadge } from '@/components/PremiumBadge';

interface AudiobookPlayerProps {
  bookId: string;
  pdfUrl?: string;
  extractedText?: string | null;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  bookTitle: string;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const AudiobookPlayer: React.FC<AudiobookPlayerProps> = ({
  bookId,
  pdfUrl,
  extractedText,
  totalPages,
  currentPage,
  onPageChange,
  bookTitle,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const {
    isPlaying,
    isLoading,
    playbackRate,
    progress,
    duration,
    sleepTimer,
    sleepTimerRemaining,
    currentAudioPage,
    savedProgress,
    togglePlayPause,
    stop,
    seekTo,
    changePlaybackRate,
    skipForward,
    skipBackward,
    startSleepTimer,
    cancelSleepTimer,
    playPage,
  } = useAudiobook({
    bookId,
    pdfUrl,
    extractedText,
    totalPages,
    currentPage,
    onPageChange,
  });

  const timerOptions = [
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '45 min', value: 45 },
    { label: '1 hora', value: 60 },
    { label: '2 horas', value: 120 },
  ];

  const speedOptions = [
    { label: '0.5x', value: 0.5 },
    { label: '0.75x', value: 0.75 },
    { label: '1x', value: 1 },
    { label: '1.25x', value: 1.25 },
    { label: '1.5x', value: 1.5 },
    { label: '2x', value: 2 },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Headphones className="h-5 w-5" />
          <PremiumBadge className="absolute -top-1 -right-1 scale-75" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-auto max-h-[80vh]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5" />
            Audiobook
            <PremiumBadge />
          </SheetTitle>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Resume from saved progress */}
          {savedProgress && !isPlaying && currentAudioPage !== savedProgress.page && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onPageChange(savedProgress.page);
                playPage(savedProgress.page);
              }}
            >
              Continuar da página {savedProgress.page}
            </Button>
          )}

          {/* Book Info */}
          <div className="text-center">
            <h3 className="font-medium text-lg truncate">{bookTitle}</h3>
            <p className="text-sm text-muted-foreground">
              Página {currentAudioPage} de {totalPages}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Slider
              value={[progress]}
              max={duration || 100}
              step={1}
              onValueChange={(value) => seekTo(value[0])}
              className="w-full"
              disabled={!duration}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Main Controls */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={skipBackward}
              disabled={currentAudioPage <= 1 || isLoading}
            >
              <SkipBack className="h-6 w-6" />
            </Button>

            <Button
              size="lg"
              className="h-14 w-14 rounded-full"
              onClick={togglePlayPause}
              disabled={isLoading || (!extractedText && !pdfUrl)}
            >
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6 ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={skipForward}
              disabled={currentAudioPage >= totalPages || isLoading}
            >
              <SkipForward className="h-6 w-6" />
            </Button>
          </div>

          {/* Secondary Controls */}
          <div className="flex items-center justify-between gap-4">
            {/* Speed Control */}
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <Select
                value={playbackRate.toString()}
                onValueChange={(value) => changePlaybackRate(parseFloat(value))}
              >
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {speedOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sleep Timer */}
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-muted-foreground" />
              {sleepTimer ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {sleepTimerRemaining && formatTime(sleepTimerRemaining)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={cancelSleepTimer}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Select onValueChange={(value) => startSleepTimer(parseInt(value))}>
                  <SelectTrigger className="w-24 h-8">
                    <SelectValue placeholder="Timer" />
                  </SelectTrigger>
                  <SelectContent>
                    {timerOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Stop Button */}
          {isPlaying && (
            <Button
              variant="outline"
              className="w-full"
              onClick={stop}
            >
              Parar Audiobook
            </Button>
          )}

          {/* No text warning */}
          {!extractedText && !pdfUrl && (
            <p className="text-center text-sm text-muted-foreground">
              Este livro não possui texto extraído para reprodução em áudio.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
