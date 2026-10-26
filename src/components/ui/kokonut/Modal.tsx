import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { audioManager } from '../../../utils/audio';
import { triggerHaptic } from '../../../utils/telegram';

export interface KokonutModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
}

export const KokonutModal: React.FC<KokonutModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  badge,
  children,
  footer,
  maxWidth = 'lg',
  className,
}) => {
  useEffect(() => {
    if (isOpen) {
      audioManager.playModalOpen('general');
    }
  }, [isOpen]);

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
  };

  const handleClose = () => {
    triggerHaptic('light');
    audioManager.playModalClose();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 font-mono-tech select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-[#04020a]/85 backdrop-blur-xl"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className={cn(
              'relative w-full bg-[#120a2e]/95 border border-[#00f5d4]/40 rounded-3xl shadow-[0_0_50px_rgba(0,245,212,0.3)] flex flex-col max-h-[90vh] overflow-hidden text-white z-10',
              maxWidthClasses[maxWidth],
              className
            )}
          >
            {/* Top Subtle Neon Beam */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f5d4] to-transparent pointer-events-none" />

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#00f5d4]/20 shrink-0 bg-[#160c38]/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  {icon && <div className="text-[#00f5d4] shrink-0">{icon}</div>}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-pixel text-xs sm:text-sm text-[#00f5d4] uppercase tracking-wider truncate">
                        {title}
                      </h3>
                      {badge}
                    </div>
                    {subtitle && (
                      <span className="text-[10px] text-gray-400 font-sans tracking-tight truncate">
                        {subtitle}
                      </span>
                    )}
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleClose}
                  className="p-1.5 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </motion.button>
              </div>
            )}

            {/* Content Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="px-5 sm:px-6 py-3.5 border-t border-[#00f5d4]/20 bg-[#0d0624]/80 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
