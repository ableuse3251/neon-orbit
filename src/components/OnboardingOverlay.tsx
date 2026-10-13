import React, { useState } from 'react';
import { Play, Zap, Target, ShieldAlert, Sparkles, ChevronRight } from 'lucide-react';
import { triggerHaptic } from '../utils/telegram';
import { getTranslation } from '../utils/i18n';

interface OnboardingOverlayProps {
  lang?: 'en' | 'ru';
  onComplete: () => void;
}

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({
  lang = 'en',
  onComplete,
}) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      titleEn: '1. TAP COSMIC TARGETS',
      titleRu: '1. ТАПАЙ ПО ЦЕЛЯМ',
      descEn: 'Hit Asteroids (+100), Swift Comets (+250) and Golden Beacons (+500) during 45s rounds!',
      descRu: 'Поражай Астероиды (+100), Кометы (+250) и Золотые Маяки (+500) за 45 секунд!',
      icon: '🎯',
      color: '#00F5D4',
    },
    {
      titleEn: '2. BUILD HYPERMODE x5',
      titleRu: '2. НАБИРАЙ ГИПЕРРЕЖИМ x5',
      descEn: 'Maintain rapid non-stop hits to super-charge your combo multiplier up to x5!',
      descRu: 'Совершай точные попадания без промахов для активации комбо x5 ГИПЕРРЕЖИМА!',
      icon: '🔥',
      color: '#FFB703',
    },
    {
      titleEn: '3. DODGE RED MINES',
      titleRu: '3. ИЗБЕГАЙ КРАСНЫХ МИН',
      descEn: 'Red Mines reset your combo multiplier to x1 and subtract 200 points!',
      descRu: 'Красные мины сбрасывают множитель комбо и отнимают 200 очков!',
      icon: '💣',
      color: '#FF0054',
    },
  ];

  const handleNext = () => {
    triggerHaptic('medium');
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      onComplete();
    }
  };

  const current = steps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-sm bg-[#120a2e] border-2 border-[#00f5d4] rounded-2xl p-6 shadow-[0_0_40px_rgba(0,245,212,0.4)] flex flex-col items-center text-center gap-5 text-white">
        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-8 bg-[#00f5d4]' : 'w-2 bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Icon Badge */}
        <div
          className="w-20 h-20 rounded-2xl border-2 flex items-center justify-center text-4xl shadow-lg animate-pulse"
          style={{ borderColor: current.color, backgroundColor: `${current.color}15` }}
        >
          {current.icon}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-pixel text-sm text-[#00f5d4] uppercase tracking-wide">
            {lang === 'ru' ? current.titleRu : current.titleEn}
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed max-w-xs font-mono-tech">
            {lang === 'ru' ? current.descRu : current.descEn}
          </p>
        </div>

        <button
          onClick={handleNext}
          className="w-full py-3.5 bg-[#00f5d4] text-[#0b071e] font-pixel text-xs rounded-xl font-bold hover:bg-[#00f5d4]/90 flex items-center justify-center gap-2 shadow-[0_0_15px_#00f5d4]"
        >
          <span>{step === steps.length - 1 ? (lang === 'ru' ? 'ЗАПУСТИТЬ ИГРУ' : 'LAUNCH GAME') : (lang === 'ru' ? 'ДАЛЕЕ' : 'NEXT')}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
