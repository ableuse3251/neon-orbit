import React from 'react';
import { motion } from 'motion/react';
import { cn } from './cn';
import { audioManager } from '../../../utils/audio';
import { triggerHaptic } from '../../../utils/telegram';

export interface KokonutSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export const KokonutSwitch: React.FC<KokonutSwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className,
}) => {
  const handleToggle = () => {
    if (disabled) return;
    audioManager.playNavClick();
    triggerHaptic('light');
    onChange(!checked);
  };

  return (
    <div
      onClick={handleToggle}
      className={cn(
        'flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-[#140b33]/60 border border-[#9d4edd]/20 hover:border-[#00f5d4]/40 transition-all cursor-pointer font-mono-tech select-none',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
      )}
    >
      {(label || description) && (
        <div className="flex flex-col min-w-0">
          {label && <span className="text-xs sm:text-sm font-semibold text-white tracking-tight">{label}</span>}
          {description && <span className="text-[10px] sm:text-xs text-gray-400 font-sans tracking-tight">{description}</span>}
        </div>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
          checked
            ? 'bg-gradient-to-r from-[#00f5d4] to-[#33f7dd] shadow-[0_0_12px_rgba(0,245,212,0.5)]'
            : 'bg-[#1a0e3a] border-[#9d4edd]/40'
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5 bg-[#080417]' : 'translate-x-0 bg-gray-300'
          )}
        />
      </button>
    </div>
  );
};
