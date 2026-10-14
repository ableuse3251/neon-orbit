export type Language = 'en' | 'ru';

export const translations = {
  en: {
    // Title Menu
    appTitle: 'NEON ORBIT',
    tagline: 'RETRO COSMIC ARCADE',
    menuDesc: '45-second high-speed cosmic tap. Hit asteroids, build combos, dodge red mines!',
    startRound: 'START 45s ROUND',
    dailyChallenge: 'DAILY SEED CHALLENGE',
    equipped: 'EQUIPPED',

    // TopNav
    record: 'Record',
    hangarShop: 'Hangar',
    rankPilot: 'Pilot',
    rankCommander: 'Commander',
    rankAdmiral: 'Fleet Admiral',

    // HUD
    score: 'Score',
    combo: 'Combo',
    hypermode: 'HYPER',
    freezeActive: 'FREEZE',
    shieldActive: 'SHIELD',
    pause: 'Pause',

    // Flight Log Receipt
    flightLogTitle: 'Flight Log // Receipt',
    newRecord: 'NEW PERSONAL RECORD!',
    finalScore: 'Final Score',
    maxCombo: 'Max Combo',
    accuracy: 'Accuracy',
    hitsTaps: 'Hits / Taps',
    minesHit: 'Mines Hit',
    classification: 'Pilot Classification',
    playAgain: 'PLAY AGAIN',
    challengeFriend: 'CHALLENGE FRIEND',
    linkCopied: 'LINK COPIED!',
    leaderboardBtn: 'LEADERBOARD',
    toMainMenu: 'MAIN MENU',

    // Leaderboards
    rankingsTitle: 'Pilot Rankings',
    dailyTab: 'DAILY',
    globalTab: 'GLOBAL',
    friendsTab: 'FRIENDS',
    seasonText: 'Season 1: Neon Storm',
    endsIn: 'Active Season',
    youBadge: 'YOU',
    emptyLeaderboard: 'No scores recorded yet in this ranking. Play a round to claim rank #1!',
    hiddenBadge: 'HIDDEN',
    unranked: 'Unranked',

    // Cosmetics Shop
    hangarTitle: 'Cosmetic Hangar',
    shipsTab: 'SHIPS',
    backdropsTab: 'BACKDROPS',
    equippedBadge: 'EQUIPPED',
    equipBtn: 'EQUIP',
    activeBadge: 'ACTIVE',
    selectBtn: 'SELECT',
    needStars: 'Need Stars',

    // Challenge Modal
    challengeTitle: 'Challenge a Friend',
    scoreToBeat: 'Target Score To Beat',
    challengeDesc: 'Send this retro challenge link to a friend or Telegram group. They will play on the exact same cosmic target seed!',
    sendChatBtn: 'SEND DIRECT TO CHAT',

    // Daily Streak
    streakTitle: 'Daily Login Streak',
    currentStreak: 'Current Streak',
    daysInRow: 'DAYS IN A ROW',
    day: 'DAY',
    claimReward: "CLAIM TODAY'S REWARD",
    rewardStars: 'Stars',
    exclusiveSkin: '🔥 Exclusive Ship Skin',

    // Settings
    settingsTitle: 'Flight Computer Settings',
    audioTitle: 'Audio Output',
    soundFx: 'Sound FX',
    musicTrack: '80s Music',
    crtTitle: 'CRT Scanline Effect',
    crtOff: 'OFF',
    crtLow: 'RETRO',
    crtMax: 'MAX CRT',
    langTitle: 'Language / Язык',
    hideLeaderboard: 'Hide me from leaderboards',
    reduceMotion: 'Reduce Animations',
    haptics: 'Haptic Feedback',
    notifications: 'Flight Notifications',

    // Offline / Connection
    offlineTitle: 'SIGNAL LOST',
    offlineDesc: 'Cosmic link severed. Reconnecting to Starfleet telemetry network...',
    offlineRetry: 'RECONNECT',
    privacyTerms: 'Privacy Policy & Stars Terms',
  },
  ru: {
    // Title Menu
    appTitle: 'НЕОН ОРБИТА',
    tagline: 'РЕТРО КОСМИЧЕСКАЯ АРКАДА',
    menuDesc: '45-секундный космический кликер. Тапай по астероидам, лови комбо, избегай красных мин!',
    startRound: 'СТАРТ РАУНДА (45с)',
    dailyChallenge: 'ЕЖЕДНЕВНЫЙ ЧЕЛЛЕНДЖ',
    equipped: 'ВЫБРАНО',

    // TopNav
    record: 'Рекорд',
    hangarShop: 'Ангар',
    rankPilot: 'Пилот',
    rankCommander: 'Командор',
    rankAdmiral: 'Адмирал флота',

    // HUD
    score: 'Очки',
    combo: 'Комбо',
    hypermode: 'ГИПЕР',
    freezeActive: 'ЗАМОРОЗКА',
    shieldActive: 'ЩИТ',
    pause: 'Пауза',

    // Flight Log Receipt
    flightLogTitle: 'Бортовой Журнал // Чек',
    newRecord: 'НОВЫЙ ЛИЧНЫЙ РЕКОРД!',
    finalScore: 'Итоговый Счёт',
    maxCombo: 'Макс. Комбо',
    accuracy: 'Точность',
    hitsTaps: 'Попаданий / Тапов',
    minesHit: 'Мин Задето',
    classification: 'Звание Пилота',
    playAgain: 'ЕЩЁ РАЗ',
    challengeFriend: 'ВЫЗВАТЬ ДРУГА',
    linkCopied: 'ССЫЛКА СКОПИРОВАНА!',
    leaderboardBtn: 'РЕЙТИНГ',
    toMainMenu: 'В ГЛАВНОЕ МЕНЮ',

    // Leaderboards
    rankingsTitle: 'Таблица Лидеров',
    dailyTab: 'ДЕНЬ',
    globalTab: 'ГЛОБАЛЬНЫЙ',
    friendsTab: 'ДРУЗЬЯ',
    seasonText: 'Сезон 1: Неоновый Шторм',
    endsIn: 'Активный Сезон',
    youBadge: 'ВЫ',
    emptyLeaderboard: 'В этом рейтинге пока нет записей. Сыграйте раунд, чтобы стать #1!',
    hiddenBadge: 'СКРЫТ',
    unranked: 'Вне рейтинга',

    // Cosmetics Shop
    hangarTitle: 'Ангар Косметики',
    shipsTab: 'КОРАБЛИ',
    backdropsTab: 'ФОНЫ',
    equippedBadge: 'НА КОРМЕ',
    equipBtn: 'ВЫБРАТЬ',
    activeBadge: 'АКТИВЕН',
    selectBtn: 'ВКЛЮЧИТЬ',
    needStars: 'Нужно Stars',

    // Challenge Modal
    challengeTitle: 'Вызов Другу',
    scoreToBeat: 'Счёт для Победы',
    challengeDesc: 'Отправь эту ссылку другу или в чат Telegram. Он сыграет на точно таком же сиде астероидов!',
    sendChatBtn: 'ОТПРАВИТЬ В ЧАТ',

    // Daily Streak
    streakTitle: 'Серия Входов',
    currentStreak: 'Текущая Серия',
    daysInRow: 'ДНЕЙ ПОДРЯД',
    day: 'ДЕНЬ',
    claimReward: 'ЗАБРАТЬ НАГРАДУ',
    rewardStars: 'Звёзд',
    exclusiveSkin: '🔥 Эксклюзивный Скин',

    // Settings
    settingsTitle: 'Настройки Борткомпьютера',
    audioTitle: 'Аудио Выход',
    soundFx: 'Звуки FX',
    musicTrack: '80s Музыка',
    crtTitle: 'Эффект ЭЛТ Монитора',
    crtOff: 'ВЫКЛ',
    crtLow: 'РЕТРО',
    crtMax: 'МАКС ЭЛТ',
    langTitle: 'Язык / Language',
    hideLeaderboard: 'Скрыть меня из рейтингов',
    reduceMotion: 'Уменьшить анимации',
    haptics: 'Тактильная отдача',
    notifications: 'Уведомления вылетов',

    // Offline / Connection
    offlineTitle: 'СВЯЗЬ ПОТЕРЯНА',
    offlineDesc: 'Космический канал прерван. Переподключение к телеметрии...',
    offlineRetry: 'ПЕРЕПОДКЛЮЧИТЬСЯ',
    privacyTerms: 'Политика Конфиденциальности & Stars',
  },
};

export const getTranslation = (lang: Language = 'en') => {
  return translations[lang] || translations.en;
};
