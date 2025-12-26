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
  Headphones,
  Settings2,
  Sparkles,
  Wand2
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
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
import { useAudiobook, TTSProvider } from '@/hooks/useAudiobook';
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
    isProcessing,
    processingProgress,
    playbackRate,
    progress,
    duration,
    sleepTimer,
    sleepTimerRemaining,
    currentAudioPage,
    savedProgress,
    hasFullText,
    totalChunks,
    currentChunk,
    ttsProvider,
    enhanceNarration,
    isEnhancing,
    browserVoices,
    selectedVoiceIndex,
    voicePitch,
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
    setEnhanceNarration,
    setSelectedVoiceIndex,
    setVoicePitch,
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

  const providerOptions: { label: string; value: TTSProvider }[] = [
    { label: 'ElevenLabs', value: 'elevenlabs' },
    { label: 'OpenAI', value: 'openai' },
    { label: 'Navegador (grátis)', value: 'browser' },
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
          {/* Processing Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Processando audiobook...</span>
                <span className="font-medium">{processingProgress}%</span>
              </div>
              <Progress value={processingProgress} className="h-2" />
            </div>
          )}

          {/* Resume from saved progress */}
          {savedProgress && !isPlaying && !isProcessing && currentAudioPage !== savedProgress.page && (
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
              {totalChunks > 0 && (
                <span className="ml-2">• Parte {currentChunk}/{totalChunks}</span>
              )}
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
              disabled={!duration || isProcessing}
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
              disabled={currentChunk <= 1 || isLoading || isProcessing}
            >
              <SkipBack className="h-6 w-6" />
            </Button>

            <Button
              size="lg"
              className="h-14 w-14 rounded-full"
              onClick={togglePlayPause}
              disabled={isLoading || isProcessing || !hasFullText}
            >
              {isLoading || isProcessing ? (
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
              disabled={currentChunk >= totalChunks || isLoading || isProcessing}
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

          {/* TTS Provider Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Provedor de voz</span>
              </div>
              <Select
                value={ttsProvider}
                onValueChange={(value) => changeTtsProvider(value as TTSProvider)}
                disabled={isPlaying || isProcessing}
              >
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Free browser TTS indicator */}
            {ttsProvider === 'browser' && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                <Sparkles className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400">
                  Modo gratuito — não consome créditos de API
                </span>
              </div>
            )}
            
            {/* Browser Voice Settings */}
            {ttsProvider === 'browser' && browserVoices.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Voz</span>
                  <Select
                    value={selectedVoiceIndex.toString()}
                    onValueChange={(value) => setSelectedVoiceIndex(parseInt(value))}
                    disabled={isPlaying}
                  >
                    <SelectTrigger className="w-48 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {browserVoices.map((voice, index) => (
                        <SelectItem key={index} value={index.toString()}>
                          {voice.name.length > 25 
                            ? voice.name.slice(0, 25) + '...' 
                            : voice.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Tom</span>
                  <div className="flex items-center gap-2 w-48">
                    <span className="text-xs text-muted-foreground">Grave</span>
                    <Slider
                      value={[voicePitch]}
                      onValueChange={([value]) => setVoicePitch(value)}
                      min={0.5}
                      max={1.5}
                      step={0.1}
                      disabled={isPlaying}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground">Agudo</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Enhanced Narration Toggle */}
          <div className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-purple-500" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Narração aprimorada por IA</span>
                <span className="text-xs text-muted-foreground">
                  Reescreve o texto para soar mais fluido
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEnhancing && (
                <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
              )}
              <Switch
                checked={enhanceNarration}
                onCheckedChange={setEnhanceNarration}
                disabled={isPlaying || isProcessing}
              />
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
          {!hasFullText && !extractedText && !pdfUrl && (
            <p className="text-center text-sm text-muted-foreground">
              Este livro não possui texto extraído para reprodução em áudio.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
