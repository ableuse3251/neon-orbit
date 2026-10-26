import React from 'react';
import { cn } from './cn';

export interface KokonutBadgeProps {
  children: React.ReactNode;
  variant?: 'cyan' | 'gold' | 'pink' | 'purple' | 'glass' | 'success';
  size?: 'sm' | 'md';
  className?: string;
  icon?: React.ReactNode;
}

export const KokonutBadge: React.FC<KokonutBadgeProps> = ({
  children,
  variant = 'cyan',
  size = 'md',
  className,
  icon,
}) => {
  const variantClasses = {
    cyan: 'bg-[#00f5d4]/15 border border-[#00f5d4]/50 text-[#00f5d4] shadow-[0_0_8px_rgba(0,245,212,0.2)]',
    gold: 'bg-[#ffb703]/15 border border-[#ffb703]/50 text-[#ffb703] shadow-[0_0_8px_rgba(255,183,3,0.2)]',
    pink: 'bg-[#ff007f]/15 border border-[#ff007f]/50 text-[#ff007f] shadow-[0_0_8px_rgba(255,0,127,0.2)]',
    purple: 'bg-[#9d4edd]/15 border border-[#9d4edd]/50 text-[#c77dff] shadow-[0_0_8px_rgba(157,78,221,0.2)]',
    glass: 'bg-white/10 border border-white/20 text-white backdrop-blur-md',
    success: 'bg-emerald-500/15 border border-emerald-400/50 text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.2)]',
  };

  const sizeClasses = {
    sm: 'text-[9px] px-2 py-0.5 rounded-md gap-1 font-pixel',
    md: 'text-xs px-2.5 py-1 rounded-lg gap-1.5 font-mono-tech font-semibold',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center tracking-wider shrink-0 select-none uppercase',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
