import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { captureError } from "@/lib/sentry";

export type SoundType = 'page-turn' | 'highlight' | 'note' | 'bookmark' | 'delete';

interface SoundSettings {
  pageTurnSoundEnabled: boolean;
  highlightSoundEnabled: boolean;
  noteSoundEnabled: boolean;
  bookmarkSoundEnabled: boolean;
  deleteSoundEnabled: boolean;
}

const soundFiles: Record<SoundType, string> = {
  'page-turn': '/sounds/page-turn.mp3',
  'highlight': '/sounds/highlight.mp3',
  'note': '/sounds/note.mp3',
  'bookmark': '/sounds/bookmark.mp3',
  'delete': '/sounds/delete.mp3',
};

export const useSoundEffects = () => {
  const { user } = useAuth();
  const [soundSettings, setSoundSettings] = useState<SoundSettings>({
    pageTurnSoundEnabled: true,
    highlightSoundEnabled: true,
    noteSoundEnabled: true,
    bookmarkSoundEnabled: true,
    deleteSoundEnabled: true,
  });

  useEffect(() => {
    loadSoundSettings();
  }, [user]);

  const loadSoundSettings = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("page_turn_sound_enabled, highlight_sound_enabled, note_sound_enabled, bookmark_sound_enabled, delete_sound_enabled")
        .eq("id", user.id)
        .single();
      
      if (error) throw error;
      
      setSoundSettings({
        pageTurnSoundEnabled: data?.page_turn_sound_enabled ?? true,
        highlightSoundEnabled: data?.highlight_sound_enabled ?? true,
        noteSoundEnabled: data?.note_sound_enabled ?? true,
        bookmarkSoundEnabled: data?.bookmark_sound_enabled ?? true,
        deleteSoundEnabled: data?.delete_sound_enabled ?? true,
      });
    } catch (error) {
      captureError(error, { context: "load_sound_settings" });
    }
  };

  const playSound = (soundType: SoundType, volume: number = 0.3) => {
    const settingsMap: Record<SoundType, keyof SoundSettings> = {
      'page-turn': 'pageTurnSoundEnabled',
      'highlight': 'highlightSoundEnabled',
      'note': 'noteSoundEnabled',
      'bookmark': 'bookmarkSoundEnabled',
      'delete': 'deleteSoundEnabled',
    };

    const isEnabled = soundSettings[settingsMap[soundType]];
    
    if (!isEnabled) return;

    const audio = new Audio(soundFiles[soundType]);
    audio.volume = volume;
    audio.play().catch(err => console.log('Audio play failed:', err));
  };

  const updateSoundSetting = async (
    setting: keyof SoundSettings,
    enabled: boolean
  ) => {
    if (!user) return;

    const columnMap: Record<keyof SoundSettings, string> = {
      pageTurnSoundEnabled: 'page_turn_sound_enabled',
      highlightSoundEnabled: 'highlight_sound_enabled',
      noteSoundEnabled: 'note_sound_enabled',
      bookmarkSoundEnabled: 'bookmark_sound_enabled',
      deleteSoundEnabled: 'delete_sound_enabled',
    };

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ [columnMap[setting]]: enabled })
        .eq("id", user.id);
      
      if (error) throw error;
      
      setSoundSettings(prev => ({
        ...prev,
        [setting]: enabled,
      }));
    } catch (error) {
      captureError(error, { context: "update_sound_setting" });
      throw error;
    }
  };

  return {
    soundSettings,
    playSound,
    updateSoundSetting,
  };
};
