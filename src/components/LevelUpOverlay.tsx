import React, { useEffect } from 'react';
import { Award, Zap } from 'lucide-react';
import { triggerHaptic } from '../utils/telegram';
import { audioManager } from '../utils/audio';

interface LevelUpOverlayProps {
  newLevel: number;
  lang?: 'en' | 'ru';
  onDismiss: () => void;
}

export const LevelUpOverlay: React.FC<LevelUpOverlayProps> = ({
  newLevel,
  lang = 'en',
  onDismiss,
}) => {
  useEffect(() => {
    triggerHaptic('success');
    audioManager.playBeacon();

    const timer = setTimeout(() => {
      onDismiss();
    }, 1500);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      onClick={onDismiss}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg cursor-pointer animate-fade-in select-none font-mono-tech"
    >
      <div className="relative flex flex-col items-center gap-4 text-center p-6 border-2 border-[#00f5d4] bg-[#120a2e]/90 rounded-2xl shadow-[0_0_50px_rgba(0,245,212,0.6)] animate-bounce">
        {/* Glow Icon */}
        <div className="w-20 h-20 rounded-full bg-[#00f5d4]/20 border-2 border-[#00f5d4] flex items-center justify-center shadow-[0_0_30px_#00f5d4] animate-pulse">
          <Award className="w-12 h-12 text-[#00f5d4]" />
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-pixel text-xs text-[#ff007f] tracking-widest uppercase">
            {lang === 'ru' ? 'ПОВЫШЕНИЕ УРОВНЯ!' : 'LEVEL UP!'}
          </span>
          <h2 className="font-pixel text-4xl text-white text-glow-cyan font-bold">
            LEVEL {newLevel}
          </h2>
        </div>

        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#210b42] border border-[#ffb703]/50 text-[#ffb703] font-pixel text-xs">
          <Zap className="w-4 h-4 fill-current" />
          <span>{lang === 'ru' ? '+100 Звёздной Пыли!' : '+100 Stardust Bonus!'}</span>
        </div>
      </div>
    </div>
  );
};
