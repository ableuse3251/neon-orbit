import React, { useState } from 'react';
import { X, Users, Gift, Share2, Copy, Check, ShieldCheck, Sparkles, Award } from 'lucide-react';
import { PlayerProfile, ReferralTier } from '../types/game';
import { triggerHaptic } from '../utils/telegram';
import { getTranslation } from '../utils/i18n';

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
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareInvite = () => {
    triggerHaptic('medium');
    const shareText = encodeURIComponent(
      profile.lang === 'ru'
        ? `🛸 Летим в Neon Orbit! Присоединяйся к моей космической эскадрилье и получи +250 Звёздной Пыли при старте!`
        : `🛸 Join my Neon Orbit starfleet! Tap to launch and claim +250 Stardust starter bonus!`
    );
    window.open(`https://t.me/share/url?url=${encodeURIComponent(refUrl)}&text=${shareText}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-md bg-[#120a2e] border-2 border-[#00f5d4] rounded-2xl p-3.5 sm:p-5 shadow-[0_0_35px_rgba(0,245,212,0.35)] flex flex-col gap-3 sm:gap-4 text-white max-h-[94vh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#00f5d4]/40 pb-2.5 sm:pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#00f5d4]" />
            <h2 className="font-pixel text-[11px] sm:text-xs text-[#00f5d4] uppercase tracking-wider">
              {profile.lang === 'ru' ? 'Реферальная Программа' : 'Referral Starfleet'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded bg-[#210b42] text-gray-400 hover:text-white">
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Invited Stats Card */}
        <div className="bg-[#0b071e] border border-[#00f5d4]/40 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-pixel uppercase">
              {profile.lang === 'ru' ? 'Приглашено Пилотов:' : 'Invited Pilots:'}
            </span>
            <span className="font-pixel text-2xl text-[#ffb703] text-glow-amber font-bold mt-0.5">
              {profile.referralsCount} {profile.lang === 'ru' ? 'Друзей' : 'Friends'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#210b42] px-3 py-1.5 rounded-full border border-[#00f5d4]/40 text-[#00f5d4] font-pixel text-xs">
            <Sparkles className="w-4 h-4" />
            <span>+250 Stardust / friend</span>
          </div>
        </div>

        {/* Invite Link Box */}
        <div className="flex items-center gap-2 bg-[#210b42] border border-[#00f5d4]/40 rounded-xl p-2 text-xs">
          <input
            type="text"
            readOnly
            value={refUrl}
            className="flex-1 bg-transparent text-gray-300 outline-none truncate font-mono-tech text-[11px] px-1"
          />
          <button
            onClick={handleCopyLink}
            className="p-2 bg-[#00f5d4] text-[#0b071e] font-bold rounded-lg hover:bg-[#00f5d4]/90 transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Tiers Rewards List */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 max-h-[35vh]">
          {REFERRAL_TIERS.map((tier) => {
            const isClaimed = profile.claimedReferralTiers.includes(tier.level);
            const canClaim = profile.referralsCount >= tier.requiredInvites && !isClaimed;
            const title = profile.lang === 'ru' ? tier.titleRu : tier.titleEn;

            return (
              <div
                key={tier.level}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                  isClaimed
                    ? 'bg-[#00f5d4]/10 border-[#00f5d4]'
                    : canClaim
                    ? 'bg-[#ff007f]/20 border-[#ff007f] animate-pulse'
                    : 'bg-[#0b071e] border-[#9d4edd]/25'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#210b42] border border-[#00f5d4]/30 flex items-center justify-center font-pixel text-xs text-[#00f5d4] font-bold">
                    T{tier.level}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-pixel text-xs text-white">{title}</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">
                      {tier.requiredInvites} {profile.lang === 'ru' ? 'приглашенных' : 'invites required'}
                    </span>
                    <span className="text-[9px] font-pixel text-[#ffb703] mt-1">
                      +{tier.rewardStardust} 🌟 Stardust {tier.rewardShipId ? '+ 🚀 Exclusive Skin' : ''}
                    </span>
                  </div>
                </div>

                {isClaimed ? (
                  <span className="px-3 py-1.5 bg-[#00f5d4] text-[#0b071e] font-pixel text-[9px] font-bold rounded-lg flex items-center gap-1">
                    <Check className="w-3 h-3" /> CLAIMED
                  </span>
                ) : (
                  <button
                    disabled={!canClaim}
                    onClick={() => {
                      triggerHaptic('success');
                      onClaimTierReward(tier.level, tier.rewardStardust, tier.rewardShipId);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-pixel text-[9px] font-bold ${
                      canClaim
                        ? 'bg-[#ff007f] hover:bg-[#ff007f]/90 text-white shadow-[0_0_10px_#ff007f]'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                    }`}
                  >
                    CLAIM
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Invite CTA Button */}
        <button
          onClick={handleShareInvite}
          className="w-full py-3.5 bg-[#00f5d4] text-[#0b071e] font-pixel text-xs rounded-xl font-bold hover:bg-[#00f5d4]/90 flex items-center justify-center gap-2 shadow-[0_0_15px_#00f5d4]"
        >
          <Share2 className="w-4 h-4" />
          <span>{profile.lang === 'ru' ? 'ПРИГЛАСИТЬ ДРУГА В ЭСКАДРИЛЬЮ' : 'INVITE FRIEND TO STARFLEET'}</span>
        </button>

        {/* Anti-Fraud Note */}
        <div className="p-2.5 rounded-lg bg-[#0b071e] border border-[#00f5d4]/20 flex items-center justify-center gap-2 text-[10px] text-gray-400 text-center font-mono-tech">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00f5d4]" />
          <span>Anti-Fraud System: Unique Telegram User ID & 1 completed round required.</span>
        </div>
      </div>
    </div>
  );
};
