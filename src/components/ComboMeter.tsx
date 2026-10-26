import React, { useState, useEffect, useRef } from 'react';
import { Flame, Zap, Sparkles } from 'lucide-react';
import { animate } from 'animejs';
import { getTranslation, Language } from '../utils/i18n';

export interface ComboMeterProps {
  combo: number;
  multiplier: number;
  lang?: Language;
}

export interface ComboTierConfig {
  tier: number; // 1 to 6
  name: string;
  multiplierText: string;
  badgeBg: string;
  cardBorder: string;
  cardBg: string;
  shadowClass: string;
  pulseClass: string;
  barGradient: string;
  accentColor: string;
  textColor: string;
  textGlowClass: string;
}

export const getComboTierConfig = (multiplier: number, lang: Language = 'en'): ComboTierConfig => {
  const t = getTranslation(lang);

  if (multiplier >= 3.0) {
    return {
      tier: 6,
      name: `${t.tierOmega} 💥`,
      multiplierText: `x${multiplier.toFixed(2)}`,
      badgeBg: 'bg-gradient-to-r from-[#00f5d4] via-[#7000ff] to-[#ff007f] text-black font-black',
      cardBorder: 'border-[#00f5d4]/90 ring-1 ring-[#ff007f]/70',
      cardBg: 'bg-[#0f0728]/95',
      shadowClass: 'shadow-[0_0_35px_rgba(0,245,212,0.8),0_0_60px_rgba(255,0,127,0.5)]',
      pulseClass: 'animate-combo-pulse-max',
      barGradient: 'from-[#00f5d4] via-[#ff007f] to-[#ffb703]',
      accentColor: '#00f5d4',
      textColor: 'text-[#00f5d4]',
      textGlowClass: 'text-glow-cyan',
    };
  }

  if (multiplier >= 2.0) {
    return {
      tier: 5,
      name: `${t.tierUltra} ⚡`,
      multiplierText: `x${multiplier.toFixed(2)}`,
      badgeBg: 'bg-gradient-to-r from-[#ff007f] via-[#7b2cbf] to-[#00f5d4] text-white font-black',
      cardBorder: 'border-[#ff007f]/85 ring-1 ring-[#00f5d4]/50',
      cardBg: 'bg-[#140826]/90',
      shadowClass: 'shadow-[0_0_28px_rgba(255,0,127,0.7),0_0_40px_rgba(0,245,212,0.4)]',
      pulseClass: 'animate-combo-pulse-4',
      barGradient: 'from-[#ff007f] via-[#7b2cbf] to-[#00f5d4]',
      accentColor: '#ff007f',
      textColor: 'text-[#ff007f]',
      textGlowClass: 'text-glow-magenta',
    };
  }

  if (multiplier >= 1.75) {
    return {
      tier: 4,
      name: `${t.tierOverdrive} 🔥`,
      multiplierText: `x${multiplier.toFixed(2)}`,
      badgeBg: 'bg-gradient-to-r from-[#ff5400] to-[#ff0054] text-white font-bold',
      cardBorder: 'border-[#ff5400]/80 ring-1 ring-[#ff0054]/40',
      cardBg: 'bg-[#150a22]/90',
      shadowClass: 'shadow-[0_0_24px_rgba(255,84,0,0.6)]',
      pulseClass: 'animate-combo-pulse-4',
      barGradient: 'from-[#ff5400] via-[#ff0054] to-[#ff007f]',
      accentColor: '#ff5400',
      textColor: 'text-[#ff5400]',
      textGlowClass: 'text-glow-orange',
    };
  }

  if (multiplier >= 1.5) {
    return {
      tier: 3,
      name: `${t.tierHyper} ✨`,
      multiplierText: `x${multiplier.toFixed(2)}`,
      badgeBg: 'bg-gradient-to-r from-[#ff007f] to-[#7b2cbf] text-white font-bold',
      cardBorder: 'border-[#ff007f]/70',
      cardBg: 'bg-[#130724]/90',
      shadowClass: 'shadow-[0_0_20px_rgba(255,0,127,0.5)]',
      pulseClass: 'animate-combo-pulse-3',
      barGradient: 'from-[#ff007f] to-[#7b2cbf]',
      accentColor: '#ff007f',
      textColor: 'text-[#ff007f]',
      textGlowClass: 'text-glow-magenta',
    };
  }

  if (multiplier >= 1.25) {
    return {
      tier: 2,
      name: `${t.tierSurge} ⚡`,
      multiplierText: `x${multiplier.toFixed(2)}`,
      badgeBg: 'bg-gradient-to-r from-[#ffb703] to-[#fb8500] text-black font-bold',
      cardBorder: 'border-[#ffb703]/70',
      cardBg: 'bg-[#120a22]/90',
      shadowClass: 'shadow-[0_0_16px_rgba(255,183,3,0.45)]',
      pulseClass: 'animate-combo-pulse-2',
      barGradient: 'from-[#ffb703] to-[#fb8500]',
      accentColor: '#ffb703',
      textColor: 'text-[#ffb703]',
      textGlowClass: 'text-glow-gold',
    };
  }

  // Tier 1 (multiplier < 1.25, combo 2-4)
  return {
    tier: 1,
    name: `${t.tierStreak}`,
    multiplierText: `x${multiplier.toFixed(2)}`,
    badgeBg: 'bg-gradient-to-r from-[#00f5d4] to-[#00b4d8] text-black font-bold',
    cardBorder: 'border-[#00f5d4]/60',
    cardBg: 'bg-[#0d0722]/85',
    shadowClass: 'shadow-[0_0_12px_rgba(0,245,212,0.35)]',
    pulseClass: 'animate-combo-pulse-1',
    barGradient: 'from-[#00f5d4] to-[#00b4d8]',
    accentColor: '#00f5d4',
    textColor: 'text-[#00f5d4]',
    textGlowClass: 'text-glow-cyan',
  };
};

