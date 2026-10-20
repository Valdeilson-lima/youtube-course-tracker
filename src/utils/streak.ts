export interface StudyStreakData {
  currentStreak: number;
  bestStreak: number;
  lastStudyDate: string; // Format "YYYY-MM-DD"
  todayLessonsCompleted: number;
  dailyGoal: number;
}

const STREAK_STORAGE_KEY = 'yt_course_tracker_streak';

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DEFAULT_STREAK: StudyStreakData = {
  currentStreak: 1,
  bestStreak: 1,
  lastStudyDate: getTodayString(),
  todayLessonsCompleted: 0,
  dailyGoal: 2,
};

export function getStudyStreak(): StudyStreakData {
  try {
    const raw = localStorage.getItem(STREAK_STORAGE_KEY);
    if (!raw) return DEFAULT_STREAK;
    const data: StudyStreakData = JSON.parse(raw);

    const today = getTodayString();
    const yesterday = getYesterdayString();

    // Reset daily count if today is a new day
    if (data.lastStudyDate !== today) {
      // Check if streak was broken (missed yesterday)
      if (data.lastStudyDate !== yesterday) {
        data.currentStreak = 0;
      }
      data.todayLessonsCompleted = 0;
    }

    return data;
  } catch {
    return DEFAULT_STREAK;
  }
}

export function recordLessonCompleted(): StudyStreakData {
  try {
    const current = getStudyStreak();
    const today = getTodayString();
    const yesterday = getYesterdayString();

    if (current.lastStudyDate === today) {
      // Already studied today, just increment daily counter
      current.todayLessonsCompleted += 1;
    } else if (current.lastStudyDate === yesterday) {
      // Studied yesterday, streak continues!
      current.currentStreak += 1;
      current.todayLessonsCompleted = 1;
      current.lastStudyDate = today;
    } else {
      // Streak broken, start new streak of 1 day
      current.currentStreak = 1;
      current.todayLessonsCompleted = 1;
      current.lastStudyDate = today;
    }

    if (current.currentStreak > current.bestStreak) {
      current.bestStreak = current.currentStreak;
    }

    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(current));
    return current;
  } catch {
    return DEFAULT_STREAK;
  }
}

export function updateDailyGoal(newGoal: number): StudyStreakData {
  const current = getStudyStreak();
  current.dailyGoal = Math.max(1, newGoal);
  try {
    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(current));
  } catch {}
  return current;
}
