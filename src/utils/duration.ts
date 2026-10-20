import { Lesson } from '../types';

/**
 * Parses time strings into total seconds.
 * Supports:
 * - "MM:SS" (e.g. "14:20")
 * - "HH:MM:SS" (e.g. "01:15:30")
 * - ISO 8601 "PT#H#M#S" (e.g. "PT1H15M30S" or "PT14M20S")
 */
export function parseDurationToSeconds(durationStr?: string): number {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  const str = durationStr.trim();
  if (!str) return 0;

  // ISO 8601 format (PT1H20M15S)
  if (str.startsWith('PT') || str.startsWith('P')) {
    const hoursMatch = str.match(/(\d+)H/);
    const minsMatch = str.match(/(\d+)M/);
    const secsMatch = str.match(/(\d+)S/);

    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
    const mins = minsMatch ? parseInt(minsMatch[1], 10) : 0;
    const secs = secsMatch ? parseInt(secsMatch[1], 10) : 0;

    return hours * 3600 + mins * 60 + secs;
  }

  // "HH:MM:SS" or "MM:SS" format
  const parts = str.split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0];
  }

  return 0;
}

/**
 * Formats total seconds into a human friendly string like "2h 45m" or "35m".
 */
export function formatSecondsToHumanReadable(seconds: number): string {
  if (seconds <= 0) return '0m';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (hrs > 0) {
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
  return `${Math.max(1, mins)}m`;
}

export interface CourseTimeStats {
  totalSeconds: number;
  completedSeconds: number;
  remainingSeconds: number;
  hasDurations: boolean;
  totalFormatted: string;
  remainingFormatted: string;
}

/**
 * Calculates total, completed, and remaining estimated times for a course.
 */
export function calculateCourseTimeStats(lessons: Lesson[]): CourseTimeStats {
  let totalSeconds = 0;
  let completedSeconds = 0;
  let lessonsWithDuration = 0;

  for (const lesson of lessons) {
    const sec = parseDurationToSeconds(lesson.duration);
    if (sec > 0) {
      totalSeconds += sec;
      lessonsWithDuration++;
      if (lesson.completed) {
        completedSeconds += sec;
      }
    }
  }

  // If no lessons had parsed duration, estimate 12 minutes per lesson
  const hasDurations = lessonsWithDuration > 0;
  if (!hasDurations && lessons.length > 0) {
    const estimatedPerLessonSec = 12 * 60;
    totalSeconds = lessons.length * estimatedPerLessonSec;
    const completedCount = lessons.filter((l) => l.completed).length;
    completedSeconds = completedCount * estimatedPerLessonSec;
  }

  const remainingSeconds = Math.max(0, totalSeconds - completedSeconds);

  return {
    totalSeconds,
    completedSeconds,
    remainingSeconds,
    hasDurations,
    totalFormatted: formatSecondsToHumanReadable(totalSeconds),
    remainingFormatted: formatSecondsToHumanReadable(remainingSeconds),
  };
}
