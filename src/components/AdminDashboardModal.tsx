import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  BarChart3,
  Users,
  CreditCard,
  Zap,
  Bell,
  Check,
  Search,
  AlertTriangle,
  RefreshCw,
  Ban,
  RotateCcw,
  Sparkles,
  Loader2,
  Lock,
  Send,
} from 'lucide-react';
import { AdminMetrics, PlayerAdminView, PaymentRecord, LiveEventConfig } from '../types/game';
import { triggerHaptic } from '../utils/telegram';
import { api, ApiError } from '../utils/api';

interface AdminDashboardModalProps {
  currentConfig: LiveEventConfig;
  onSaveConfig: (newConfig: LiveEventConfig) => void;
  onClose: () => void;
}

function safeNum(val: any, fallback = 0): number {
  if (val === null || val === undefined || val === 'unavailable' || val === '') return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  currentConfig,
  onSaveConfig,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'players' | 'payments' | 'liveops'>('metrics');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [players, setPlayers] = useState<PlayerAdminView[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [config, setConfig] = useState<LiveEventConfig>({ ...currentConfig });
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const loadMetrics = async () => {
    try {
      const res = await api.getAdminMetrics();
      setMetrics(res.metrics);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('⛔ Access Denied: Admin authorization required on server.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      }
    }
  };

  const loadPlayers = async (search: string = '') => {
    try {
      const res = await api.getAdminPlayers(search);
      setPlayers(res.players || []);
    } catch (err) {
      console.error('Error fetching admin players:', err);
    }
  };

  const loadPayments = async () => {
    try {
      const res = await api.getAdminPayments();
      setPayments(res.payments || []);
    } catch (err) {
      console.error('Error fetching admin payments:', err);
    }
  };

  const loadConfig = async () => {
    try {
      const res = await api.getAdminConfig();
      if (res && res.config) {
        setConfig(res.config);
      }
    } catch (err) {
      console.error('Error fetching admin config:', err);
    }
  };

  const loadTabData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'metrics') {
        await loadMetrics();
      } else if (activeTab === 'players') {
        await loadPlayers(searchQuery);
      } else if (activeTab === 'payments') {
        await loadPayments();
      } else if (activeTab === 'liveops') {
        await loadConfig();
      }
    } catch (err) {
      console.error('Tab data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadPlayers(searchQuery);
  };

  const handlePlayerAction = async (userId: string, action: 'ban' | 'unban' | 'shadow_ban' | 'unshadow_ban' | 'reset_score') => {
    triggerHaptic('warning');
    try {
      await api.performAdminPlayerAction(userId, action);
      setActionSuccessMsg(`Action '${action}' applied to player ${userId}`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
      loadPlayers(searchQuery);
    } catch (err) {
      console.error('Player action error:', err);
    }
  };

  const handleRefundPayment = async (chargeId: string) => {
    triggerHaptic('medium');
    try {
      await api.refundAdminPayment(chargeId);
      setActionSuccessMsg(`Refund issued for charge ${chargeId}`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
      loadPayments();
    } catch (err) {
      console.error('Refund error:', err);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    triggerHaptic('success');
    setBroadcasting(true);
    setBroadcastStatus(null);
    try {
      const res = await api.sendAdminBroadcast(broadcastMessage);
      setBroadcastStatus(`Broadcast complete! Sent to ${res.totalSent} players.`);
      setBroadcastMessage('');
    } catch (err) {
      setBroadcastStatus(`Broadcast failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBroadcasting(false);
    }
  };

  const handleSaveLiveOps = async () => {
    triggerHaptic('success');
    try {
      const res = await api.updateAdminConfig(config);
      if (res && res.config) {
        onSaveConfig(res.config);
      }
      setActionSuccessMsg('Live Ops configuration saved & synced to DB!');
      setTimeout(() => setActionSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Error saving Live Ops config:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-lg animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-xl bg-[#120a2e] border-2 border-[#ff007f] rounded-2xl p-3.5 sm:p-5 shadow-[0_0_40px_rgba(255,0,127,0.4)] flex flex-col gap-3 sm:gap-4 text-white max-h-[94vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#ff007f]/40 pb-2.5 sm:pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#ff007f]" />
            <h2 className="font-pixel text-[11px] sm:text-xs text-[#ff007f] uppercase tracking-wider">
              Neon Orbit Security & Admin Dashboard
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded bg-[#210b42] text-gray-400 hover:text-white">
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {actionSuccessMsg && (
          <div className="p-2.5 rounded-lg bg-[#00f5d4]/20 border border-[#00f5d4] text-[#00f5d4] text-xs font-pixel flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* 4 Category Tabs */}
        <div className="grid grid-cols-4 gap-1 bg-[#0b071e] p-1 rounded-xl border border-[#9d4edd]/30 shrink-0">
          <button
            onClick={() => { triggerHaptic('selection'); setActiveTab('metrics'); }}
            className={`py-1.5 sm:py-2 rounded-lg font-pixel text-[8px] sm:text-[9px] flex items-center justify-center gap-1 transition-all ${
              activeTab === 'metrics' ? 'bg-[#ff007f] text-white font-bold shadow-[0_0_10px_#ff007f]' : 'text-gray-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> METRICS
          </button>

          <button
            onClick={() => { triggerHaptic('selection'); setActiveTab('players'); }}
            className={`py-1.5 sm:py-2 rounded-lg font-pixel text-[8px] sm:text-[9px] flex items-center justify-center gap-1 transition-all ${
              activeTab === 'players' ? 'bg-[#ff007f] text-white font-bold shadow-[0_0_10px_#ff007f]' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> PLAYERS
          </button>

          <button
            onClick={() => { triggerHaptic('selection'); setActiveTab('payments'); }}
            className={`py-1.5 sm:py-2 rounded-lg font-pixel text-[8px] sm:text-[9px] flex items-center justify-center gap-1 transition-all ${
              activeTab === 'payments' ? 'bg-[#ff007f] text-white font-bold shadow-[0_0_10px_#ff007f]' : 'text-gray-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" /> PAYMENTS
          </button>

          <button
            onClick={() => { triggerHaptic('selection'); setActiveTab('liveops'); }}
            className={`py-1.5 sm:py-2 rounded-lg font-pixel text-[8px] sm:text-[9px] flex items-center justify-center gap-1 transition-all ${
              activeTab === 'liveops' ? 'bg-[#ff007f] text-white font-bold shadow-[0_0_10px_#ff007f]' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> LIVE OPS
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-300 text-xs font-pixel flex items-center gap-2">
            <Lock className="w-5 h-5 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 text-[#ff007f] animate-spin" />
            <span className="font-pixel text-xs text-[#ff007f] animate-pulse">FETCHING DATABASE DATA...</span>
          </div>
        ) : (
          <>
            {/* TAB 1: METRICS & REVENUE */}
            {activeTab === 'metrics' && metrics && (
              <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 max-h-[55vh]">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-[#0b071e] border border-[#ffb703] flex flex-col gap-1 shadow-[0_0_10px_rgba(255,183,3,0.2)]">
                    <span className="text-[10px] text-gray-400 font-pixel">STARS REVENUE (XTR)</span>
                    <span className="font-pixel text-2xl text-[#ffb703] font-bold">
                      {safeNum(metrics.totalStarsRevenue)} ⭐
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0b071e] border border-[#00f5d4] flex flex-col gap-1 shadow-[0_0_10px_rgba(0,245,212,0.2)]">
                    <span className="text-[10px] text-gray-400 font-pixel">DAU / WAU</span>
                    <span className="font-pixel text-xl text-[#00f5d4] font-bold">
                      {safeNum(metrics.dau).toLocaleString()} / {safeNum(metrics.wau).toLocaleString()}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0b071e] border border-[#9d4edd]/40 flex flex-col gap-1">
                    <span className="text-[10px] text-gray-400 font-pixel">RETENTION (D1/D7/D30)</span>
                    <span className="font-pixel text-xs text-white font-bold">
                      D1: {safeNum(metrics.retentionD1)}% | D7: {safeNum(metrics.retentionD7)}% | D30: {safeNum(metrics.retentionD30)}%
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0b071e] border border-[#9d4edd]/40 flex flex-col gap-1">
                    <span className="text-[10px] text-gray-400 font-pixel">K-FACTOR & ARPDAU</span>
                    <span className="font-pixel text-xs text-[#00f5d4] font-bold">
                      K: {safeNum(metrics.kFactor)} | ARPDAU: {safeNum(metrics.arpdau)}⭐
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0b071e] border border-[#ff007f]/40 flex flex-col gap-1">
                    <span className="text-[10px] text-gray-400 font-pixel">AVG ROUNDS / SESSION</span>
                    <span className="font-pixel text-lg text-[#ff007f] font-bold">
                      {safeNum(metrics.avgRoundsPerSession)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0b071e] border border-[#ff007f]/40 flex flex-col gap-1">
                    <span className="text-[10px] text-gray-400 font-pixel">FIRST TAP &lt; 5s RATE</span>
                    <span className="font-pixel text-lg text-[#ff007f] font-bold">
                      {safeNum(metrics.firstTapWithin5sRate)}%
                    </span>
                  </div>
                </div>

                {/* Onboarding Funnel */}
                <div className="p-3 rounded-xl bg-[#0b071e] border border-[#9d4edd]/50 flex flex-col gap-2">
                  <span className="font-pixel text-[11px] text-[#00f5d4]">ONBOARDING FUNNEL</span>
                  <div className="flex flex-col gap-1.5 text-xs font-mono-tech">
                    <div className="flex justify-between items-center text-gray-300">
                      <span>1. App Open</span>
                      <span className="font-bold text-white">{safeNum(metrics.funnel?.appOpen)}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-300">
                      <span>2. First Tap</span>
                      <span className="font-bold text-white">{safeNum(metrics.funnel?.firstTap)}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-300">
                      <span>3. First Round</span>
                      <span className="font-bold text-white">{safeNum(metrics.funnel?.firstRound)}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-300">
                      <span>4. Second Round</span>
                      <span className="font-bold text-white">{safeNum(metrics.funnel?.secondRound)}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-300">
                      <span>5. Invite Friend</span>
                      <span className="font-bold text-[#00f5d4]">{safeNum(metrics.funnel?.inviteSent)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0b071e] border border-[#ff0054]/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-[#ff0054]">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-pixel text-xs">SUSPICIOUS / BANNED ACCOUNTS</span>
                  </div>
                  <span className="font-pixel text-lg text-[#ff0054] font-bold">
                    {safeNum(metrics.flaggedAutoclickersCount)}
                  </span>
                </div>
              </div>
            )}

            {/* TAB 2: PLAYERS & SHADOW-BANS */}
            {activeTab === 'players' && (
              <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 max-h-[55vh]">
                <form onSubmit={handleSearch} className="flex items-center gap-2 bg-[#0b071e] border border-[#9d4edd]/40 rounded-xl p-2 text-xs">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search player username, name, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent outline-none flex-1 text-white font-mono-tech text-xs"
                  />
                  <button type="submit" className="px-2.5 py-1 bg-[#9d4edd]/30 text-[#00f5d4] rounded font-pixel text-[10px]">
                    SEARCH
                  </button>
                </form>

                <div className="flex flex-col gap-2">
                  {players.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-xs font-pixel">No players found in database.</div>
                  ) : (
                    players.map((player) => (
                      <div
                        key={player.id}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                          player.isShadowBanned || player.isBanned
                            ? 'bg-[#ff0054]/15 border-[#ff0054]'
                            : 'bg-[#0b071e] border-[#9d4edd]/30'
                        }`}
                      >
                        <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                          <span className="font-bold text-white flex items-center gap-2 truncate">
                            {player.firstName} (@{player.username})
                            {player.isShadowBanned && (
                              <span className="px-1.5 py-0.5 rounded bg-[#ff0054] text-white font-pixel text-[8px] shrink-0">
                                SHADOW-BANNED
                              </span>
                            )}
                            {player.isBanned && (
                              <span className="px-1.5 py-0.5 rounded bg-red-800 text-white font-pixel text-[8px] shrink-0">
                                BANNED
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            Score: {player.highScore.toLocaleString()} | Level {player.level} | Stardust: {player.stardust}
                          </span>
                          <span className="text-[9px] text-gray-500">
                            Rounds: {player.totalRounds} | Last active: {player.lastActiveISO.slice(0, 10)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handlePlayerAction(player.id, player.isShadowBanned ? 'unshadow_ban' : 'shadow_ban')}
                            className={`px-2.5 py-1.5 rounded font-pixel text-[9px] font-bold ${
                              player.isShadowBanned
                                ? 'bg-[#00f5d4] text-[#0b071e]'
                                : 'bg-[#ff0054] text-white'
                            }`}
                          >
                            {player.isShadowBanned ? 'UN-SHADOW' : 'SHADOW BAN'}
                          </button>

                          <button
                            onClick={() => handlePlayerAction(player.id, 'reset_score')}
                            className="px-2 py-1.5 rounded bg-gray-800 border border-gray-700 hover:bg-gray-700 text-yellow-400 font-pixel text-[9px]"
                            title="Reset score"
                          >
                            RESET
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: PAYMENTS & REFUNDS */}
            {activeTab === 'payments' && (
              <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 max-h-[55vh]">
                {payments.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-xs font-pixel">No payment records found.</div>
                ) : (
                  payments.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-[#0b071e] border border-[#ffb703]/30 flex items-center justify-between text-xs"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-pixel text-xs text-white">
                          {p.username} — {p.amountStars} ⭐
                        </span>
                        <span className="text-[10px] text-gray-400 truncate">
                          Item: {p.itemId} | Charge: <code className="text-[#00f5d4]">{p.chargeId}</code>
                        </span>
                        <span className="text-[9px] text-gray-500">{p.timestampISO.slice(0, 16)}</span>
                      </div>

                      {p.status === 'REFUNDED' ? (
                        <span className="px-2.5 py-1 bg-gray-800 text-gray-400 rounded font-pixel text-[9px] shrink-0">
                          REFUNDED
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRefundPayment(p.chargeId)}
                          className="px-2.5 py-1 bg-[#ff0054] hover:bg-[#ff0054]/90 text-white rounded font-pixel text-[9px] font-bold shrink-0"
                        >
                          REFUND
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 4: LIVE OPS & PUSH BROADCAST */}
            {activeTab === 'liveops' && (
              <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 max-h-[55vh]">
                <div className="p-3.5 rounded-xl bg-[#0b071e] border border-[#ffb703]/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="w-6 h-6 text-[#ffb703] fill-[#ffb703] animate-pulse" />
                    <div className="flex flex-col">
                      <span className="font-pixel text-xs text-white">GOLDEN HOUR x2 SURGE</span>
                      <span className="text-[10px] text-gray-400">Applies x2 Score Multiplier to all rounds</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      triggerHaptic('selection');
                      setConfig((prev) => ({ ...prev, isGoldenHourActive: !prev.isGoldenHourActive }));
                    }}
                    className={`px-3 py-1.5 rounded-lg font-pixel text-xs font-bold transition-all ${
                      config.isGoldenHourActive
                        ? 'bg-[#ffb703] text-[#0b071e] shadow-[0_0_10px_#ffb703]'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}
                  >
                    {config.isGoldenHourActive ? 'ACTIVE (x2)' : 'OFF'}
                  </button>
                </div>

                <div className="flex flex-col gap-2 text-xs">
                  <label className="text-[10px] font-pixel text-[#00f5d4] uppercase">Event Title (RU)</label>
                  <input
                    type="text"
                    value={config.titleRu || ''}
                    onChange={(e) => setConfig({ ...config, titleRu: e.target.value })}
                    className="p-2.5 rounded-lg bg-[#0b071e] border border-[#9d4edd]/40 text-white outline-none font-mono-tech"
                  />

                  <label className="text-[10px] font-pixel text-[#00f5d4] uppercase">Event Subtitle (RU)</label>
                  <input
                    type="text"
                    value={config.bannerSubtitleRu || ''}
                    onChange={(e) => setConfig({ ...config, bannerSubtitleRu: e.target.value })}
                    className="p-2.5 rounded-lg bg-[#0b071e] border border-[#9d4edd]/40 text-white outline-none font-mono-tech"
                  />
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-[#9d4edd]/30">
                  <label className="text-[10px] font-pixel text-[#00f5d4] uppercase flex items-center gap-1">
                    <Send className="w-3.5 h-3.5" />
                    <span>Broadcast Push Message (Telegram Bot Rate Limit ~25 msgs/sec)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Enter broadcast text for players..."
                    className="p-2.5 rounded-lg bg-[#0b071e] border border-[#9d4edd]/40 text-white outline-none font-mono-tech text-xs"
                  />
                  <button
                    disabled={broadcasting || !broadcastMessage.trim()}
                    onClick={handleSendBroadcast}
                    className={`py-2.5 bg-[#210b42] border border-[#ffb703] text-[#ffb703] font-pixel text-xs rounded-xl hover:bg-[#ffb703] hover:text-[#0b071e] font-bold flex items-center justify-center gap-2 ${
                      broadcasting ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {broadcasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                    <span>{broadcasting ? 'SENDING BROADCAST...' : 'SEND BROADCAST PUSH'}</span>
                  </button>
                  {broadcastStatus && (
                    <span className="text-[10px] font-pixel text-[#00f5d4]">{broadcastStatus}</span>
                  )}
                </div>

                <button
                  onClick={handleSaveLiveOps}
                  className="w-full py-3 bg-[#ff007f] text-white font-pixel text-xs rounded-xl font-bold hover:bg-[#ff007f]/90 mt-1 shadow-[0_0_15px_#ff007f]"
                >
                  SAVE LIVE OPS CONFIG TO DB
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
