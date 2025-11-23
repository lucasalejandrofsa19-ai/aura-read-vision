import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { captureError } from '@/lib/sentry';

export const useReadingSession = (bookId: string) => {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startPage, setStartPage] = useState<number>(1);
  const sessionStartTime = useRef<Date | null>(null);

  // Start a new reading session
  const startSession = async (currentPage: number) => {
    if (!user || !bookId) return;

    try {
      const { data, error } = await supabase
        .from('reading_sessions')
        .insert({
          user_id: user.id,
          book_id: bookId,
          start_page: currentPage,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      setSessionId(data.id);
      setStartPage(currentPage);
      sessionStartTime.current = new Date();
    } catch (error) {
      captureError(error, { context: 'start_reading_session' });
    }
  };

  // End the current reading session
  const endSession = async (currentPage: number) => {
    if (!sessionId || !sessionStartTime.current) return;

    try {
      const endTime = new Date();
      const durationMinutes = Math.round(
        (endTime.getTime() - sessionStartTime.current.getTime()) / 60000
      );

      const pagesRead = Math.max(0, currentPage - startPage);

      const { error } = await supabase
        .from('reading_sessions')
        .update({
          ended_at: endTime.toISOString(),
          end_page: currentPage,
          pages_read: pagesRead,
          duration_minutes: durationMinutes,
        })
        .eq('id', sessionId);

      if (error) throw error;

      setSessionId(null);
      sessionStartTime.current = null;
    } catch (error) {
      captureError(error, { context: 'end_reading_session' });
    }
  };

  // Update session with current page (for tracking progress during session)
  const updateSession = async (currentPage: number) => {
    if (!sessionId) return;

    try {
      const pagesRead = Math.max(0, currentPage - startPage);

      const { error } = await supabase
        .from('reading_sessions')
        .update({
          end_page: currentPage,
          pages_read: pagesRead,
        })
        .eq('id', sessionId);

      if (error) throw error;
    } catch (error) {
      captureError(error, { context: 'update_reading_session' });
    }
  };

  // Auto-end session when component unmounts or user leaves
  useEffect(() => {
    return () => {
      if (sessionId) {
        // We can't use async in cleanup, so we fire and forget
        supabase
          .from('reading_sessions')
          .update({
            ended_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
      }
    };
  }, [sessionId]);

  return {
    startSession,
    endSession,
    updateSession,
    isSessionActive: !!sessionId,
  };
};
