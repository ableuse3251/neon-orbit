import { PlayerProfile, ShipSkin, BackdropSkin } from '../types/game';

const PROFILE_KEY = 'neon_orbit_player_profile';

export const DEFAULT_SHIPS: ShipSkin[] = [
  {
    id: 'ship_cyber_wing',
    name: 'Cyber Wing',
    nameRu: 'Кибер Крыло',
    description: 'Standard issue synthwave starfighter.',
    priceStars: 0,
    priceStardust: 0,
    color: '#00F5D4',
    accentColor: '#9D4EDD',
    trailType: 'plasma',
    iconSvg: '<polygon points="12,2 22,22 12,17 2,22" fill="#00F5D4" stroke="#9D4EDD" stroke-width="2"/>',
    unlocked: true,
  },
  {
    id: 'ship_retro_shuttle',
    name: '80s Shuttle',
    nameRu: 'Ретро Шаттл',
    description: 'Vaporwave era explorer with magenta thrusters.',
    priceStars: 50,
    priceStardust: 500,
    color: '#FF007F',
    accentColor: '#FFB703',
    trailType: 'rainbow',
    iconSvg: '<polygon points="12,2 20,18 16,22 8,22 4,18" fill="#FF007F" stroke="#FFB703" stroke-width="2"/>',
    unlocked: false,
  },
  {
    id: 'ship_neon_falcon',
    name: 'Neon Falcon',
    nameRu: 'Неоновый Сокол',
    description: 'High velocity vessel with hyper-charged pulse engine.',
    priceStars: 100,
    priceStardust: 1200,
    color: '#FFB703',
    accentColor: '#00F5D4',
    trailType: 'gold',
    iconSvg: '<path d="M12 2 L22 14 L17 22 L12 18 L7 22 L2 14 Z" fill="#FFB703" stroke="#00F5D4" stroke-width="2"/>',
    unlocked: false,
  },
  {
    id: 'ship_plasma_crusher',
    name: 'Plasma Crusher',
    nameRu: 'Плазменный Крушитель',
    description: 'Heavy assault starship with crimson particle core.',
    priceStars: 250,
    priceStardust: 2500,
    color: '#FF0054',
    accentColor: '#7000FF',
    trailType: 'crimson',
    iconSvg: '<path d="M12 2 L23 10 L19 22 L12 15 L5 22 L1 10 Z" fill="#FF0054" stroke="#7000FF" stroke-width="2"/>',
    unlocked: false,
  },
];

export const DEFAULT_BACKDROPS: BackdropSkin[] = [
  {
    id: 'backdrop_synth_grid',
    name: 'Synth Horizon',
    nameRu: 'Синтвайв Горизонт',
    primaryColor: '#0B071E',
    secondaryColor: '#9D4EDD',
    gridColor: '#FF007F',
    unlocked: true,
    priceStars: 0,
    priceStardust: 0,
  },
  {
    id: 'backdrop_orion_nebula',
    name: 'Orion Nebula',
    nameRu: 'Туманность Ориона',
    primaryColor: '#050B14',
    secondaryColor: '#00F5D4',
    gridColor: '#00B4D8',
    unlocked: false,
    priceStars: 75,
    priceStardust: 600,
  },
  {
    id: 'backdrop_saturn_rings',
    name: 'Saturn Rings',
    nameRu: 'Кольца Сатурна',
    primaryColor: '#1A002C',
    secondaryColor: '#FFB703',
    gridColor: '#FB5607',
    unlocked: false,
    priceStars: 120,
    priceStardust: 1100,
  },
];

