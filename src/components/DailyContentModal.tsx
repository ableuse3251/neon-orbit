import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { getTranslation, Language } from '../utils/i18n';

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
      const res = await api.claimDailyQuest(questId);
      if (res.success) {
        loadData();
      } else {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleProtectStreak = async () => {
    try {
      const res = await api.protectStreak();
      if (res.success) {
        loadData();
      } else {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-950 border border-cyan-500/50 rounded-2xl p-6 text-slate-100 shadow-[0_0_30px_rgba(6,182,212,0.2)] overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cyan-500/30">
          <div>
            <h2 className="text-xl font-black tracking-wider text-cyan-400 font-mono">
              {lang === 'ru' ? 'ЕЖЕДНЕВНЫЙ КОНТЕНТ' : 'DAILY HUB'}
            </h2>
            <p className="text-xs text-slate-400">
              {lang === 'ru' ? 'Квесты, стрики и золотые часы' : 'Quests, streaks & golden hours'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-900 border border-cyan-500/30 flex items-center justify-center text-cyan-400 hover:bg-cyan-950 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-500/50 rounded-lg text-xs text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-cyan-400 font-mono animate-pulse">
              {lang === 'ru' ? 'ЗАГРУЗКА КОСМОСА...' : 'LOADING COSMOS...'}
            </div>
          ) : (
            <>
              {/* Golden Hour Banner */}
              {status?.goldenHour && (
                <div className="p-4 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/50 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">
                      {lang === 'ru' ? 'Золотой Час Активен!' : 'Golden Hour Active!'}
                    </span>
                    <h3 className="text-sm font-bold text-amber-200 mt-0.5">{status.goldenHour.title}</h3>
                    <p className="text-xs text-amber-300/80 mt-1">
                      x{status.goldenHour.multiplier} {lang === 'ru' ? 'очков за раунды' : 'score multiplier'}
                    </p>
                  </div>
                  <div className="text-2xl animate-bounce">⚡</div>
                </div>
              )}

              {/* Streaks Widget */}
              {status?.streak && (
                <div className="p-4 bg-slate-900/80 border border-cyan-500/30 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs text-cyan-400 font-mono">
                      {lang === 'ru' ? 'Стрик активности' : 'Activity Streak'}
                    </span>
                    <div className="text-2xl font-black text-white font-mono mt-0.5 flex items-center gap-2">
                      🔥 {status.streak.current_streak} {lang === 'ru' ? 'дней' : 'days'}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {lang === 'ru' ? `Заморозок осталось: ${status.streak.streak_freezes_left}` : `Freezes left: ${status.streak.streak_freezes_left}`}
                    </p>
                  </div>
                  <button
                    onClick={handleProtectStreak}
                    disabled={status.streak.streak_freezes_left <= 0 || status.streak.is_protected}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                      status.streak.is_protected
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                        : status.streak.streak_freezes_left > 0
                        ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {status.streak.is_protected
                      ? (lang === 'ru' ? 'Защищено' : 'Protected')
                      : (lang === 'ru' ? 'Использовать заморозку' : 'Use Freeze')}
                  </button>
                </div>
              )}

              {/* Limited Events */}
              {status?.limitedEvents && status.limitedEvents.length > 0 && (
                <div>
                  <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-widest mb-3">
                    {lang === 'ru' ? 'Лимитированные события' : 'Limited Events'}
                  </h3>
                  <div className="space-y-2">
                    {status.limitedEvents.map((ev: any) => (
                      <div key={ev.id} className="p-3 bg-purple-950/40 border border-purple-500/40 rounded-xl flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-purple-200">
                            {lang === 'ru' ? ev.title_ru : ev.title_en}
                          </h4>
                          <p className="text-xs text-purple-300/80 mt-0.5">
                            Theme: {ev.theme_slug}
                          </p>
                        </div>
                        <span className="text-xs px-2.5 py-1 bg-purple-500/20 border border-purple-500/50 rounded-md text-purple-300 font-mono">
                          ACTIVE
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daily Quests */}
              <div>
                <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-widest mb-3">
                  {lang === 'ru' ? 'Ежедневные квесты (сброс в 00:00 UTC)' : 'Daily Quests (Resets at 00:00 UTC)'}
                </h3>
                <div className="space-y-3">
                  {quests.map((q) => {
                    const progressPercent = Math.min(100, Math.round((q.progress / q.target_value) * 100));
                    return (
                      <div key={q.id} className="p-4 bg-slate-900/60 border border-cyan-500/20 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-slate-200">
                            {lang === 'ru' ? q.title_ru : q.title_en}
                          </span>
                          <span className="text-xs font-mono text-cyan-400">
                            {q.progress} / {q.target_value}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-cyan-500/20 mb-3">
                          <div
                            className="h-full bg-cyan-400 transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span>✨ +{q.reward_dust} {lang === 'ru' ? 'пыли' : 'dust'}</span>
                            <span>⭐ +{q.reward_exp} EXP</span>
                          </div>

                          {q.is_claimed ? (
                            <span className="text-xs font-bold text-emerald-400 font-mono">
                              ✓ {lang === 'ru' ? 'Получено' : 'Claimed'}
                            </span>
                          ) : q.is_completed ? (
                            <button
                              onClick={() => handleClaim(q.id)}
                              className="px-3 py-1.5 text-xs font-bold bg-cyan-500 text-slate-950 rounded-lg hover:bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)] transition-all"
                            >
                              {lang === 'ru' ? 'Забрать' : 'Claim'}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500 font-mono">
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
        <div className="pt-4 border-t border-cyan-500/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 border border-cyan-500/30 rounded-xl text-xs font-bold text-cyan-400 hover:bg-cyan-950 transition-colors"
          >
            {lang === 'ru' ? 'Закрыть' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
