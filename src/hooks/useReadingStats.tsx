import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { captureError } from '@/lib/sentry';

interface ReadingStats {
  totalPagesRead: number;
  totalBooksRead: number;
  completedBooks: number;
  averageReadingTime: number;
  totalReadingTime: number;
  currentStreak: number;
  longestStreak: number;
  booksInProgress: number;
}

export const useReadingStats = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<ReadingStats>({
    totalPagesRead: 0,
    totalBooksRead: 0,
    completedBooks: 0,
    averageReadingTime: 0,
    totalReadingTime: 0,
    currentStreak: 0,
    longestStreak: 0,
    booksInProgress: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get reading sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('reading_sessions')
        .select('*')
        .eq('user_id', user.id);

      if (sessionsError) throw sessionsError;

      // Get books
      const { data: books, error: booksError } = await supabase
        .from('books')
        .select('progress, total_pages')
        .eq('user_id', user.id);

      if (booksError) throw booksError;

      // Calculate stats
      const totalPagesRead = sessions?.reduce((sum, s) => sum + (s.pages_read || 0), 0) || 0;
      const totalReadingTime = sessions?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0;
      const sessionsWithTime = sessions?.filter(s => s.duration_minutes && s.duration_minutes > 0) || [];
      const averageReadingTime = sessionsWithTime.length > 0
        ? Math.round(totalReadingTime / sessionsWithTime.length)
        : 0;

      const completedBooks = books?.filter(b => b.progress >= 100).length || 0;
      const booksInProgress = books?.filter(b => b.progress > 0 && b.progress < 100).length || 0;

      // Calculate reading streak
      const { currentStreak, longestStreak } = calculateStreaks(sessions || []);

      setStats({
        totalPagesRead,
        totalBooksRead: books?.length || 0,
        completedBooks,
        averageReadingTime,
        totalReadingTime,
        currentStreak,
        longestStreak,
        booksInProgress,
      });
    } catch (error) {
      captureError(error, { context: 'load_reading_stats' });
    } finally {
      setLoading(false);
    }
  };

  const calculateStreaks = (sessions: any[]) => {
    if (!sessions || sessions.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    // Group sessions by date
    const sessionsByDate = new Map<string, boolean>();
    sessions.forEach(session => {
      if (session.started_at) {
        const date = new Date(session.started_at).toDateString();
        sessionsByDate.set(date, true);
      }
    });

    // Sort dates
    const dates = Array.from(sessionsByDate.keys()).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    let checkDate = today;

    for (let i = 0; i < dates.length; i++) {
      const sessionDate = new Date(dates[i]);
      const daysDiff = Math.floor(
        (checkDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff <= 1) {
        currentStreak++;
        checkDate = sessionDate;
      } else {
        break;
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 1;

    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      const daysDiff = Math.floor(
        (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 1) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
    }

    longestStreak = Math.max(longestStreak, 1);

    return { currentStreak, longestStreak };
  };

  return {
    stats,
    loading,
    refreshStats: loadStats,
  };
};
