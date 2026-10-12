export interface StarsCatalogItem {
  id: string;
  titleEn: string;
  titleRu: string;
  descEn: string;
  descRu: string;
  priceStars: number;
  icon: string;
  type: 'bundle' | 'skin' | 'insurance' | 'stardust_pack';
  rewardStardustBonus?: number;
  rewardShipId?: string;
  rewardCosmeticId?: string;
}

export const STARS_CATALOG: StarsCatalogItem[] = [
  {
    id: 'bundle_synth_legend',
    titleEn: 'Cosmetic Premium Bundle',
    titleRu: 'Премиум Косметический Набор',
    descEn: 'Includes Plasma Crusher ship and +1,000 Stardust!',
    descRu: 'Включает корабль Плазменный Крушитель и +1,000 Пыли!',
    priceStars: 250,
    icon: '🎁',
    type: 'bundle',
    rewardStardustBonus: 1000,
    rewardShipId: 'ship_plasma_crusher',
  },
  {
    id: 'skin_plasma_crusher',
    titleEn: 'Legendary Plasma Crusher',
    titleRu: 'Легендарный Плазменный Крушитель',
    descEn: 'Exclusive dreadnought skin with solar core particle aura.',
    descRu: 'Эксклюзивный скин дредноута с аурой солнечных частиц.',
    priceStars: 100,
    icon: '👑',
    type: 'skin',
    rewardShipId: 'ship_plasma_crusher',
  },
  {
    id: 'streak_shield',
    titleEn: 'Streak Insurance (Shield)',
    titleRu: 'Страховка Стрика',
    descEn: 'Protects your daily login streak from resetting if you miss a day.',
    descRu: 'Защищает ваш ежедневный стрик от сброса при пропуске дня.',
    priceStars: 50,
    icon: '🛡️',
    type: 'insurance',
  },
  {
    id: 'stardust_vault_2500',
    titleEn: 'Stardust Mega-Vault',
    titleRu: 'Сундук Звёздной Пыли',
    descEn: '+2,500 Stardust to unlock any cosmetics in the hangar immediately!',
    descRu: '+2,500 Звёздной Пыли для моментальной покупки любых фонов и рамок!',
    priceStars: 75,
    icon: '🌟',
    type: 'stardust_pack',
    rewardStardustBonus: 2500,
  },
  {
    id: 'season_pass_paid',
    titleEn: 'Season Pass Premium',
    titleRu: 'Премиум Сезонный Пропуск',
    descEn: 'Unlocks VIP tier rewards across the active season pass.',
    descRu: 'Открывает VIP награды активного сезонного пропуска.',
    priceStars: 250,
    icon: '🌌',
    type: 'bundle',
  },
];

export function getStarsCatalogItem(itemId: string): StarsCatalogItem | undefined {
  return STARS_CATALOG.find((item) => item.id === itemId);
}
