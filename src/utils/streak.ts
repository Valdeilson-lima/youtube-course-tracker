export interface StudyStreakData {
  currentStreak: number;
  bestStreak: number;
  lastStudyDate: string; // Format "YYYY-MM-DD"
  todayLessonsCompleted: number;
  dailyGoal: number;
  totalSecondsStudied: number;
  todaySecondsStudied: number;
  weeklySecondsStudied: number;
}

export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const DEFAULT_STREAK: StudyStreakData = {
  currentStreak: 1,
  bestStreak: 1,
  lastStudyDate: getTodayString(),
  todayLessonsCompleted: 0,
  dailyGoal: 2,
  totalSecondsStudied: 0,
  todaySecondsStudied: 0,
  weeklySecondsStudied: 0,
};

/**
 * Formata segundos em texto amigável (ex: "4h 25min" ou "45min")
 */
export function formatHoursAndMinutes(totalSeconds: number = 0): string {
  if (!totalSeconds || totalSeconds <= 0) return '0 min';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  }
  return `${Math.max(1, minutes)} min`;
}

/**
 * Normaliza o streak verificando se o dia virou
 */
export function normalizeStreakDate(streak: StudyStreakData): StudyStreakData {
  const today = getTodayString();
  const yesterday = getYesterdayString();
  const data = {
    ...DEFAULT_STREAK,
    ...streak,
  };

  if (data.lastStudyDate !== today) {
    if (data.lastStudyDate !== yesterday && data.lastStudyDate !== '') {
      data.currentStreak = 0;
    }
    data.todayLessonsCompleted = 0;
    data.todaySecondsStudied = 0;
  }

  return data;
}

/**
 * Adiciona tempo real estudado ao horímetro
 */
export function recordStudyTime(
  secondsToAdd: number,
  currentStreak: StudyStreakData = DEFAULT_STREAK
): StudyStreakData {
  if (secondsToAdd <= 0) return currentStreak;
  const normalized = normalizeStreakDate(currentStreak);
  const today = getTodayString();

  return {
    ...normalized,
    lastStudyDate: today,
    todaySecondsStudied: (normalized.todaySecondsStudied || 0) + secondsToAdd,
    totalSecondsStudied: (normalized.totalSecondsStudied || 0) + secondsToAdd,
    weeklySecondsStudied: (normalized.weeklySecondsStudied || 0) + secondsToAdd,
  };
}

/**
 * Calcula a próxima sequência de estudo ao concluir uma aula (função pura para persistência em banco)
 */
export function calculateNextStreak(currentStreakData: StudyStreakData): StudyStreakData {
  const normalized = normalizeStreakDate(currentStreakData);
  const today = getTodayString();
  const yesterday = getYesterdayString();
  const current = { ...normalized };

  if (current.lastStudyDate === today) {
    current.todayLessonsCompleted += 1;
  } else if (current.lastStudyDate === yesterday) {
    current.currentStreak += 1;
    current.todayLessonsCompleted = 1;
    current.lastStudyDate = today;
  } else {
    current.currentStreak = 1;
    current.todayLessonsCompleted = 1;
    current.lastStudyDate = today;
  }

  if (current.currentStreak > current.bestStreak) {
    current.bestStreak = current.currentStreak;
  }

  return current;
}

/**
 * Mantido para compatibilidade, inicializando os dados padrão
 */
export function getStudyStreak(): StudyStreakData {
  return DEFAULT_STREAK;
}

export function recordLessonCompleted(): StudyStreakData {
  return calculateNextStreak(DEFAULT_STREAK);
}

export function updateDailyGoal(newGoal: number, currentStreak: StudyStreakData = DEFAULT_STREAK): StudyStreakData {
  return {
    ...currentStreak,
    dailyGoal: Math.max(1, newGoal),
  };
}
