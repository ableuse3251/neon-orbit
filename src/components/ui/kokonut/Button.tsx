import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';
import { audioManager } from '../../../utils/audio';
import { triggerHaptic } from '../../../utils/telegram';

export interface KokonutButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children?: React.ReactNode;
  variant?: 'glow' | 'shimmer' | 'glass' | 'gradient' | 'ghost' | 'outline' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  hapticType?: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'error';
  soundType?: 'hover' | 'click' | 'modal' | 'confirm';
}

export const KokonutButton: React.FC<KokonutButtonProps> = ({
  children,
  variant = 'glow',
  size = 'md',
  isLoading = false,
  icon,
  iconPosition = 'left',
  hapticType = 'light',
  soundType = 'click',
  className,
  disabled,
  onClick,
  onMouseEnter,
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-xl gap-1.5 min-h-[32px]',
    md: 'px-4 py-2.5 text-xs sm:text-sm rounded-xl gap-2 min-h-[42px]',
    lg: 'px-6 py-3.5 text-sm sm:text-base rounded-2xl gap-2.5 min-h-[50px] font-bold',
    icon: 'p-2 sm:p-2.5 rounded-xl min-w-[40px] min-h-[40px] flex items-center justify-center',
  };

  const variantClasses = {
    glow: 'relative bg-[#00f5d4] text-[#080417] font-bold shadow-[0_0_20px_rgba(0,245,212,0.4)] hover:shadow-[0_0_28px_rgba(0,245,212,0.7)] hover:bg-[#33f7dd] active:scale-[0.98] border border-[#00f5d4]/50',
    shimmer: 'relative bg-gradient-to-r from-[#1b0c3a] via-[#2d1259] to-[#1b0c3a] text-white font-semibold border border-[#ffb703]/50 shadow-[0_4px_20px_rgba(255,183,3,0.2)] hover:border-[#ffb703] hover:shadow-[0_0_24px_rgba(255,183,3,0.45)] overflow-hidden',
    glass: 'bg-[#180d38]/70 backdrop-blur-xl text-white border border-white/10 hover:border-[#00f5d4]/50 hover:bg-[#251554]/80 shadow-[0_4px_24px_rgba(0,0,0,0.4)]',
    gradient: 'bg-gradient-to-r from-[#ff007f] via-[#7928ca] to-[#00f5d4] text-white font-bold shadow-[0_4px_25px_rgba(255,0,127,0.35)] hover:shadow-[0_0_30px_rgba(0,245,212,0.5)] border border-white/20',
    ghost: 'bg-transparent text-gray-300 hover:text-white hover:bg-white/10 border border-transparent',
    outline: 'bg-transparent text-[#00f5d4] border border-[#00f5d4]/60 hover:bg-[#00f5d4]/15 hover:border-[#00f5d4] shadow-[0_0_12px_rgba(0,245,212,0.15)]',
    secondary: 'bg-[#1a0e3b] text-white border border-[#9d4edd]/40 hover:border-[#9d4edd] hover:bg-[#281559] shadow-[0_4px_16px_rgba(157,78,221,0.2)]',
    danger: 'bg-gradient-to-r from-red-600 to-rose-700 text-white font-bold border border-red-500/50 shadow-[0_0_18px_rgba(225,29,72,0.4)] hover:shadow-[0_0_25px_rgba(225,29,72,0.6)]',
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    audioManager.playNavHover();
    if (onMouseEnter) onMouseEnter(e);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) return;
    if (soundType === 'click') audioManager.playNavClick();
    else if (soundType === 'modal') audioManager.playModalOpen('general');
    triggerHaptic(hapticType);
    if (onClick) onClick(e);
  };

  return (
    <motion.button
      whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.96 }}
      transition={{ type: 'spring', stiffness: 450, damping: 22 }}
      disabled={disabled || isLoading}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      className={cn(
        'inline-flex items-center justify-center font-mono-tech tracking-tight transition-all duration-200 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {/* Shimmer overlay effect for 'shimmer' variant */}
      {variant === 'shimmer' && (
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full animate-[shimmer_2.5s_infinite] pointer-events-none" />
      )}

      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
          {children && <span>{children}</span>}
          {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
        </>
      )}
    </motion.button>
  );
};
