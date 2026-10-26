import React from 'react';
import { motion } from 'motion/react';
import { cn } from './cn';
import { audioManager } from '../../../utils/audio';
import { triggerHaptic } from '../../../utils/telegram';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface KokonutTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  tabClassName?: string;
  layoutId?: string;
}

export const KokonutTabs: React.FC<KokonutTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className,
  tabClassName,
  layoutId = 'activeKokonutTab',
}) => {
  return (
    <div
      className={cn(
        'flex items-center gap-1 p-1 bg-[#0b061d]/90 backdrop-blur-xl border border-[#00f5d4]/20 rounded-2xl w-full font-mono-tech select-none overflow-x-auto no-scrollbar',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              if (activeTab !== tab.id) {
                audioManager.playNavClick();
                triggerHaptic('light');
                onChange(tab.id);
              }
            }}
            onMouseEnter={() => {
              if (activeTab !== tab.id) audioManager.playNavHover();
            }}
            className={cn(
              'relative flex-1 min-w-max px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer z-10 whitespace-nowrap',
              isActive ? 'text-[#080417] font-bold' : 'text-gray-400 hover:text-white',
              tabClassName
            )}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute inset-0 bg-gradient-to-r from-[#00f5d4] to-[#33f7dd] rounded-xl shadow-[0_0_18px_rgba(0,245,212,0.4)] -z-10"
              />
            )}

            {tab.icon && <span className={cn('shrink-0', isActive ? 'text-[#080417]' : 'text-gray-400')}>{tab.icon}</span>}
            <span className="truncate">{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'px-1.5 py-0.2 text-[9px] rounded-full font-pixel font-bold shrink-0',
                  isActive
                    ? 'bg-[#080417] text-[#00f5d4]'
                    : 'bg-[#1e103f] text-[#ffb703] border border-[#ffb703]/40'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
