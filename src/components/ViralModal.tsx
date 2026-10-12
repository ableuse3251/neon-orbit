import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Language } from '../utils/i18n';

interface ViralModalProps {
  isOpen: boolean;
  lang?: Language;
  onClose: () => void;
  lastScore?: number;
  lastCombo?: number;
  lastSeed?: number;
}

export const ViralModal: React.FC<ViralModalProps> = ({ isOpen, lang = 'ru', onClose, lastScore = 0, lastCombo = 1, lastSeed = Date.now() }) => {
  const [teamGoal, setTeamGoal] = useState<any>(null);
  const [referrals, setReferrals] = useState<any>(null);
  const [notifPrefs, setNotifPrefs] = useState<any>({ enabled: true, quietStart: 23, quietEnd: 8, timezone: 'UTC' });
  const [challengeLink, setChallengeLink] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'team' | 'referrals' | 'challenge' | 'notifs'>('team');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const goalRes = await api.getTeamGoal();
      if (goalRes.success) setTeamGoal(goalRes.goal);

      const refRes = await api.getReferrals();
      if (refRes.success) setReferrals(refRes);

      const notifRes = await api.getNotificationPrefs();
      if (notifRes) setNotifPrefs(notifRes);
    } catch (e) {
      console.error('Failed to load viral data', e);
    }
  };

  const handleCreateChallenge = async () => {
    try {
      const res = await api.createChallenge(lastScore, lastCombo, lastSeed);
      if (res.success) {
        const botName = 'NeonOrbitBot';
        const link = `https://t.me/${botName}?startapp=challenge_${res.challengeId}`;
        setChallengeLink(link);
      }
    } catch (e) {
      console.error('Failed to create challenge', e);
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleNotifs = async (enabled: boolean) => {
    setNotifPrefs((prev: any) => ({ ...prev, enabled }));
    try {
      await api.updateNotificationPrefs({ enabled });
    } catch (e) {
      console.error('Failed to update notifications', e);
    }
  };

  if (!isOpen) return null;

  const pct = teamGoal ? Math.min(100, Math.round((teamGoal.current_score / teamGoal.target_score) * 100)) : 0;
  const botName = 'NeonOrbitBot';
  const refLink = `https://t.me/${botName}?startapp=ref_${localStorage.getItem('telegram_id') || '123'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="w-full max-w-md bg-[#130826] border-2 border-[#00f5d4] rounded-2xl p-6 text-white shadow-[0_0_30px_rgba(0,245,212,0.3)] relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white font-pixel text-sm"
        >
          [X]
        </button>

        <h2 className="text-xl font-pixel text-[#00f5d4] mb-4 text-center">
          {lang === 'ru' ? 'Вирусные Штабы' : 'Viral Hub'}
        </h2>

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1.5 mb-6">
          <button
            onClick={() => setActiveTab('team')}
            className={`py-2 text-[9px] font-pixel rounded-xl border ${activeTab === 'team' ? 'bg-[#00f5d4]/20 border-[#00f5d4] text-[#00f5d4]' : 'bg-[#1a0b36] border-gray-700 text-gray-400'}`}
          >
            {lang === 'ru' ? 'Флот' : 'Fleet'}
          </button>
          <button
            onClick={() => setActiveTab('referrals')}
            className={`py-2 text-[9px] font-pixel rounded-xl border ${activeTab === 'referrals' ? 'bg-[#ff007f]/20 border-[#ff007f] text-[#ff007f]' : 'bg-[#1a0b36] border-gray-700 text-gray-400'}`}
          >
            {lang === 'ru' ? 'Рефералы' : 'Refs'}
          </button>
          <button
            onClick={() => setActiveTab('challenge')}
            className={`py-2 text-[9px] font-pixel rounded-xl border ${activeTab === 'challenge' ? 'bg-[#7000ff]/20 border-[#7000ff] text-[#7000ff]' : 'bg-[#1a0b36] border-gray-700 text-gray-400'}`}
          >
            {lang === 'ru' ? 'Вызов' : 'Duel'}
          </button>
          <button
            onClick={() => setActiveTab('notifs')}
            className={`py-2 text-[9px] font-pixel rounded-xl border ${activeTab === 'notifs' ? 'bg-[#ffaa00]/20 border-[#ffaa00] text-[#ffaa00]' : 'bg-[#1a0b36] border-gray-700 text-gray-400'}`}
          >
            {lang === 'ru' ? 'Алерт' : 'Alerts'}
          </button>
        </div>

        {activeTab === 'team' && teamGoal && (
          <div className="space-y-4">
            <div className="bg-[#1a0b36] border border-[#00f5d4]/40 p-4 rounded-xl text-center">
              <p className="text-xs font-pixel text-gray-300 mb-2">
                {lang === 'ru' ? teamGoal.title_ru : teamGoal.title_en}
              </p>
              <div className="w-full bg-gray-800 h-4 rounded-full overflow-hidden border border-gray-600 mb-2">
                <div
                  className="bg-gradient-to-r from-[#00f5d4] to-[#7000ff] h-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-pixel text-gray-400">
                <span>{teamGoal.current_score.toLocaleString()} pts</span>
                <span>{pct}%</span>
                <span>{teamGoal.target_score.toLocaleString()} pts</span>
              </div>
            </div>
            <p className="text-[10px] font-pixel text-gray-400 text-center">
              {lang === 'ru' ? 'Общий вклад всех игроков за неделю. Награда выдается по достижении цели!' : 'Combined fleet progress this week. Reward unlocked upon completion!'}
            </p>
          </div>
        )}

        {activeTab === 'referrals' && referrals && (
          <div className="space-y-4">
            <div className="bg-[#1a0b36] border border-[#ff007f]/40 p-4 rounded-xl text-center">
              <p className="text-xs font-pixel text-[#ff007f] mb-1">
                {lang === 'ru' ? `Приглашено пилотов: ${referrals.count}` : `Invited Pilots: ${referrals.count}`}
              </p>
              <p className="text-[10px] font-pixel text-gray-400 mb-3">
                {lang === 'ru' ? 'Получайте пыль и бонусы за каждого активного кадета!' : 'Earn dust and bonuses for every active cadet!'}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={refLink}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-xs font-pixel text-gray-300 select-all"
                />
                <button
                  onClick={() => handleCopyLink(refLink)}
                  className="bg-[#ff007f] hover:bg-[#ff007f]/80 text-white font-pixel text-xs px-4 py-2 rounded-lg"
                >
                  {copied ? 'OK' : (lang === 'ru' ? 'Копировать' : 'Copy')}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'challenge' && (
          <div className="space-y-4">
            <div className="bg-[#1a0b36] border border-[#7000ff]/40 p-4 rounded-xl text-center">
              <p className="text-xs font-pixel text-[#7000ff] mb-2">
                {lang === 'ru' ? 'Побей мой рекорд!' : 'Beat My Score!'}
              </p>
              <p className="text-[10px] font-pixel text-gray-400 mb-4">
                {lang === 'ru' ? `Ваш счёт: ${lastScore} очков (Комбо x${lastCombo}). Срочно отправьте другу!` : `Your score: ${lastScore} pts (Combo x${lastCombo}). Challenge a friend!`}
              </p>
              {!challengeLink ? (
                <button
                  onClick={handleCreateChallenge}
                  className="w-full py-3 bg-gradient-to-r from-[#7000ff] to-[#ff007f] hover:opacity-90 text-white font-pixel text-xs rounded-xl shadow-lg"
                >
                  {lang === 'ru' ? 'Создать ссылку-вызов' : 'Create Challenge Link'}
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    readOnly
                    value={challengeLink}
                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-xs font-pixel text-gray-300 select-all"
                  />
                  <button
                    onClick={() => handleCopyLink(challengeLink)}
                    className="w-full py-2 bg-[#00f5d4] hover:bg-[#00f5d4]/80 text-black font-pixel text-xs rounded-xl font-bold"
                  >
                    {copied ? (lang === 'ru' ? 'Скопировано!' : 'Copied!') : (lang === 'ru' ? 'Копировать ссылку' : 'Copy Link')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'notifs' && (
          <div className="space-y-4">
            <div className="bg-[#1a0b36] border border-[#ffaa00]/40 p-4 rounded-xl text-center space-y-4">
              <p className="text-xs font-pixel text-[#ffaa00]">
                {lang === 'ru' ? 'Возвращающие уведомления' : 'Push Alerts & Reminders'}
              </p>
              <p className="text-[10px] font-pixel text-gray-400">
                {lang === 'ru'
                  ? 'Получайте напоминания о стриках, золотых часах и событиях (не более 1-2 в сутки, без спама).'
                  : 'Receive reminders about streaks, golden hours, and events (max 1-2 per day, zero spam).'}
              </p>

              <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-gray-700">
                <span className="text-xs font-pixel text-white">
                  {lang === 'ru' ? 'Уведомления в боте' : 'Bot Notifications'}
                </span>
                <button
                  onClick={() => handleToggleNotifs(!notifPrefs.enabled)}
                  className={`px-4 py-2 text-xs font-pixel rounded-lg font-bold transition-all ${
                    notifPrefs.enabled ? 'bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-red-500 text-white'
                  }`}
                >
                  {notifPrefs.enabled ? (lang === 'ru' ? 'ВКЛ' : 'ON') : (lang === 'ru' ? 'ВЫКЛ' : 'OFF')}
                </button>
              </div>

              <div className="text-[9px] font-pixel text-gray-400 text-left space-y-1">
                <p>• {lang === 'ru' ? 'Тихие часы: с 23:00 до 08:00 (уважаем сон пилотов)' : 'Quiet hours: 23:00–08:00 UTC'}</p>
                <p>• {lang === 'ru' ? 'Мгновенная отписка кнопкой в любой рассылке или через /notifications' : 'Instant unsubscribe via /notifications or message button'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
