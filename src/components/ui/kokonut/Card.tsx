import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { cn } from './cn';
import { audioManager } from '../../../utils/audio';

export interface KokonutCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  variant?: 'glass' | 'glow' | 'solid' | 'gradient';
  hoverEffect?: boolean;
  className?: string;
}

export const KokonutCard: React.FC<KokonutCardProps> = ({
  children,
  variant = 'glass',
  hoverEffect = true,
  className,
  onMouseEnter,
  ...props
}) => {
  const variantClasses = {
    glass: 'bg-[#130a2e]/75 backdrop-blur-2xl border border-[#00f5d4]/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)]',
    glow: 'bg-gradient-to-b from-[#180c3b] to-[#0d0622] border border-[#00f5d4]/40 shadow-[0_0_25px_rgba(0,245,212,0.15)]',
    solid: 'bg-[#140b33] border border-white/10 shadow-lg',
    gradient: 'bg-gradient-to-br from-[#1b0d42] via-[#12072d] to-[#090317] border border-[#ffb703]/30 shadow-xl',
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hoverEffect) audioManager.playNavHover();
    if (onMouseEnter) onMouseEnter(e);
  };

  return (
    <motion.div
      whileHover={hoverEffect ? { y: -3, scale: 1.01 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onMouseEnter={handleMouseEnter}
      className={cn(
        'relative rounded-2xl p-4 sm:p-5 font-mono-tech transition-all duration-200 overflow-hidden',
        hoverEffect && 'hover:border-[#00f5d4]/60 hover:shadow-[0_0_30px_rgba(0,245,212,0.25)]',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {/* Top subtle inner illumination beam */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
      {children}
    </motion.div>
  );
};
