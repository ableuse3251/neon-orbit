import React from 'react';
import { motion } from 'motion/react';
import { cn } from './cn';

export interface KokonutProgressProps {
  value: number; // 0 to 100
  max?: number;
  variant?: 'cyan' | 'gold' | 'pink' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export const KokonutProgress: React.FC<KokonutProgressProps> = ({
  value,
  max = 100,
  variant = 'cyan',
  size = 'md',
  showLabel = false,
  label,
  className,
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const variantFills = {
    cyan: 'bg-gradient-to-r from-[#00f5d4] to-[#33f7dd] shadow-[0_0_12px_rgba(0,245,212,0.6)]',
    gold: 'bg-gradient-to-r from-[#ffb703] to-[#ffd166] shadow-[0_0_12px_rgba(255,183,3,0.6)]',
    pink: 'bg-gradient-to-r from-[#ff007f] to-[#ff409f] shadow-[0_0_12px_rgba(255,0,127,0.6)]',
    gradient: 'bg-gradient-to-r from-[#ff007f] via-[#ffb703] to-[#00f5d4] shadow-[0_0_16px_rgba(0,245,212,0.6)]',
  };

  const heightClasses = {
    sm: 'h-1.5 rounded-full',
    md: 'h-2.5 rounded-xl',
    lg: 'h-4 rounded-xl',
  };

  return (
    <div className={cn('flex flex-col gap-1 w-full font-mono-tech select-none', className)}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between text-xs font-semibold text-gray-300">
          <span>{label}</span>
          <span className="tabular-nums text-[#00f5d4]">{Math.round(percentage)}%</span>
        </div>
      )}

      <div
        className={cn(
          'relative w-full bg-[#0b061d] border border-white/10 overflow-hidden shadow-inner',
          heightClasses[size]
        )}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className={cn('h-full rounded-full transition-all duration-300', variantFills[variant])}
        />
      </div>
    </div>
  );
};
