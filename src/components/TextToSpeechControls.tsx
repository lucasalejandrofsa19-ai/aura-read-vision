import { Volume2, VolumeX, Pause, Play, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TextToSpeechControlsProps {
  isSpeaking: boolean;
  isPaused: boolean;
  onSpeak: () => void;
  onStop: () => void;
  onTogglePause: () => void;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  onVoiceChange: (voice: SpeechSynthesisVoice) => void;
  rate: number;
  onRateChange: (rate: number) => void;
  pitch: number;
  onPitchChange: (pitch: number) => void;
}

export const TextToSpeechControls = ({
  isSpeaking,
  isPaused,
  onSpeak,
  onStop,
  onTogglePause,
  voices,
  selectedVoice,
  onVoiceChange,
  rate,
  onRateChange,
  pitch,
  onPitchChange,
}: TextToSpeechControlsProps) => {
  const portugueseVoices = voices.filter(v => v.lang.startsWith('pt'));
  const availableVoices = portugueseVoices.length > 0 ? portugueseVoices : voices;

  return (
    <div className="flex items-center gap-2">
      {!isSpeaking ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onSpeak}
          className="aura-soft transition-aura"
          title="Ler em voz alta (Ctrl+Shift+R)"
        >
          <Volume2 className="w-5 h-5" />
        </Button>
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={onTogglePause}
            className="aura-soft transition-aura"
            title={isPaused ? "Continuar" : "Pausar"}
          >
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onStop}
            className="aura-soft transition-aura"
            title="Parar"
          >
            <VolumeX className="w-5 h-5" />
          </Button>
        </>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="aura-soft transition-aura"
            title="Configurações de voz"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 glass" align="end">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Voz</Label>
              <Select
                value={selectedVoice?.name || ""}
                onValueChange={(name) => {
                  const voice = voices.find(v => v.name === name);
                  if (voice) onVoiceChange(voice);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma voz" />
                </SelectTrigger>
                <SelectContent>
                  {availableVoices.map((voice) => (
                    <SelectItem key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Velocidade</Label>
                <span className="text-xs text-muted-foreground">{rate.toFixed(1)}x</span>
              </div>
              <Slider
                value={[rate]}
                onValueChange={([value]) => onRateChange(value)}
                min={0.5}
                max={2}
                step={0.1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Tom</Label>
                <span className="text-xs text-muted-foreground">{pitch.toFixed(1)}</span>
              </div>
              <Slider
                value={[pitch]}
                onValueChange={([value]) => onPitchChange(value)}
                min={0.5}
                max={2}
                step={0.1}
                className="w-full"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};