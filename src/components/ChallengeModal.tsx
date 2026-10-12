import React, { useState } from 'react';
import { X, Share2, Copy, Check, Users } from 'lucide-react';
import { shareChallengeLink, triggerHaptic } from '../utils/telegram';
import { getTranslation, Language } from '../utils/i18n';

interface ChallengeModalProps {
  score: number;
  botUsername?: string;
  lang?: Language;
  onClose: () => void;
}

export const ChallengeModal: React.FC<ChallengeModalProps> = ({
  score,
  botUsername = 'Neon_orbitbot',
  lang = 'en',
  onClose,
}) => {
  const t = getTranslation(lang);
  const [copied, setCopied] = useState(false);
  const challengeId = `ch_${Date.now()}`;
  const challengeUrl = `https://t.me/${botUsername}?startapp=challenge_${challengeId}`;

  const handleCopyLink = () => {
    triggerHaptic('success');
    navigator.clipboard.writeText(challengeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareToTelegram = () => {
    triggerHaptic('medium');
    shareChallengeLink(botUsername, challengeId, score);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono-tech">
      <div className="relative w-full max-w-md bg-[#120a2e] border-2 border-[#9d4edd] rounded-xl p-5 shadow-[0_0_30px_rgba(157,78,221,0.3)] flex flex-col gap-4 text-white">
        <div className="flex items-center justify-between border-b border-[#9d4edd]/40 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#00f5d4]" />
            <h2 className="font-pixel text-xs text-[#00f5d4] uppercase tracking-wider">
              {t.challengeTitle}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-[#0b071e] border border-[#9d4edd]/30 rounded-lg p-4 text-center flex flex-col gap-2">
          <span className="text-xs text-gray-400 uppercase font-pixel">{t.scoreToBeat}</span>
          <span className="font-pixel text-3xl font-bold text-[#ffb703] text-glow-amber">
            {score.toLocaleString()} PTS
          </span>
          <p className="text-[11px] text-gray-300 mt-1">
            {t.challengeDesc}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#210b42] border border-[#9d4edd]/40 rounded-lg p-2 text-xs">
          <input
            type="text"
            readOnly
            value={challengeUrl}
            className="flex-1 bg-transparent text-gray-300 outline-none truncate font-mono-tech text-[11px]"
          />
          <button
            onClick={handleCopyLink}
            className="p-2 bg-[#9d4edd] text-white rounded hover:bg-[#00f5d4] hover:text-[#0b071e] transition-colors"
            title="Copy Link"
          >
            {copied ? <Check className="w-4 h-4 text-green-300" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <button
          onClick={handleShareToTelegram}
          className="w-full py-3.5 bg-[#ff007f] hover:bg-[#ff007f]/90 text-white font-pixel text-xs rounded-lg flex items-center justify-center gap-2 font-bold shadow-[0_0_15px_#ff007f]"
        >
          <Share2 className="w-4 h-4" />
          <span>{t.sendChatBtn}</span>
        </button>
      </div>
    </div>
  );
};
