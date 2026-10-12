import React from 'react';
import { X, ShieldCheck, Trash2, Scale } from 'lucide-react';
import { getTranslation } from '../utils/i18n';

interface PrivacyPolicyModalProps {
  lang?: 'en' | 'ru';
  onClose: () => void;
  onRequestDataDeletion: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  lang = 'en',
  onClose,
  onRequestDataDeletion,
}) => {
  const isRu = lang === 'ru';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-md bg-[#120a2e] border-2 border-[#00f5d4] rounded-2xl p-5 shadow-[0_0_35px_rgba(0,245,212,0.35)] flex flex-col gap-4 text-white max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#00f5d4]/40 pb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#00f5d4]" />
            <h2 className="font-pixel text-xs text-[#00f5d4] uppercase tracking-wider">
              {isRu ? 'Политика и Условия (Stars)' : 'Privacy & Terms (Stars)'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-3 text-xs text-gray-300 pr-1 leading-relaxed">
          <section className="flex flex-col gap-1">
            <span className="font-pixel text-[#ffb703] text-[11px] uppercase">
              1. Telegram Stars Digital Goods Terms
            </span>
            <p className="text-[11px]">
              {isRu
                ? 'Все виртуальные товары (скины кораблей, темы, эффекты, страховка стрика) являются цифровым декоративным контентом. Оплаты производятся через валюту Telegram Stars (XTR).'
                : 'All digital goods (ship skins, themes, FX, streak insurance) are virtual cosmetic items. Purchases are executed natively via Telegram Stars (XTR).'}
            </p>
          </section>

          <section className="flex flex-col gap-1">
            <span className="font-pixel text-[#ffb703] text-[11px] uppercase">
              2. Data Storage & Privacy
            </span>
            <p className="text-[11px]">
              {isRu
                ? 'Мы сохраняем только ваш Telegram ID, имя, игровой прогресс и список разблокированных космецевтик. Ваши личные данные никогда не передаются третьим лицам.'
                : 'We store only your public Telegram ID, first name, gameplay scores, and unlocked cosmetic inventory. No personal data is sold or shared.'}
            </p>
          </section>

          <section className="flex flex-col gap-1">
            <span className="font-pixel text-[#ff0054] text-[11px] uppercase">
              3. Right to Data Erasure (/delete_me)
            </span>
            <p className="text-[11px]">
              {isRu
                ? 'Вы можете в любой момент полностью удалить свой аккаунт и все сохраненные данные, отправив команду /delete_me боту @Neon_orbitbot или нажав кнопку ниже.'
                : 'You may permanently delete your profile and game data at any time by sending /delete_me to @Neon_orbitbot or tapping the button below.'}
            </p>
          </section>
        </div>

        <button
          onClick={onRequestDataDeletion}
          className="w-full py-3 bg-[#ff0054]/20 border border-[#ff0054] text-[#ff0054] hover:bg-[#ff0054] hover:text-white transition-all font-pixel text-xs rounded-xl flex items-center justify-center gap-2 font-bold"
        >
          <Trash2 className="w-4 h-4" />
          <span>{isRu ? 'УДАЛИТЬ ВСЕ МОИ ДАННЫЕ (/delete_me)' : 'ERASE ALL MY DATA (/delete_me)'}</span>
        </button>
      </div>
    </div>
  );
};
