import { getTelegramApp } from './telegram';

interface AnalyticsEvent {
  name: string;
  props?: Record<string, any>;
  timestamp: number;
}

let eventQueue: AnalyticsEvent[] = [];
let flushTimer: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL_MS = 5000;
const BATCH_ENDPOINT = '/api/analytics/events';

function getUserId(): string {
  try {
    const app = getTelegramApp();
    const user = app?.initDataUnsafe?.user;
    if (user && user.id) {
      return String(user.id);
    }
  } catch {
    // fallback
  }
  let anonId = localStorage.getItem('neon_orbit_anon_id');
  if (!anonId) {
    anonId = 'anon_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('neon_orbit_anon_id', anonId);
  }
  return anonId;
}

export function trackEvent(name: string, props?: Record<string, any>): void {
  // Non-blocking queuing
  setTimeout(() => {
    eventQueue.push({
      name,
      props: props || {},
      timestamp: Date.now(),
    });

    if (eventQueue.length >= 20) {
      flushEvents();
    }
  }, 0);
}

export async function flushEvents(): Promise<void> {
  if (eventQueue.length === 0) return;

  const batch = [...eventQueue];
  eventQueue = [];

  const userId = getUserId();
  const payload = {
    user_id: userId,
    events: batch,
  };

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const success = navigator.sendBeacon(BATCH_ENDPOINT, blob);
      if (!success) {
        // Fallback to fetch if beacon queue is full
        await fetch(BATCH_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        });
      }
    } else {
      await fetch(BATCH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    }
  } catch (err) {
    // If failed, re-enqueue up to 100 events to prevent memory leak
    if (eventQueue.length < 100) {
      eventQueue = [...batch, ...eventQueue];
    }
  }
}

// Start periodic flush timer
if (typeof window !== 'undefined') {
  flushTimer = setInterval(() => {
    flushEvents();
  }, FLUSH_INTERVAL_MS);

  window.addEventListener('beforeunload', () => {
    flushEvents();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushEvents();
    }
  });
}