export const getInitialProfile = (telegramUser?: { id: number; first_name: string; username?: string; language_code?: string }): PlayerProfile => {
  const userIdStr = telegramUser ? String(telegramUser.id) : 'anon_player';

  const defaultProfile: PlayerProfile = {
    id: userIdStr,
    username: telegramUser?.username || telegramUser?.first_name || 'Pilot',
    firstName: telegramUser?.first_name || 'Pilot',
    level: 1,
    xp: 0,
    stardust: 150,
    highScore: 0,
    dailyHighScore: 0,
    totalRounds: 0,
    maxCombo: 0,
    bestAccuracy: 0,
    totalTargetsHit: 0,
    goldenBeaconsHit: 0,
    rankTitle: 'Pilot',

    // Equipped Cosmetics Defaults
    selectedShip: 'ship_cyber_wing',
    selectedTrail: 'trail_cyan_beam',
    selectedBackdrop: 'backdrop_synth_grid',
    selectedExplosion: 'exp_retro_burst',
    selectedFrame: 'frame_pilot_steel',
    selectedTheme: 'theme_classic_purple',

    // Unlocked Defaults
    unlockedShips: ['ship_cyber_wing', 'cyber_wing'],
    unlockedBackdrops: ['backdrop_synth_grid', 'synthwave_grid'],
    unlockedCosmetics: [
      'ship_cyber_wing',
      'trail_cyan_beam',
      'backdrop_synth_grid',
      'exp_retro_burst',
      'frame_pilot_steel',
      'theme_classic_purple',
    ],
    unlockedAchievements: [],
    claimedAchievements: [],

    // Social & Referrals
    referralCode: `ref_${userIdStr}`,
    referralsCount: 0,
    claimedReferralTiers: [],
    notificationsEnabled: true,
    hasCompletedOnboarding: false,

    hasStreakInsurance: false,
    starsBalance: 100,
    streakDays: 0,
    lastLoginDate: new Date().toISOString().split('T')[0],
    lastDailyClaimDate: '',
    isDailyRewardClaimedToday: false,
    lang: telegramUser?.language_code === 'ru' ? 'ru' : 'en',
    settings: {
      soundFx: true,
      music: true,
      volumeFx: 0.8,
      volumeMusic: 0.6,
      hapticsEnabled: true,
      crtIntensity: 'low',
      particleQuality: 'auto',
    },
  };

  const isRealTelegramUser = Boolean(telegramUser && telegramUser.id && telegramUser.id !== 888777666);

  if (typeof localStorage === 'undefined') {
    return {
      ...defaultProfile,
      isDemo: !isRealTelegramUser,
    };
  }

  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) {
      return {
        ...defaultProfile,
        isDemo: !isRealTelegramUser,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      ...defaultProfile,
      ...parsed,
      isDemo: isRealTelegramUser ? false : (parsed.isDemo ?? !isRealTelegramUser),
      level: parsed.level || 1,
      xp: parsed.xp || 0,
      totalRounds: parsed.totalRounds || 0,
      highScore: parsed.highScore || 0,
      dailyHighScore: parsed.dailyHighScore || 0,
      maxCombo: parsed.maxCombo || 0,
      bestAccuracy: parsed.bestAccuracy || 0,
      totalTargetsHit: parsed.totalTargetsHit || 0,
      goldenBeaconsHit: parsed.goldenBeaconsHit || 0,
      stardust: parsed.stardust ?? 150,
      hasStreakInsurance: parsed.hasStreakInsurance || false,
      referralCode: parsed.referralCode || `ref_${userIdStr}`,
      referralsCount: parsed.referralsCount || 0,
      claimedReferralTiers: parsed.claimedReferralTiers || [],
      notificationsEnabled: parsed.notificationsEnabled ?? true,
      selectedShip: parsed.selectedShip || 'ship_cyber_wing',
      selectedTrail: parsed.selectedTrail || 'trail_cyan_beam',
      selectedBackdrop: parsed.selectedBackdrop || 'backdrop_synth_grid',
      selectedExplosion: parsed.selectedExplosion || 'exp_retro_burst',
      selectedFrame: parsed.selectedFrame || 'frame_pilot_steel',
      unlockedCosmetics: parsed.unlockedCosmetics || defaultProfile.unlockedCosmetics,
      unlockedAchievements: parsed.unlockedAchievements || [],
      streakDays: Number(parsed.streakDays || 0),
      lastDailyClaimDate: parsed.lastDailyClaimDate || '',
      isDailyRewardClaimedToday: Boolean(parsed.lastDailyClaimDate && parsed.lastDailyClaimDate === new Date().toISOString().split('T')[0]),
      settings: {
        ...defaultProfile.settings,
        ...(parsed.settings || {}),
      },
    };
  } catch (err) {
    console.error('Failed to parse profile from storage:', err);
    return defaultProfile;
  }
};

export const saveProfile = (profile: PlayerProfile): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Failed to save profile:', err);
  }
};

export const getRankTitle = (highScore: number): 'Pilot' | 'Commander' | 'Fleet Admiral' => {
  if (highScore >= 15000) return 'Fleet Admiral';
  if (highScore >= 6000) return 'Commander';
  return 'Pilot';
};
