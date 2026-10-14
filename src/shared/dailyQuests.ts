export interface DailyQuestDefinition {
  id: string;
  titleEn: string;
  titleRu: string;
  descEn: string;
  descRu: string;
  type: "rounds" | "score" | "combo" | "targets" | "beacon" | "daily_challenge";
  targetValue: number;
  rewardDust: number;
  rewardXp: number;
  icon: string;
}

export const DAILY_QUESTS_POOL: DailyQuestDefinition[] = [
  {
    id: "quest_rounds_3",
    titleEn: "Play 3 Arcade Rounds",
    titleRu: "Сыграйте 3 аркадных раунда",
    descEn: "Launch into orbit and complete 3 full arcade rounds.",
    descRu: "Выйдите на орбиту и завершите 3 полных аркадных раунда.",
    type: "rounds",
    targetValue: 3,
    rewardDust: 50,
    rewardXp: 100,
    icon: "🛸",
  },
  {
    id: "quest_score_4000",
    titleEn: "Score 4,000 Points",
    titleRu: "Наберите 4,000 очков",
    descEn: "Score at least 4,000 points in a single round.",
    descRu: "Наберите не менее 4,000 очков за один раунд.",
    type: "score",
    targetValue: 4000,
    rewardDust: 60,
    rewardXp: 120,
    icon: "🏆",
  },
  {
    id: "quest_score_8000",
    titleEn: "Score 8,000 Points",
    titleRu: "Наберите 8,000 очков",
    descEn: "Show pilot mastery and reach 8,000 points in a round.",
    descRu: "Покажите мастерство и наберите 8,000 очков за раунд.",
    type: "score",
    targetValue: 8000,
    rewardDust: 90,
    rewardXp: 180,
    icon: "⭐",
  },
  {
    id: "quest_combo_6",
    titleEn: "Achieve x6 Combo",
    titleRu: "Достигните комбо x6",
    descEn: "Maintain unbroken rhythm and reach x6 combo multiplier.",
    descRu: "Держите точный ритм и достигните комбо-множителя x6.",
    type: "combo",
    targetValue: 6,
    rewardDust: 50,
    rewardXp: 100,
    icon: "🔥",
  },
  {
    id: "quest_combo_12",
    titleEn: "Achieve x12 Combo",
    titleRu: "Достигните комбо x12",
    descEn: "Unleash blistering speed and hit x12 combo multiplier.",
    descRu: "Разгоните реакцию и достигните множителя x12.",
    type: "combo",
    targetValue: 12,
    rewardDust: 80,
    rewardXp: 160,
    icon: "⚡",
  },
  {
    id: "quest_targets_40",
    titleEn: "Hit 40 Cosmic Targets",
    titleRu: "Поразите 40 космических целей",
    descEn: "Tap and destroy 40 targets across your flights today.",
    descRu: "Поразите 40 космических целей за сегодняшние полёты.",
    type: "targets",
    targetValue: 40,
    rewardDust: 50,
    rewardXp: 100,
    icon: "🎯",
  },
  {
    id: "quest_targets_100",
    titleEn: "Hit 100 Cosmic Targets",
    titleRu: "Поразите 100 космических целей",
    descEn: "Demonstrate laser focus by hitting 100 targets today.",
    descRu: "Проявите точность и сбейте 100 целей за день.",
    type: "targets",
    targetValue: 100,
    rewardDust: 90,
    rewardXp: 180,
    icon: "💥",
  },
  {
    id: "quest_beacons_3",
    titleEn: "Collect 3 Gold Beacons",
    titleRu: "Соберите 3 золотых маяка",
    descEn: "Catch 3 rare golden navigation beacons during flight.",
    descRu: "Поймайте 3 редких золотых маяка во время полёта.",
    type: "beacon",
    targetValue: 3,
    rewardDust: 70,
    rewardXp: 140,
    icon: "🌟",
  },
  {
    id: "quest_daily_challenge_1",
    titleEn: "Play Daily Challenge",
    titleRu: "Сыграйте Челлендж Дня",
    descEn: "Test your reflexes in today's seeded global challenge.",
    descRu: "Испытайте реакцию в ежедневном глобальном челлендже.",
    type: "daily_challenge",
    targetValue: 1,
    rewardDust: 75,
    rewardXp: 150,
    icon: "🔮",
  },
  {
    id: "quest_rounds_5",
    titleEn: "Complete 5 Arcade Rounds",
    titleRu: "Завершите 5 раундов",
    descEn: "Log 5 completed flights in the galactic flight recorder.",
    descRu: "Запишите 5 завершённых вылетов в бортовой журнал.",
    type: "rounds",
    targetValue: 5,
    rewardDust: 80,
    rewardXp: 160,
    icon: "🚀",
  },
];

export function getTodayUtcDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function getDailyQuestsForDate(dateStr: string): DailyQuestDefinition[] {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash);
  const pool = [...DAILY_QUESTS_POOL];
  const selected: DailyQuestDefinition[] = [];

  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const index = (seed + i * 3) % pool.length;
    selected.push(pool[index]);
    pool.splice(index, 1);
  }

  return selected;
}

export function getSecondsUntilUtcMidnight(): number {
  const now = new Date();
  const nextMidnightUtc = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return Math.max(0, Math.floor((nextMidnightUtc.getTime() - now.getTime()) / 1000));
}