export const ComboMeter: React.FC<ComboMeterProps> = ({
  combo,
  multiplier,
  lang = 'en',
}) => {
  const t = getTranslation(lang);
  const prevComboRef = useRef(combo);
  const prevTierRef = useRef(1);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const comboNumberRef = useRef<HTMLSpanElement | null>(null);
  const badgeRef = useRef<HTMLDivElement | null>(null);
  const pipsRef = useRef<HTMLDivElement | null>(null);

  // The Combo Meter activates and appears once the player lands consecutive hits (combo >= 2)
  const isVisible = combo >= 2;
  const config = getComboTierConfig(multiplier, lang);

  // Calculate progress toward the next multiplier tier (5 hits per 0.25x increase)
  const hitsInCurrentTier = combo % 5;
  const hitsRemaining = 5 - hitsInCurrentTier;
  const nextMultiplier = (multiplier + 0.25).toFixed(2);
  const isMaxTier = multiplier >= 5.0;

  // Anime.js: Dynamic hit spring feedback on combo increment
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (combo > prevComboRef.current && isVisible) {
      try {
        // Elastic punch on card
        if (cardRef.current) {
          animate(cardRef.current, {
            scale: [1.04, 1],
            duration: 260,
            ease: 'outBack(2)',
          });
        }

        // Kinetic spring bounce on hit number with subtle rotation
        if (comboNumberRef.current) {
          const randomTilt = Math.random() > 0.5 ? 4 : -4;
          animate(comboNumberRef.current, {
            scale: [1.38, 1],
            rotate: [randomTilt, 0],
            duration: 280,
            ease: 'outElastic(1.2, 0.4)',
          });
        }
      } catch {}
    }
    prevComboRef.current = combo;
  }, [combo, isVisible]);

  // Anime.js: Celebratory tier upgrade shockwave when multiplier tier steps up
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentTier = config.tier;
    if (currentTier > prevTierRef.current && isVisible) {
      try {
        if (cardRef.current) {
          animate(cardRef.current, {
            scale: [1.1, 1],
            duration: 450,
            ease: 'outElastic(1.4, 0.35)',
          });
        }
        if (badgeRef.current) {
          animate(badgeRef.current, {
            scale: [1.35, 1],
            duration: 380,
            ease: 'outBack(2.2)',
          });
        }
      } catch {}
    }
    prevTierRef.current = currentTier;
  }, [config.tier, isVisible]);

  // Anime.js: Pip fill bounce when current tier progress advances
  useEffect(() => {
    if (typeof window === 'undefined' || !pipsRef.current) return;
    try {
      const activePips = pipsRef.current.querySelectorAll('.pip-filled');
      if (activePips.length > 0) {
        const latestPip = activePips[activePips.length - 1];
        animate(latestPip, {
          scale: [0.65, 1.15, 1],
          duration: 250,
          ease: 'outBack(2)',
        });
      }
    } catch {}
  }, [hitsInCurrentTier, config.tier]);

  return (
    <div
      className={`w-full max-w-sm sm:max-w-md mx-auto transition-all duration-300 ease-out select-none pointer-events-none ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 -translate-y-2 scale-95 pointer-events-none h-0 max-h-0 overflow-hidden m-0 p-0'
      }`}
    >
      <div
        ref={cardRef}
        className={`relative rounded-xl p-2 sm:p-2.5 backdrop-blur-xl border ${config.cardBorder} ${config.cardBg} ${config.shadowClass} ${config.pulseClass} transition-all duration-500 overflow-hidden`}
      >
        {/* Subtle background ambient ray */}
        <div
          className="absolute -inset-1 opacity-25 blur-lg pointer-events-none transition-all duration-500"
          style={{
            background: `radial-gradient(ellipse at center, ${config.accentColor} 0%, transparent 70%)`,
          }}
        />

        {/* Top Header: Hit Counter · Tier Badge · Multiplier Readout */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          {/* Hits Counter */}
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="p-1 rounded-md bg-[#180e38]/80 border border-[#9d4edd]/30 shrink-0">
              {config.tier >= 5 ? (
                <Sparkles className="w-3.5 h-3.5 text-[#00f5d4] animate-spin" />
              ) : (
                <Flame className="w-3.5 h-3.5 text-[#ff007f] animate-combo-flame" />
              )}
            </div>
            <div className="flex items-baseline gap-1 truncate">
              <span
                ref={comboNumberRef}
                className={`inline-block font-pixel text-sm sm:text-base font-black ${config.textColor} ${config.textGlowClass} tabular-nums`}
              >
                {combo}
              </span>
              <span className="text-[9px] sm:text-[10px] font-pixel text-gray-300 tracking-wider uppercase">
                {t.comboHits}
              </span>
            </div>
          </div>

          {/* Tier Name Pill */}
          <div
            ref={badgeRef}
            className={`px-2 sm:px-2.5 py-0.5 rounded-lg text-[9px] sm:text-[10px] tracking-widest font-pixel uppercase shadow-sm transition-all duration-300 shrink-0 ${config.badgeBg}`}
          >
            {config.name}
          </div>

          {/* Active Multiplier */}
          <div className="flex items-center gap-1 shrink-0">
            <Zap className={`w-3.5 h-3.5 fill-current ${config.textColor}`} />
            <span
              className={`font-pixel text-sm sm:text-base font-black ${config.textColor} ${config.textGlowClass} tabular-nums tracking-wider`}
            >
              {config.multiplierText}
            </span>
          </div>
        </div>

        {/* Bottom Energy Gauge & Pips */}
        <div className="relative z-10 mt-1.5 flex flex-col gap-1">
          {/* 5-Pip Segmented Energy Meter */}
          <div ref={pipsRef} className="grid grid-cols-5 gap-1 w-full h-2 bg-[#0b051e] p-0.5 rounded-md border border-[#9d4edd]/30">
            {[0, 1, 2, 3, 4].map((pipIndex) => {
              const isFilled = isMaxTier || pipIndex < hitsInCurrentTier;
              return (
                <div
                  key={pipIndex}
                  className={`h-full rounded-sm transition-all duration-200 relative overflow-hidden ${
                    isFilled
                      ? `pip-filled bg-gradient-to-r ${config.barGradient} shadow-[0_0_8px_${config.accentColor}]`
                      : 'bg-[#180e38]/60'
                  }`}
                >
                  {isFilled && (
                    <div className="absolute inset-0 bg-white/30 animate-shimmer" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Micro-Telemetry Status Row */}
          <div className="flex items-center justify-between text-[8px] sm:text-[9px] font-mono-tech text-gray-400 tracking-wider">
            <span className="uppercase text-gray-400">
              {t.comboMeter}
            </span>
            <span className="tabular-nums font-semibold text-gray-300">
              {isMaxTier
                ? t.maxMultiplier
                : `${t.nextMultiplier} x${nextMultiplier} (${hitsRemaining} ${hitsRemaining === 1 ? 'hit' : 'hits'})`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
