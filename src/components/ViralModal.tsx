import React, { useEffect, useState } from 'react';
import { Share2, Users, Trophy, Bell, Copy, Check, Sparkles } from 'lucide-react';
import { api } from '../utils/api';
import { Language } from '../utils/i18n';
import { triggerHaptic } from '../utils/telegram';
import { KokonutModal, KokonutTabs, KokonutCard, KokonutProgress, KokonutButton, KokonutBadge, KokonutInput } from './ui/kokonut';

interface ViralModalProps {
  isOpen: boolean;
  lang?: Language;
  onClose: () => void;
  lastScore?: number;
  lastCombo?: number;
  lastSeed?: number;
}

export const ViralModal: React.FC<ViralModalProps> = ({
  isOpen,
  lang = 'ru',
  onClose,
  lastScore = 0,
  lastCombo = 1,
  lastSeed = Date.now(),
}) => {
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
      triggerHaptic('medium');
      const res = await api.createChallenge(lastScore, lastCombo, lastSeed);
      if (res.success) {
        triggerHaptic('success');
        const botName = 'NeonOrbitBot';
        const link = `https://t.me/${botName}?startapp=challenge_${res.challengeId}`;
        setChallengeLink(link);
      }
    } catch (e) {
      console.error('Failed to create challenge', e);
    }
  };

  const handleCopyLink = (link: string) => {
    triggerHaptic('success');
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleNotifs = async (enabled: boolean) => {
    triggerHaptic('selection');
    setNotifPrefs((prev: any) => ({ ...prev, enabled }));
    try {
      await api.updateNotificationPrefs({ enabled });
    } catch (e) {
      console.error('Failed to update notifications', e);
    }
  };

  const pct = teamGoal ? Math.min(100, Math.round((teamGoal.current_score / teamGoal.target_score) * 100)) : 0;
  const botName = 'NeonOrbitBot';
  const refLink = `https://t.me/${botName}?startapp=ref_${localStorage.getItem('telegram_id') || '123'}`;

  return (
    <KokonutModal
      isOpen={isOpen}
      onClose={onClose}
      title={lang === 'ru' ? 'Вирусный Штаб' : 'Viral Hub'}
      icon={<Share2 className="w-5 h-5 text-[#ff007f]" />}
      maxWidth="md"
    >
      <div className="flex flex-col gap-3">
        {/* Kokonut Segmented Tabs */}
        <KokonutTabs
          tabs={[
            { id: 'team', label: lang === 'ru' ? 'Флот' : 'Fleet', icon: <Users className="w-3.5 h-3.5" /> },
            { id: 'referrals', label: lang === 'ru' ? 'Друзья' : 'Squad', icon: <Sparkles className="w-3.5 h-3.5" /> },
            { id: 'challenge', label: lang === 'ru' ? 'Вызов' : 'Challenge', icon: <Trophy className="w-3.5 h-3.5" /> },
            { id: 'notifs', label: lang === 'ru' ? 'Алерты' : 'Alerts', icon: <Bell className="w-3.5 h-3.5" /> },
          ]}
          activeTab={activeTab}
          onChange={(t) => setActiveTab(t as any)}
          layoutId="viralHubTabPill"
        />

        {/* Tab 1: Team Goal */}
        {activeTab === 'team' && teamGoal && (
          <KokonutCard variant="glow" hoverEffect={false} className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="font-pixel text-xs text-[#00f5d4] font-bold">
                {lang === 'ru' ? 'Общая Космическая Цель' : 'Global Fleet Goal'}
              </h4>
              <KokonutBadge variant="gold" size="sm">
                +{teamGoal.reward_stardust} STARDUST
              </KokonutBadge>
            </div>

            <p className="text-xs text-gray-300 font-sans">
              {lang === 'ru' ? teamGoal.title : teamGoal.title}
            </p>

            <KokonutProgress value={pct} showLabel={true} label={`${teamGoal.current_score.toLocaleString()} / ${teamGoal.target_score.toLocaleString()}`} />
          </KokonutCard>
        )}

        {/* Tab 2: Referrals */}
        {activeTab === 'referrals' && (
          <KokonutCard variant="glow" hoverEffect={false} className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-pixel text-xs text-white font-bold">
                {lang === 'ru' ? 'Приглашённые Пилоты' : 'Invited Squad'}
              </span>
              <KokonutBadge variant="cyan" size="sm">
                {referrals?.referralsCount || 0} {lang === 'ru' ? 'Друзей' : 'Friends'}
              </KokonutBadge>
            </div>

            <KokonutInput
              value={refLink}
              readOnly
              rightIcon={
                <KokonutButton
                  variant="glow"
                  size="sm"
                  onClick={() => handleCopyLink(refLink)}
                  icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                >
                  {copied ? 'COPIED' : 'COPY'}
                </KokonutButton>
              }
            />
          </KokonutCard>
        )}

        {/* Tab 3: Challenge */}
        {activeTab === 'challenge' && (
          <KokonutCard variant="glow" hoverEffect={false} className="p-4 flex flex-col gap-3 text-center">
            <span className="font-pixel text-xs text-[#00f5d4] font-bold">
              {lang === 'ru' ? 'Вызови Друга на Космическую Дуэль' : 'Challenge a Friend to Duel'}
            </span>
            <p className="text-xs text-gray-300 font-sans">
              {lang === 'ru' ? `Ваш счёт: ${lastScore}` : `Your score: ${lastScore}`}
            </p>

            {challengeLink ? (
              <KokonutInput
                value={challengeLink}
                readOnly
                rightIcon={
                  <KokonutButton
                    variant="glow"
                    size="sm"
                    onClick={() => handleCopyLink(challengeLink)}
                    icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  >
                    {copied ? 'COPIED' : 'COPY'}
                  </KokonutButton>
                }
              />
            ) : (
              <KokonutButton
                variant="shimmer"
                size="lg"
                onClick={handleCreateChallenge}
                icon={<Trophy className="w-4 h-4" />}
                className="w-full"
              >
                {lang === 'ru' ? 'СОЗДАТЬ ССЫЛКУ ВЫЗОВА' : 'CREATE CHALLENGE LINK'}
              </KokonutButton>
            )}
          </KokonutCard>
        )}

        {/* Tab 4: Notifications */}
        {activeTab === 'notifs' && (
          <KokonutCard variant="glass" hoverEffect={false} className="p-4 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-pixel text-xs text-white font-bold">
                {lang === 'ru' ? 'Уведомления О Дейликах' : 'Daily Challenge Alerts'}
              </span>
              <span className="text-[10px] text-gray-400 font-sans mt-0.5">
                {lang === 'ru' ? 'Напоминания о наградах' : 'Reminders for daily rewards'}
              </span>
            </div>

            <KokonutButton
              variant={notifPrefs.enabled ? 'glow' : 'glass'}
              size="sm"
              onClick={() => handleToggleNotifs(!notifPrefs.enabled)}
            >
              {notifPrefs.enabled ? 'ON' : 'OFF'}
            </KokonutButton>
          </KokonutCard>
        )}
      </div>
    </KokonutModal>
  );
};
