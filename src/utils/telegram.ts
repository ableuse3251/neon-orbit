export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: TelegramUser;
    receiver?: TelegramUser;
    start_param?: string;
    auth_date?: number;
    hash?: string;
  };
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive: boolean) => void;
    hideProgress: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    setText: (text: string) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void) => void;
  shareToStory?: (mediaUrl: string, params?: { text?: string; widget_link?: { url: string; name: string } }) => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  enableClosingConfirmation?: () => void;
  disableVerticalSwipes?: () => void;
  isVerticalSwipesEnabled?: boolean;
  onEvent?: (eventType: string, eventHandler: () => void) => void;
  offEvent?: (eventType: string, eventHandler: () => void) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export const getTelegramApp = (): TelegramWebApp | null => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
};

export function getRawTelegramInitData(): string {
  if (typeof window === 'undefined') return '';
  const app = getTelegramApp();
  if (app?.initData) return app.initData;

  try {
    const hash = window.location.hash || window.location.search || '';
    if (hash.includes('tgWebAppData=')) {
      const match = hash.match(/tgWebAppData=([^&]+)/);
      if (match) {
        return decodeURIComponent(match[1]);
      }
    } else if (hash.includes('user=') && hash.includes('hash=')) {
      return hash.replace(/^[#?]/, '');
    }
  } catch {
    // ignore
  }

  return '';
}

export async function getTelegramInitDataAsync(timeoutMs = 1500): Promise<string> {
  const existing = getRawTelegramInitData();
  if (existing) return existing;

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const initData = getRawTelegramInitData();
    if (initData) return initData;
  }

  return getRawTelegramInitData();
}

export const initTelegramSDK = (): { user: TelegramUser; startParam?: string; isTelegram: boolean } => {
  const app = getTelegramApp();
  if (app) {
    try {
      app.ready();
      app.expand();
      app.setHeaderColor?.('#0b071e');
      app.setBackgroundColor?.('#0b071e');
      app.enableClosingConfirmation?.();

      // Prevent accidental pull-to-close swipe during intense gameplay
      const anyApp = app as any;
      if (typeof anyApp.disableVerticalSwipes === 'function') {
        anyApp.disableVerticalSwipes();
      } else if ('isVerticalSwipesEnabled' in anyApp) {
        anyApp.isVerticalSwipesEnabled = false;
      }
    } catch {
      // Gracefully continue if running in older Telegram client
    }

    // Ensure app height css variable matches Telegram viewport precisely
    const updateViewportHeight = () => {
      const height = window.innerHeight || (app.viewportHeight ? app.viewportHeight : 0);
      const vh = height ? `${height}px` : '100dvh';
      document.documentElement.style.setProperty('--app-height', vh);
    };
    updateViewportHeight();
    setTimeout(updateViewportHeight, 200);
    setTimeout(updateViewportHeight, 500);
    window.addEventListener('resize', updateViewportHeight);
    try {
      app.onEvent?.('viewportChanged', updateViewportHeight);
    } catch {
      // ignore
    }

    const user = app.initDataUnsafe.user || {
      id: 999123456,
      first_name: 'Pilot',
      username: 'cosmic_pilot',
      language_code: typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en',
    };

    return {
      user,
      startParam: app.initDataUnsafe.start_param,
      isTelegram: true,
    };
  }

  // Fallback for browser preview testing: calculate viewport height
  if (typeof window !== 'undefined') {
    const updateVh = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };
    updateVh();
    window.addEventListener('resize', updateVh);
  }

  // Fallback for browser preview testing
  return {
    user: {
      id: 888777666,
      first_name: 'RetroPilot',
      username: 'synthwave_star',
      language_code: typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en',
    },
    isTelegram: false,
  };
};

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' | 'impact';

export const triggerHaptic = (
  type: HapticType,
  impactStyle: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'heavy'
) => {
  const app = getTelegramApp();
  if (app?.HapticFeedback) {
    if (type === 'success' || type === 'warning' || type === 'error') {
      app.HapticFeedback.notificationOccurred(type);
    } else if (type === 'selection') {
      app.HapticFeedback.selectionChanged();
    } else if (type === 'impact') {
      app.HapticFeedback.impactOccurred(impactStyle);
    } else {
      app.HapticFeedback.impactOccurred(type);
    }
    return;
  }

  // Fallback for standard mobile browsers outside Telegram
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      if (type === 'impact' || type === 'heavy') {
        navigator.vibrate([40, 30, 40]);
      } else if (type === 'medium') {
        navigator.vibrate(25);
      } else if (type === 'light' || type === 'selection') {
        navigator.vibrate(12);
      } else if (type === 'error') {
        navigator.vibrate([30, 50, 30]);
      } else if (type === 'success') {
        navigator.vibrate([20, 30, 20]);
      }
    } catch {
      // ignore
    }
  }
};

export const shareChallengeLink = (botUsername: string, challengeId: string, score: number) => {
  const app = getTelegramApp();
  const link = `https://t.me/${botUsername}?startapp=challenge_${challengeId}`;
  const text = `🛸 I hit ${score} points in Neon Orbit! Can you beat my record in this 45-sec retro cosmic space tap? 🚀`;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;

  if (app?.openTelegramLink) {
    app.openTelegramLink(shareUrl);
  } else {
    window.open(shareUrl, '_blank');
  }
};
