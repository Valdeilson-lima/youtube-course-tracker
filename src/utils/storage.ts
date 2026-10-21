import { Course, UserSettings } from '../types';

export const DEFAULT_SETTINGS: UserSettings = {
  autoPlayNext: true,
  autoMarkCompleted: true,
  playbackRate: 1,
  youtubeApiKey: '',
  geminiModel: 'gemini-1.5-pro',
};

export function loadCourses(): Course[] {
  // A persistência agora é no banco de dados (Supabase)
  return [];
}

export function saveCourses(_courses: Course[]): void {
  // Desativado: dados são salvos diretamente no banco de dados
}

export function loadSettings(): UserSettings {
  try {
    const saved = localStorage.getItem('tubecourse_settings');
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem('tubecourse_settings', JSON.stringify(settings));
  } catch {}
}
