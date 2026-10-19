import React from 'react';
import { WifiOff, RefreshCw, X } from 'lucide-react';
import { getTranslation, Language } from '../utils/i18n';
import { triggerHaptic } from '../utils/telegram';

interface OfflineOverlayProps {
  isOffline: boolean;
  lang: Language;
  onRetry: () => void | Promise<void>;
  isReconnecting?: boolean;
  onContinueOffline?: () => void;
}

export const OfflineOverlay: React.FC<OfflineOverlayProps> = ({
  isOffline,
  lang,
  onRetry,
  isReconnecting = false,
  onContinueOffline,
}) => {
  if (!isOffline) return null;

  const t = getTranslation(lang);

  const handleRetry = () => {
    if (isReconnecting) return;
    triggerHaptic('medium');
    onRetry();
  };

  const handleContinue = () => {
    triggerHaptic('light');
    if (onContinueOffline) {
      onContinueOffline();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-sm bg-[#120a2e] border-2 border-[#ff0054] rounded-xl p-6 shadow-[0_0_35px_rgba(255,0,84,0.4)] flex flex-col items-center text-center text-white">
        {onContinueOffline && (
          <button
            onClick={handleContinue}
            className="absolute top-3 right-3 text-gray-400 hover:text-white p-1 rounded-lg"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Pulsing Glitch / Warning Icon */}
        <div className="w-16 h-16 rounded-full bg-[#ff0054]/20 border border-[#ff0054] flex items-center justify-center mb-4 animate-pulse">
          <WifiOff className="w-8 h-8 text-[#ff0054]" />
        </div>

        <h2 className="font-pixel text-sm text-[#ff0054] uppercase tracking-wider mb-2">
          {t.offlineTitle || 'SIGNAL LOST'}
        </h2>

        <p className="text-xs text-gray-300 leading-relaxed mb-6 font-mono-tech">
          {t.offlineDesc || 'Cosmic link with Starfleet Command severed. Check your network connection to transmit telemetry.'}
        </p>

        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={handleRetry}
            disabled={isReconnecting}
            className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-[#ff0054] to-[#ff5400] text-white font-pixel text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(255,0,84,0.5)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isReconnecting ? 'animate-spin' : ''}`} />
            <span>{isReconnecting ? (t.offlineReconnecting || 'CONNECTING...') : (t.offlineRetry || 'RECONNECT')}</span>
          </button>

          {onContinueOffline && (
            <button
              onClick={handleContinue}
              className="w-full py-2.5 px-4 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-gray-300 font-pixel text-[11px] uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
            >
              {t.offlineContinue || 'CONTINUE OFFLINE'}
            </button>
          )}
        </div>

        <div className="mt-4 text-[10px] text-gray-500 font-pixel">
          NEON ORBIT SAFE SYNC ACTIVE
        </div>
      </div>
    </div>
  );
};
