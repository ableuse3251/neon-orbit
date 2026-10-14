import React, { useState } from 'react';
import { X, Shield, Check, Loader2 } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { STARS_CATALOG, StarsCatalogItem } from '../shared/stars-catalog';
import { triggerHaptic, getTelegramApp } from '../utils/telegram';
import { getTranslation } from '../utils/i18n';
import { api } from '../utils/api';
import { StarXtrIcon } from './ui/Icons';

interface StarsShopModalProps {
  profile: PlayerProfile;
  onPaymentSuccess: () => Promise<void>;
  onClose: () => void;
}

export const StarsShopModal: React.FC<StarsShopModalProps> = ({
  profile,
  onPaymentSuccess,
  onClose,
}) => {
  const t = getTranslation(profile.lang);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successItem, setSuccessItem] = useState<StarsCatalogItem | null>(null);

  const handleBuyWithStars = async (item: StarsCatalogItem) => {
    triggerHaptic('medium');
    setLoadingItemId(item.id);
    setErrorMessage(null);
    try {
      const res = await api.createInvoice(item.id);
      const app = getTelegramApp();
      if (res && res.success && res.invoiceUrl && app?.openInvoice) {
        app.openInvoice(res.invoiceUrl, async (status: string) => {
          setLoadingItemId(null);
          if (status === 'paid') {
            triggerHaptic('success');
            setVerifyingPayment(true);
            await onPaymentSuccess();
            setVerifyingPayment(false);
            setSuccessItem(item);
          } else if (status === 'cancelled') {
            triggerHaptic('warning');
            setErrorMessage(profile.lang === 'ru' ? 'Оплата отменена.' : 'Payment cancelled.');
          } else {
            triggerHaptic('error');
            setErrorMessage(profile.lang === 'ru' ? 'Ошибка при оплате Telegram Stars.' : 'Payment failed.');
          }
        });
      } else {
        setLoadingItemId(null);
        if (!app?.openInvoice) {
          setErrorMessage(
            profile.lang === 'ru'
              ? 'Оплата Telegram Stars доступна только внутри приложения Telegram.'
              : 'Telegram Stars payments are only available inside Telegram app.'
          );
        } else {
          setErrorMessage(res?.error || (profile.lang === 'ru' ? 'Не удалось создать счет.' : 'Failed to create invoice.'));
        }
      }
    } catch (err: any) {
      console.error('Invoice creation error:', err);
      setLoadingItemId(null);
      triggerHaptic('error');
      setErrorMessage(err?.message || (profile.lang === 'ru' ? 'Ошибка сервера.' : 'Server error.'));
    }
  };

  return (    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-md bg-[#120a2e]/95 border-2 border-[#ffb703] rounded-2xl p-4 sm:p-5 shadow-[0_0_35px_rgba(255,183,3,0.35)] flex flex-col gap-3.5 sm:gap-4 text-white max-h-[94vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#ffb703]/40 pb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <StarXtrIcon size={20} />
            <h2 className="font-pixel text-[11px] sm:text-xs text-[#ffb703] uppercase tracking-wider">
              Telegram Stars Store (XTR)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-[#210b42] text-gray-400 hover:text-white border border-[#ffb703]/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Verifying Payment Banner */}
        {verifyingPayment && (
          <div className="p-3 rounded-xl bg-[#ffb703]/20 border border-[#ffb703] flex items-center justify-center gap-2 text-xs text-[#ffb703] animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>
              {profile.lang === 'ru'
                ? 'Синхронизация профиля с сервером...'
                : 'Verifying purchase with server...'}
            </span>
          </div>
        )}

        {/* Success Popup */}
        {successItem && (
          <div className="p-4 rounded-xl bg-[#00f5d4]/20 border-2 border-[#00f5d4] flex flex-col items-center text-center gap-2 animate-bounce shadow-[0_0_20px_#00f5d4]">
            <span className="text-3xl">✨</span>
            <span className="font-pixel text-xs text-[#00f5d4]">
              {profile.lang === 'ru' ? 'ПОКУПКА ПОДТВЕРЖДЕНА!' : 'PURCHASE CONFIRMED!'}
            </span>
            <p className="text-[11px] text-gray-200">
              {profile.lang === 'ru' ? successItem.titleRu : successItem.titleEn}
            </p>
            <button
              onClick={() => setSuccessItem(null)}
              className="mt-1 px-4 py-1 bg-[#00f5d4] text-[#0b071e] font-pixel text-[10px] font-bold rounded-md"
            >
              OK
            </button>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 text-[11px] text-red-300 text-center">
            {errorMessage}
          </div>
        )}

        {/* Item Cards from Server Catalog */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 max-h-[55vh]">
          {STARS_CATALOG.map((item) => {
            const title = profile.lang === 'ru' ? item.titleRu : item.titleEn;
            const desc = profile.lang === 'ru' ? item.descRu : item.descEn;
            const isLoading = loadingItemId === item.id;
            const isProtected = item.type === 'insurance' && profile.hasStreakInsurance;

            return (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-[#0b071e] border border-[#ffb703]/30 hover:border-[#ffb703] flex items-center justify-between gap-3 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl p-2 rounded-xl bg-[#210b42] border border-[#ffb703]/30">
                    {item.icon}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-pixel text-xs text-white flex items-center gap-1.5">
                      {title}
                    </span>
                    <span className="text-[10px] text-gray-300 mt-0.5 leading-tight">
                      {desc}
                    </span>
                  </div>
                </div>

                <button
                  disabled={isLoading || isProtected || verifyingPayment}
                  onClick={() => handleBuyWithStars(item)}
                  className={`px-3 py-2 rounded-xl font-pixel text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all ${
                    isProtected
                      ? 'bg-gray-800 text-gray-400 border border-gray-700'
                      : 'bg-[#ffb703] text-[#0b071e] hover:bg-[#ffb703]/90 shadow-[0_0_12px_#ffb703]'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isProtected ? (
                    <span><Check className="w-3.5 h-3.5 inline" /> ACTIVE</span>
                  ) : (
                    <>
                      <StarXtrIcon size={14} color="#0b071e" glowColor="" />
                      <span>{item.priceStars} XTR</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Fair Play Banner */}
        <div className="p-2.5 rounded-xl bg-[#0b071e] border border-[#ffb703]/20 flex items-center justify-center gap-2 text-[10px] text-gray-400 text-center font-mono-tech">
          <Shield className="w-3.5 h-3.5 text-[#ffb703]" />
          <span>Cosmetics & convenience only. Zero score or rating impact!</span>
        </div>
      </div>
    </div>
  );
};
