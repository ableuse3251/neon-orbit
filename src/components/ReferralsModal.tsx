import React, { useState } from 'react';
import { Users, Gift, Share2, Copy, Check, Sparkles } from 'lucide-react';
import { PlayerProfile, ReferralTier } from '../types/game';
import { triggerHaptic } from '../utils/telegram';
import { getTranslation } from '../utils/i18n';
import { trackEvent } from '../utils/analytics';
import { KokonutModal, KokonutCard, KokonutInput, KokonutButton, KokonutBadge, KokonutProgress } from './ui/kokonut';

interface ReferralsModalProps {
  profile: PlayerProfile;
  onClaimTierReward: (tierLevel: number, rewardStardust: number, rewardShipId?: string) => void;
  onClose: () => void;
}

export const REFERRAL_TIERS: ReferralTier[] = [
  { level: 1, requiredInvites: 1, titleEn: 'Recruiter Cadet', titleRu: 'Кадет-Рекрутер', rewardStardust: 250 },
  { level: 2, requiredInvites: 5, titleEn: 'Fleet Commander', titleRu: 'Командор Эскадрильи', rewardStardust: 1000, rewardShipId: 'ship_neon_falcon' },
  { level: 3, requiredInvites: 20, titleEn: 'Cosmic Supreme', titleRu: 'Верховный Адмирал', rewardStardust: 5000 },
];

export const ReferralsModal: React.FC<ReferralsModalProps> = ({
  profile,
  onClaimTierReward,
  onClose,
}) => {
  const t = getTranslation(profile.lang);
  const [copied, setCopied] = useState(false);

  const refUrl = `https://t.me/Neon_orbitbot?startapp=ref_${profile.id}`;

  const handleCopyLink = () => {
    triggerHaptic('success');
    navigator.clipboard.writeText(refUrl);
    setCopied(true);
    trackEvent('invite_sent', { type: 'copy_link' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareInvite = () => {
    triggerHaptic('medium');
    trackEvent('invite_sent', { type: 'telegram_share' });
    const shareText = encodeURIComponent(
      profile.lang === 'ru'
        ? `🛸 Летим в Neon Orbit! Присоединяйся к моей космической эскадрилье и получи +250 Звёздной Пыли при старте!`
        : `🛸 Join my Neon Orbit starfleet! Tap to launch and claim +250 Stardust starter bonus!`
    );
    window.open(`https://t.me/share/url?url=${encodeURIComponent(refUrl)}&text=${shareText}`, '_blank');
  };

  return (
    <KokonutModal
      isOpen={true}
      onClose={onClose}
      title={profile.lang === 'ru' ? 'Реферальная Программа' : 'Referral Starfleet'}
      icon={<Users className="w-5 h-5 text-[#00f5d4]" />}
      badge={
        <KokonutBadge variant="gold" size="sm">
          {profile.referralsCount} {profile.lang === 'ru' ? 'Друзей' : 'Friends'}
        </KokonutBadge>
      }
      maxWidth="md"
    >
      <div className="flex flex-col gap-3">
        {/* Invited Stats Banner Card */}
        <KokonutCard variant="glow" hoverEffect={false} className="p-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-pixel uppercase">
              {profile.lang === 'ru' ? 'Приглашено Пилотов:' : 'Invited Pilots:'}
            </span>
            <span className="font-pixel text-2xl text-[#ffb703] text-glow-amber font-bold mt-0.5">
              {profile.referralsCount} {profile.lang === 'ru' ? 'Друзей' : 'Friends'}
            </span>
          </div>

          <KokonutBadge variant="cyan" size="md" icon={<Sparkles className="w-4 h-4" />}>
            +250 Stardust / friend
          </KokonutBadge>
        </KokonutCard>

        {/* Copy / Share Action Box */}
        <div className="flex flex-col gap-2">
          <KokonutInput
            value={refUrl}
            readOnly
            rightIcon={
              <KokonutButton
                variant="glow"
                size="sm"
                onClick={handleCopyLink}
                icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? 'COPIED' : 'COPY'}
              </KokonutButton>
            }
          />

          <KokonutButton
            variant="gradient"
            size="lg"
            onClick={handleShareInvite}
            icon={<Share2 className="w-4 h-4" />}
            className="w-full"
          >
            {profile.lang === 'ru' ? 'ОТПРАВИТЬ ПРИГЛАШЕНИЕ В TELEGRAM' : 'SHARE INVITATION IN TELEGRAM'}
          </KokonutButton>
        </div>

        {/* Tiers Rewards List */}
        <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1">
          {REFERRAL_TIERS.map((tier) => {
            const isClaimed = profile.claimedReferralTiers.includes(tier.level);
            const canClaim = profile.referralsCount >= tier.requiredInvites && !isClaimed;

            return (
              <KokonutCard
                key={tier.level}
                variant={canClaim ? 'glow' : 'glass'}
                hoverEffect={canClaim}
                className="p-3 flex items-center justify-between border"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-pixel text-xs text-white font-bold truncate">
                      {profile.lang === 'ru' ? tier.titleRu : tier.titleEn}
                    </h4>
                    <KokonutBadge variant="gold" size="sm">
                      {tier.requiredInvites} {profile.lang === 'ru' ? 'друзей' : 'invites'}
                    </KokonutBadge>
                  </div>
                  <p className="text-[10px] text-gray-400 font-sans mt-0.5">
                    Reward: +{tier.rewardStardust} Stardust
                  </p>
                </div>

                {isClaimed ? (
                  <KokonutBadge variant="glass" size="md" icon={<Check className="w-3.5 h-3.5 text-emerald-400" />}>
                    CLAIMED
                  </KokonutBadge>
                ) : canClaim ? (
                  <KokonutButton
                    variant="glow"
                    size="sm"
                    onClick={() => onClaimTierReward(tier.level, tier.rewardStardust, tier.rewardShipId)}
                    icon={<Gift className="w-3.5 h-3.5" />}
                  >
                    CLAIM
                  </KokonutButton>
                ) : (
                  <KokonutBadge variant="glass" size="md">
                    {profile.referralsCount}/{tier.requiredInvites}
                  </KokonutBadge>
                )}
              </KokonutCard>
            );
          })}
        </div>
      </div>
    </KokonutModal>
  );
};
