import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

export const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [rate, setRate] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Check if speech synthesis is supported
    if (!('speechSynthesis' in window)) {
      toast.error("Seu navegador não suporta síntese de voz");
      return;
    }

    // Load available voices
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      
      // Try to select a Portuguese voice by default
      const ptVoice = availableVoices.find(v => v.lang.startsWith('pt')) || availableVoices[0];
      setSelectedVoice(ptVoice);
    };

    loadVoices();
    
    // Chrome loads voices asynchronously
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = (text: string) => {
    if (!text.trim()) {
      toast.error("Nenhum texto para ler");
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Split text into smaller chunks (max 200 characters per chunk)
    const maxLength = 200;
    const chunks: string[] = [];
    let currentChunk = '';
    
    // Split by sentences to maintain natural breaks
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxLength) {
        currentChunk += sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = sentence;
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    let currentIndex = 0;

    const speakChunk = () => {
      if (currentIndex >= chunks.length) {
        setIsSpeaking(false);
        setIsPaused(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[currentIndex]);
      utteranceRef.current = utterance;

      // Configure utterance
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.lang = 'pt-BR';

      // Event listeners
      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };

      utterance.onend = () => {
        currentIndex++;
        // Small delay between chunks for better flow
        setTimeout(() => speakChunk(), 100);
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setIsSpeaking(false);
        setIsPaused(false);
        toast.error("Erro ao reproduzir áudio");
      };

      // Start speaking this chunk
      window.speechSynthesis.speak(utterance);
    };

    // Start speaking first chunk
    speakChunk();
  };

  const pause = () => {
    if (isSpeaking && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const resume = () => {
    if (isSpeaking && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  const togglePause = () => {
    if (isPaused) {
      resume();
    } else {
      pause();
    }
  };

  return {
    speak,
    stop,
    pause,
    resume,
    togglePause,
    isSpeaking,
    isPaused,
    voices,
    selectedVoice,
    setSelectedVoice,
    rate,
    setRate,
    pitch,
    setPitch,
  };
};