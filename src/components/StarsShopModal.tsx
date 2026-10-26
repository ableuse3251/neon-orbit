import React, { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { STARS_CATALOG, StarsCatalogItem } from '../shared/stars-catalog';
import { triggerHaptic, getTelegramApp } from '../utils/telegram';
import { getTranslation } from '../utils/i18n';
import { api } from '../utils/api';
import { StarXtrIcon } from './ui/Icons';
import { KokonutModal, KokonutCard, KokonutButton, KokonutBadge } from './ui/kokonut';

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

  return (
    <KokonutModal
      isOpen={true}
      onClose={onClose}
      title="Telegram Stars Store (XTR)"
      icon={<StarXtrIcon size={20} />}
      maxWidth="md"
    >
      <div className="flex flex-col gap-3">
        {/* Verifying Payment Banner */}
        {verifyingPayment && (
          <div className="p-3 rounded-2xl bg-[#ffb703]/20 border border-[#ffb703] flex items-center justify-center gap-2 text-xs text-[#ffb703] animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>
              {profile.lang === 'ru'
                ? 'Синхронизация профиля с сервером...'
                : 'Verifying purchase with server...'}
            </span>
          </div>
        )}

        {/* Success Modal Notification */}
        {successItem && (
          <KokonutCard variant="glow" hoverEffect={false} className="p-4 flex flex-col items-center gap-2 text-center border-emerald-400">
            <Check className="w-8 h-8 text-emerald-400 animate-bounce" />
            <h4 className="font-pixel text-xs sm:text-sm text-emerald-300">
              {profile.lang === 'ru' ? 'Покупка успешно совершена!' : 'Purchase Successful!'}
            </h4>
            <p className="text-[11px] text-gray-300 font-sans">
              {profile.lang === 'ru' ? successItem.titleRu : successItem.titleEn}
            </p>
            <KokonutButton
              variant="glow"
              size="sm"
              onClick={() => setSuccessItem(null)}
              className="mt-1"
            >
              OK
            </KokonutButton>
          </KokonutCard>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-red-950/70 border border-red-500 text-red-200 text-xs text-center font-bold">
            {errorMessage}
          </div>
        )}

        {/* Stars Catalog Items List */}
        <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
          {STARS_CATALOG.map((item) => (
            <KokonutCard key={item.id} variant="glow" hoverEffect={true} className="flex items-center justify-between p-3.5 sm:p-4">
              <div className="flex flex-col gap-1 min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-pixel text-xs sm:text-sm text-white font-bold truncate">
                    {profile.lang === 'ru' ? item.titleRu : item.titleEn}
                  </h4>
                  <KokonutBadge variant="gold" size="sm">
                    {item.type.toUpperCase()}
                  </KokonutBadge>
                </div>
                <p className="text-[11px] text-gray-400 font-sans truncate">
                  {profile.lang === 'ru' ? item.descRu : item.descEn}
                </p>
              </div>

              <KokonutButton
                variant="shimmer"
                size="sm"
                isLoading={loadingItemId === item.id}
                onClick={() => handleBuyWithStars(item)}
                icon={<StarXtrIcon size={14} color="#ffb703" />}
                className="shrink-0"
              >
                {item.priceStars} XTR
              </KokonutButton>
            </KokonutCard>
          ))}
        </div>
      </div>
    </KokonutModal>
  );
};
