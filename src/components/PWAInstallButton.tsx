import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';

interface PWAInstallButtonProps {
  lang?: 'en' | 'ru';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  lang = 'en',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const isRu = lang === 'ru';

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-2 px-3 py-2 bg-[#00f5d4] text-[#0b071e] font-pixel text-xs font-bold rounded-lg hover:bg-[#00f5d4]/90 transition shadow-[0_0_12px_#00f5d4] ${className}`}
      >
        <Download className="w-4 h-4" />
        <span>{isRu ? 'УСТАНОВИТЬ PWA' : 'INSTALL PWA'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-2 px-3 py-2 bg-[#210b42] border border-[#00f5d4] text-[#00f5d4] font-pixel text-xs font-bold rounded-lg hover:bg-[#00f5d4]/20 transition ${className}`}
        >
          <Smartphone className="w-4 h-4" />
          <span>{isRu ? 'УСТАНОВИТЬ НА iOS' : 'INSTALL ON iOS'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 font-mono-tech select-none">
            <div className="relative w-full max-w-sm rounded-2xl bg-[#120a2e] border-2 border-[#00f5d4] p-6 shadow-[0_0_30px_rgba(0,245,212,0.4)] text-white flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#00f5d4]/30 pb-3">
                <h3 className="font-pixel text-xs text-[#00f5d4]">
                  {isRu ? 'УСТАНОВКА НА IPHONE / IPAD' : 'INSTALL ON IPHONE / IPAD'}
                </h3>
                <button onClick={() => setShowIOSGuide(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                {isRu ? (
                  <>
                    1. Нажмите кнопку <strong>«Поделиться» (Share)</strong> в меню браузера Safari.<br />
                    2. Прокрутите вниз и выберите <strong>«На экран "Домой"» (Add to Home Screen)</strong>.
                  </>
                ) : (
                  <>
                    1. Tap the <strong>Share</strong> button in Safari toolbar.<br />
                    2. Scroll down and tap <strong>Add to Home Screen</strong>.
                  </>
                )}
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-[#00f5d4] text-[#0b071e] font-pixel text-xs font-bold"
              >
                {isRu ? 'ПОНЯТНО' : 'GOT IT'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
