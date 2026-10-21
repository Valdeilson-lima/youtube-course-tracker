export interface StudyStreakData {
  currentStreak: number;
  bestStreak: number;
  lastStudyDate: string; // Format "YYYY-MM-DD"
  todayLessonsCompleted: number;
  dailyGoal: number;
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
};

/**
 * Normaliza o streak verificando se o dia virou
 */
export function normalizeStreakDate(streak: StudyStreakData): StudyStreakData {
  const today = getTodayString();
  const yesterday = getYesterdayString();
  const data = { ...streak };

  if (data.lastStudyDate !== today) {
    if (data.lastStudyDate !== yesterday && data.lastStudyDate !== '') {
      data.currentStreak = 0;
    }
    data.todayLessonsCompleted = 0;
  }

  return data;
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
