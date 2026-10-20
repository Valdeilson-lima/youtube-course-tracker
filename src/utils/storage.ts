import { Course, UserSettings } from '../types';

const STORAGE_KEY_COURSES = 'tube_courses_v1';
const STORAGE_KEY_SETTINGS = 'tube_settings_v1';

export const DEFAULT_SETTINGS: UserSettings = {
  autoPlayNext: true,
  autoMarkCompleted: true,
  playbackRate: 1,
  youtubeApiKey: '',
};

export function loadCourses(): Course[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COURSES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Remove cursos demo gravados por versões anteriores do aplicativo.
    const courses = parsed.filter((course) => !String(course?.id || '').startsWith('demo-'));
    if (courses.length !== parsed.length) saveCourses(courses);
    return courses;
  } catch (e) {
    console.error('Falha ao carregar cursos do localStorage:', e);
    return [];
  }
}

export function saveCourses(courses: Course[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_COURSES, JSON.stringify(courses));
  } catch (e) {
    console.error('Falha ao salvar cursos no localStorage:', e);
  }
}

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Falha ao salvar configurações:', e);
  }
}
