import { Achievement } from '../types/game';

export const ACHIEVEMENTS_LIST: Achievement[] = [
  // Combat & Taps (1-8)
  { id: 'first_blood', titleEn: 'First Orbit', titleRu: 'Первая Орбита', descEn: 'Complete your first 45s round.', descRu: 'Завершите свой первый 45-секундный раунд.', icon: '🛸', category: 'combat', targetValue: 1, rewardStardust: 50, rewardXp: 100 },
  { id: 'tap_100', titleEn: 'Laser Precision', titleRu: 'Лазерная Точность', descEn: 'Hit 100 cosmic targets.', descRu: 'Поразите 100 космических целей.', icon: '🎯', category: 'combat', targetValue: 100, rewardStardust: 100, rewardXp: 200 },
  { id: 'tap_500', titleEn: 'Orbital Tap Master', titleRu: 'Мастер Орбитального Тапа', descEn: 'Hit 500 cosmic targets.', descRu: 'Поразите 500 космических целей.', icon: '⚡', category: 'combat', targetValue: 250, rewardStardust: 250, rewardXp: 450 },
  { id: 'beacon_5', titleEn: 'Beacon Seeker', titleRu: 'Искатель Маяков', descEn: 'Hit 5 Golden Beacons.', descRu: 'Поразите 5 золотых маяков.', icon: '🌟', category: 'combat', targetValue: 5, rewardStardust: 150, rewardXp: 300 },
  { id: 'beacon_25', titleEn: 'Beacon Master', titleRu: 'Властелин Маяков', descEn: 'Hit 25 Golden Beacons.', descRu: 'Поразите 25 золотых маяков.', icon: '💫', category: 'combat', targetValue: 25, rewardStardust: 400, rewardXp: 800 },
  { id: 'mine_dodge', titleEn: 'Mine Sweeper', titleRu: 'Сапёр Галактики', descEn: 'Survive a round without hitting any Red Mines.', descRu: 'Завершите раунд, не задев ни одной красной мины.', icon: '💣', category: 'combat', targetValue: 1, rewardStardust: 200, rewardXp: 350 },
  { id: 'comet_hunter', titleEn: 'Comet Chaser', titleRu: 'Ловец Комет', descEn: 'Hit 20 swift cyan comets.', descRu: 'Поразите 20 быстрых голубых комет.', icon: '☄️', category: 'combat', targetValue: 20, rewardStardust: 180, rewardXp: 320 },
  { id: 'supernova_user', titleEn: 'Supernova Blast', titleRu: 'Взрыв Сверхновой', descEn: 'Trigger the Supernova powerup.', descRu: 'Активируйте бонус Сверхновой.', icon: '💥', category: 'combat', targetValue: 1, rewardStardust: 150, rewardXp: 250 },

  // Combos & Multipliers (9-16)
  { id: 'combo_5', titleEn: 'Double Energy', titleRu: 'Двойная Энергия', descEn: 'Reach x2 Combo Multiplier.', descRu: 'Достигните комбо-множителя x2.', icon: '🔥', category: 'combo', targetValue: 5, rewardStardust: 80, rewardXp: 150 },
  { id: 'combo_12', titleEn: 'Triple Core', titleRu: 'Тройное Ядро', descEn: 'Reach x3 Combo Multiplier.', descRu: 'Достигните комбо-множителя x3.', icon: '⚡', category: 'combo', targetValue: 12, rewardStardust: 160, rewardXp: 300 },
  { id: 'combo_20', titleEn: 'HYPERMODE!', titleRu: 'ГИПЕРРЕЖИМ!', descEn: 'Reach maximum x5 HYPERMODE Multiplier!', descRu: 'Достигните максимального комбо-множителя x5 ГИПЕРРЕЖИМ!', icon: '🚀', category: 'combo', targetValue: 20, rewardStardust: 350, rewardXp: 600 },
  { id: 'accuracy_80', titleEn: 'Sharpshooter', titleRu: 'Снайпер', descEn: 'Finish a round with over 80% accuracy.', descRu: 'Завершите раунд с точностью выше 80%.', icon: '🎯', category: 'combo', targetValue: 80, rewardStardust: 200, rewardXp: 400 },
  { id: 'accuracy_95', titleEn: 'Godlike Precision', titleRu: 'Абсолютная Точность', descEn: 'Finish a round with over 95% accuracy.', descRu: 'Завершите раунд с точностью выше 95%.', icon: '👑', category: 'combo', targetValue: 95, rewardStardust: 500, rewardXp: 1000 },
  { id: 'score_5k', titleEn: 'Star Cadet', titleRu: 'Звёздный Кадет', descEn: 'Score 5,000 points in a single round.', descRu: 'Наберите 5,000 очков за один раунд.', icon: '🏆', category: 'combo', targetValue: 5000, rewardStardust: 200, rewardXp: 400 },
  { id: 'score_10k', titleEn: 'Cosmic Legend', titleRu: 'Космическая Легенда', descEn: 'Score 10,000 points in a single round.', descRu: 'Наберите 10,000 очков за один раунд.', icon: '🥇', category: 'combo', targetValue: 10000, rewardStardust: 500, rewardXp: 1000 },
  { id: 'score_15k', titleEn: 'Fleet Hero', titleRu: 'Герой Флота', descEn: 'Score 15,000 points in a single round.', descRu: 'Наберите 15,000 очков за один раунд.', icon: '🪐', category: 'combo', targetValue: 15000, rewardStardust: 1000, rewardXp: 2000 },

  // Veteran & Rounds (17-24)
  { id: 'rounds_5', titleEn: 'Frequent Flyer', titleRu: 'Частый Гость', descEn: 'Complete 5 total rounds.', descRu: 'Завершите 5 раундов.', icon: '🛸', category: 'veteran', targetValue: 5, rewardStardust: 100, rewardXp: 200 },
  { id: 'rounds_20', titleEn: 'Cosmic Veteran', titleRu: 'Ветеран Космоса', descEn: 'Complete 20 total rounds.', descRu: 'Завершите 20 раундов.', icon: '🎖️', category: 'veteran', targetValue: 20, rewardStardust: 300, rewardXp: 600 },
  { id: 'rounds_50', titleEn: 'Starfighter Ace', titleRu: 'Асс Истребителя', descEn: 'Complete 50 total rounds.', descRu: 'Завершите 50 раундов.', icon: '🛡️', category: 'veteran', targetValue: 50, rewardStardust: 800, rewardXp: 1500 },
  { id: 'level_5', titleEn: 'Rank Up V', titleRu: 'Повышение V', descEn: 'Reach Pilot Level 5.', descRu: 'Достигните 5-го уровня пилота.', icon: '⭐', category: 'veteran', targetValue: 5, rewardStardust: 250, rewardXp: 500 },
  { id: 'level_15', titleEn: 'Rank Up XV', titleRu: 'Повышение XV', descEn: 'Reach Pilot Level 15.', descRu: 'Достигните 15-го уровня пилота.', icon: '🌟', category: 'veteran', targetValue: 15, rewardStardust: 600, rewardXp: 1200 },
  { id: 'level_30', titleEn: 'Rank Up XXX', titleRu: 'Повышение XXX', descEn: 'Reach Pilot Level 30.', descRu: 'Достигните 30-го уровня пилота.', icon: '✨', category: 'veteran', targetValue: 30, rewardStardust: 1200, rewardXp: 2500 },
  { id: 'ship_collector', titleEn: 'Hangar Customizer', titleRu: 'Коллекционер Ангара', descEn: 'Unlock 2 ship skins.', descRu: 'Разблокируйте 2 скина кораблей.', icon: '🚀', category: 'veteran', targetValue: 2, rewardStardust: 300, rewardXp: 500 },
  { id: 'backdrop_collector', titleEn: 'Space Explorer', titleRu: 'Исследователь Пространства', descEn: 'Unlock 2 backdrop themes.', descRu: 'Разблокируйте 2 темы фона.', icon: '🌌', category: 'veteran', targetValue: 2, rewardStardust: 300, rewardXp: 500 },

  // Streak & Social (25-30)
  { id: 'streak_3', titleEn: '3-Day Navigator', titleRu: '3 Дня в Орбите', descEn: 'Maintain a 3-day login streak.', descRu: 'Сохраняйте 3-дневную серию входов.', icon: '📅', category: 'streak', targetValue: 3, rewardStardust: 150, rewardXp: 300 },
  { id: 'streak_7', titleEn: 'Weekly Champion', titleRu: 'Чемпион Недели', descEn: 'Maintain a 7-day login streak.', descRu: 'Сохраняйте 7-дневную серию входов.', icon: '🗓️', category: 'streak', targetValue: 7, rewardStardust: 400, rewardXp: 800 },
  { id: 'streak_14', titleEn: 'Fortnight Navigator', titleRu: 'Двухнедельный Поход', descEn: 'Maintain a 14-day login streak.', descRu: 'Сохраняйте 14-дневную серию входов.', icon: '🔥', category: 'streak', targetValue: 14, rewardStardust: 800, rewardXp: 1600 },
  { id: 'streak_30', titleEn: 'Monthly Admiral', titleRu: 'Месячный Адмирал', descEn: 'Reach the ultimate 30-day login streak!', descRu: 'Достигните 30-дневной серии входов!', icon: '👑', category: 'streak', targetValue: 30, rewardStardust: 2000, rewardXp: 4000 },
  { id: 'daily_seed_play', titleEn: 'Daily Challenge Explorer', titleRu: 'Исследователь Дня', descEn: 'Play a Daily Seed Challenge.', descRu: 'Сыграйте в Ежедневный Челлендж.', icon: '🔮', category: 'streak', targetValue: 1, rewardStardust: 150, rewardXp: 250 },
  { id: 'friend_challenge', titleEn: 'Cosmic Rivalry', titleRu: 'Космическая Дуэль', descEn: 'Challenge a friend to beat your score.', descRu: 'Бросьте вызов другу на поединок.', icon: '⚔️', category: 'streak', targetValue: 1, rewardStardust: 200, rewardXp: 350 },
];
