import React, { useEffect, useState } from 'react';
import { X, Sparkles, Flame, Shield, Check, Calendar, Zap, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';
import { getTranslation, Language } from '../utils/i18n';
import { triggerHaptic } from '../utils/telegram';
import { StardustCrystalIcon, TactileButton } from './ui/Icons';

interface DailyContentModalProps {
  isOpen: boolean;
  lang?: Language;
  onClose: () => void;
}

export const DailyContentModal: React.FC<DailyContentModalProps> = ({ isOpen, lang = 'ru', onClose }) => {
  const [loading, setLoading] = useState(true);
  const [quests, setQuests] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const t = getTranslation(lang);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [qRes, sRes] = await Promise.all([
        api.getDailyQuests(),
        api.getDailyStatus(),
      ]);
      if (qRes.success) setQuests(qRes.quests);
      if (sRes.success) setStatus(sRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load daily content');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (questId: string) => {
    try {
      triggerHaptic('medium');
      const res = await api.claimDailyQuest(questId);
      if (res.success) {
        triggerHaptic('success');
        loadData();
      } else {
        triggerHaptic('error');
        setError(res.error);
      }
    } catch (err: any) {
      triggerHaptic('error');
      setError(err.message);
    }
  };

  const handleProtectStreak = async () => {
    try {
      triggerHaptic('medium');
      const res = await api.protectStreak();
      if (res.success) {
        triggerHaptic('success');
        loadData();
      } else {
        triggerHaptic('error');
        setError(res.error);
      }
    } catch (err: any) {
      triggerHaptic('error');
      setError(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-lg bg-[#120a2e]/95 border-2 border-[#00f5d4] rounded-2xl p-4 sm:p-5 shadow-[0_0_35px_rgba(0,245,212,0.35)] flex flex-col gap-3 text-white max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#00f5d4]/40 pb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#00f5d4] animate-pulse" />
            <h2 className="font-pixel text-[11px] sm:text-xs text-[#00f5d4] uppercase tracking-wider">
              {lang === 'ru' ? 'ЕЖЕДНЕВНЫЙ КОНТЕНТ & КВЕСТЫ' : 'DAILY OPERATIONS HUB'}
            </h2>
          </div>
          <button
            onClick={() => {
              triggerHaptic('selection');
              onClose();
            }}
            className="p-1.5 rounded-lg bg-[#210b42] text-gray-400 hover:text-white border border-[#9d4edd]/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto py-1 space-y-4 pr-1 max-h-[75vh]">
          {error && (
            <div className="p-3 bg-[#ff0054]/20 border border-[#ff0054] rounded-xl text-xs text-[#ff0054] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#00f5d4] font-pixel text-xs animate-pulse gap-2">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>{lang === 'ru' ? 'СИНХРОНИЗАЦИЯ С ЕЖЕДНЕВНЫМ ЦЕНТРОМ...' : 'SYNCHRONIZING DAILY OPERATIONS...'}</span>
            </div>
          ) : (
            <>
              {/* Golden Hour Banner */}
              {status?.goldenHour && (
                <div className="p-3.5 bg-gradient-to-r from-[#ffb703]/25 via-[#210b42] to-[#ffb703]/10 border-2 border-[#ffb703] rounded-xl flex items-center justify-between shadow-[0_0_15px_rgba(255,183,3,0.3)]">
                  <div>
                    <span className="text-[10px] font-pixel font-bold text-[#ffb703] uppercase tracking-widest flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 fill-current text-[#ffb703]" />
                      {lang === 'ru' ? 'Золотой Час Активен!' : 'Golden Hour Active!'}
                    </span>
                    <h3 className="text-xs font-bold text-white mt-1 font-pixel">{status.goldenHour.title}</h3>
                    <p className="text-[10px] text-gray-300 font-mono-tech mt-0.5">
                      x{status.goldenHour.multiplier} {lang === 'ru' ? 'множитель очков за все раунды' : 'score multiplier for all rounds'}
                    </p>
                  </div>
                  <div className="text-3xl animate-bounce">⚡</div>
                </div>
              )}

              {/* Streaks Widget */}
              {status?.streak && (
                <div className="p-3.5 bg-[#0b071e] border border-[#00f5d4]/40 rounded-xl flex items-center justify-between shadow-md">
                  <div>
                    <span className="text-[10px] text-[#00f5d4] font-pixel uppercase tracking-wider flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-[#ff007f]" />
                      {lang === 'ru' ? 'Стрик Активности' : 'Activity Streak'}
                    </span>
                    <div className="text-xl font-pixel text-white font-bold mt-1 flex items-center gap-2">
                      🔥 {status.streak.current_streak} {lang === 'ru' ? 'Дней' : 'Days'}
                    </div>
                    <p className="text-[10px] text-gray-400 font-mono-tech mt-0.5">
                      {lang === 'ru' ? `Заморозок осталось: ${status.streak.streak_freezes_left}` : `Freezes left: ${status.streak.streak_freezes_left}`}
                    </p>
                  </div>
                  <button
                    onClick={handleProtectStreak}
                    disabled={status.streak.streak_freezes_left <= 0 || status.streak.is_protected}
                    className={`px-3 py-2 text-[10px] font-pixel font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                      status.streak.is_protected
                        ? 'bg-[#00f5d4]/20 text-[#00f5d4] border border-[#00f5d4]'
                        : status.streak.streak_freezes_left > 0
                        ? 'bg-[#00f5d4] text-[#0b071e] hover:bg-[#00f5d4]/90 shadow-[0_0_12px_#00f5d4]'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    {status.streak.is_protected
                      ? (lang === 'ru' ? 'Защищено' : 'Protected')
                      : (lang === 'ru' ? 'Заморозить' : 'Use Freeze')}
                  </button>
                </div>
              )}

              {/* Limited Events */}
              {status?.limitedEvents && status.limitedEvents.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-pixel text-[#ff007f] uppercase tracking-widest mb-2">
                    {lang === 'ru' ? 'Лимитированные события' : 'Limited Events'}
                  </h3>
                  <div className="space-y-2">
                    {status.limitedEvents.map((ev: any) => (
                      <div key={ev.id} className="p-3 bg-[#210b42]/80 border border-[#ff007f]/50 rounded-xl flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold font-pixel text-white">
                            {lang === 'ru' ? ev.title_ru : ev.title_en}
                          </h4>
                          <p className="text-[10px] text-gray-300 font-mono-tech mt-0.5">
                            Theme: {ev.theme_slug}
                          </p>
                        </div>
                        <span className="text-[9px] px-2.5 py-1 bg-[#ff007f]/20 border border-[#ff007f] rounded-lg text-[#ff007f] font-pixel">
                          ACTIVE
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daily Quests */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-pixel text-[#00f5d4] uppercase tracking-widest">
                    {lang === 'ru' ? 'Ежедневные квесты (Сброс в 00:00 UTC)' : 'Daily Quests (Resets at 00:00 UTC)'}
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {quests.map((q) => {
                    const progressPercent = Math.min(100, Math.round((q.progress / q.target_value) * 100));
                    return (
                      <div key={q.id} className="p-3.5 bg-[#0b071e] border border-[#9d4edd]/30 rounded-xl flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-pixel text-white font-bold">
                            {lang === 'ru' ? q.title_ru : q.title_en}
                          </span>
                          <span className="text-[10px] font-pixel text-[#00f5d4]">
                            {q.progress} / {q.target_value}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2.5 bg-[#120a2e] rounded-full overflow-hidden border border-[#9d4edd]/30 p-0.5">
                          <div
                            className="h-full bg-gradient-to-r from-[#00f5d4] to-[#9d4edd] rounded-full shadow-[0_0_8px_#00f5d4] transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-[#9d4edd]/15">
                          <div className="flex items-center gap-2.5 text-[10px] text-gray-300 font-mono-tech">
                            <span className="flex items-center gap-1 text-[#ffb703]">
                              <StardustCrystalIcon size={12} /> +{q.reward_dust}
                            </span>
                            <span className="text-[#00f5d4]">⭐ +{q.reward_exp} XP</span>
                          </div>

                          {q.is_claimed ? (
                            <span className="text-[10px] font-bold text-[#00f5d4] font-pixel flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> {lang === 'ru' ? 'Получено' : 'Claimed'}
                            </span>
                          ) : q.is_completed ? (
                            <button
                              onClick={() => handleClaim(q.id)}
                              className="px-3 py-1 text-[10px] font-pixel font-bold bg-[#ff007f] hover:bg-[#ff007f]/90 text-white rounded-lg shadow-[0_0_10px_#ff007f] transition-all"
                            >
                              {lang === 'ru' ? 'Забрать' : 'Claim'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-500 font-pixel">
                              {lang === 'ru' ? 'В процессе' : 'In Progress'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[#00f5d4]/30 flex justify-end shrink-0">
          <TactileButton
            onClick={() => {
              triggerHaptic('selection');
              onClose();
            }}
            variant="dark"
            size="sm"
          >
            {lang === 'ru' ? 'Закрыть' : 'Close'}
          </TactileButton>
        </div>

      </div>
    </div>
  );
};
