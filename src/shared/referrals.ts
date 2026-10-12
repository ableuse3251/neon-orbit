export interface ReferralTier {
  level: number;
  requiredInvites: number;
  titleEn: string;
  titleRu: string;
  rewardStardust: number;
  rewardShipId?: string;
}

export const REFERRAL_TIERS: ReferralTier[] = [
  { level: 1, requiredInvites: 1, titleEn: 'Cadet Recruiter', titleRu: 'Рекрутер Кадет', rewardStardust: 300 },
  { level: 2, requiredInvites: 3, titleEn: 'Flight Leader', titleRu: 'Лидер Звена', rewardStardust: 1000 },
  { level: 3, requiredInvites: 5, titleEn: 'Squadron Commander', titleRu: 'Командир Эскадрильи', rewardStardust: 2500, rewardShipId: 'ship_retro_shuttle' },
  { level: 4, requiredInvites: 10, titleEn: 'Fleet Admiral', titleRu: 'Адмирал Флота', rewardStardust: 5000 },
];
