import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from './cn';
import { audioManager } from '../../../utils/audio';

export interface KokonutInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  success?: boolean;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onClear?: () => void;
  containerClassName?: string;
}

export const KokonutInput = React.forwardRef<HTMLInputElement, KokonutInputProps>(
  (
    {
      label,
      helperText,
      error,
      success,
      icon,
      rightIcon,
      onClear,
      containerClassName,
      className,
      value,
      onChange,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      audioManager.playNavHover();
      if (onFocus) onFocus(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      if (onBlur) onBlur(e);
    };

    return (
      <div className={cn('flex flex-col gap-1.5 w-full font-mono-tech', containerClassName)}>
        {label && (
          <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
            <span>{label}</span>
            {props.maxLength && (
              <span className="text-[10px] text-gray-500 font-mono">
                {String(value || '').length}/{props.maxLength}
              </span>
            )}
          </label>
        )}

        <div
          className={cn(
            'relative flex items-center bg-[#0d0722]/80 backdrop-blur-xl border rounded-2xl transition-all duration-200 overflow-hidden shadow-inner',
            error
              ? 'border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.25)]'
              : success
              ? 'border-emerald-400/80 shadow-[0_0_15px_rgba(52,211,153,0.25)]'
              : isFocused
              ? 'border-[#00f5d4] shadow-[0_0_18px_rgba(0,245,212,0.3)] bg-[#140b33]'
              : 'border-[#9d4edd]/30 hover:border-[#9d4edd]/60'
          )}
        >
          {icon && <div className="pl-3.5 text-gray-400 shrink-0">{icon}</div>}

          <input
            ref={ref}
            value={value}
            onChange={onChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={cn(
              'w-full bg-transparent px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none tracking-wide font-medium',
              className
            )}
            {...props}
          />

          <div className="flex items-center gap-1.5 pr-3 shrink-0">
            {value && onClear && (
              <button
                type="button"
                onClick={onClear}
                className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {rightIcon}

            {error && <AlertCircle className="w-4 h-4 text-red-400 shrink-0 animate-bounce" />}
            {success && !error && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          </div>
        </div>

        {(error || helperText) && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('text-[11px] px-1 font-medium', error ? 'text-red-400' : 'text-gray-400')}
          >
            {error || helperText}
          </motion.p>
        )}
      </div>
    );
  }
);

KokonutInput.displayName = 'KokonutInput';
