import { RoundStats } from '../types/game';
import { api } from './api';

const PENDING_ROUNDS_KEY = 'neon_orbit_pending_rounds';
const SUBMITTED_IDS_KEY = 'neon_orbit_submitted_ids';

export const savePendingRound = (stats: RoundStats): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(PENDING_ROUNDS_KEY);
    const queue: RoundStats[] = raw ? JSON.parse(raw) : [];
    
    // Prevent duplicate entries
    if (!queue.some((r) => r.roundId === stats.roundId)) {
      queue.push(stats);
      localStorage.setItem(PENDING_ROUNDS_KEY, JSON.stringify(queue));
    }
  } catch (err) {
    console.error('Failed to save pending round log:', err);
  }
};

export const markRoundSubmitted = (roundId: string): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    const rawSubmitted = localStorage.getItem(SUBMITTED_IDS_KEY);
    const submittedSet: string[] = rawSubmitted ? JSON.parse(rawSubmitted) : [];
    if (!submittedSet.includes(roundId)) {
      submittedSet.push(roundId);
      // Keep set bounded to last 50
      if (submittedSet.length > 50) submittedSet.shift();
      localStorage.setItem(SUBMITTED_IDS_KEY, JSON.stringify(submittedSet));
    }

    // Remove from pending ONLY when confirmed
    const rawPending = localStorage.getItem(PENDING_ROUNDS_KEY);
    if (rawPending) {
      const queue: RoundStats[] = JSON.parse(rawPending);
      const filtered = queue.filter((r) => r.roundId !== roundId);
      localStorage.setItem(PENDING_ROUNDS_KEY, JSON.stringify(filtered));
    }
  } catch (err) {
    console.error('Failed to mark round submitted:', err);
  }
};

export const isRoundSubmitted = (roundId: string): boolean => {
  if (typeof localStorage === 'undefined') return false;
  try {
    const rawSubmitted = localStorage.getItem(SUBMITTED_IDS_KEY);
    const submittedSet: string[] = rawSubmitted ? JSON.parse(rawSubmitted) : [];
    return submittedSet.includes(roundId);
  } catch {
    return false;
  }
};

/**
 * Submit round to backend with automatic retry policy and network failure fallback.
 * Only removes round from pending queue when server responds with success confirmation.
 */
export const submitRoundLogWithRetry = async (
  stats: RoundStats,
  chatId?: string
): Promise<{ success: boolean; confirmedScore?: number }> => {
  if (isRoundSubmitted(stats.roundId)) {
    return { success: true, confirmedScore: stats.score };
  }

  savePendingRound(stats);

  try {
    const data = await api.submitRound({
      roundId: stats.roundId,
      clickLogs: stats.clickLogs || [],
      chatId,
    });

    if (data && data.success) {
      // ONLY mark as submitted and remove from pending queue once server acknowledges confirmation
      markRoundSubmitted(stats.roundId);
      return { success: true, confirmedScore: data.confirmedScore ?? stats.score };
    }
  } catch (err) {
    console.warn('Network offline or round submission deferred to pending queue:', err);
  }

  return { success: false, confirmedScore: stats.score };
};

/**
 * Flush any queued offline rounds when network restores
 */
export const flushPendingRoundsQueue = async (chatId?: string): Promise<void> => {
  if (typeof localStorage === 'undefined') return;
  try {
    const rawPending = localStorage.getItem(PENDING_ROUNDS_KEY);
    if (!rawPending) return;

    const queue: RoundStats[] = JSON.parse(rawPending);
    if (queue.length === 0) return;

    for (const stats of queue) {
      await submitRoundLogWithRetry(stats, chatId);
    }
  } catch (err) {
    console.error('Error flushing pending round queue:', err);
  }
};

// Global network online event listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushPendingRoundsQueue();
  });
}
