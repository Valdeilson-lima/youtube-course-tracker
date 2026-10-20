import { Course, UserSettings } from '../types';

const STORAGE_KEY_COURSES = 'tube_courses_v1';
const STORAGE_KEY_SETTINGS = 'tube_settings_v1';

export const DEFAULT_SETTINGS: UserSettings = {
  autoPlayNext: true,
  autoMarkCompleted: true,
  playbackRate: 1,
  youtubeApiKey: '',
};

export const INITIAL_DEMO_COURSES: Course[] = [
  {
    id: 'demo-js-starter',
    playlistId: 'PLntvgXM11X6pi7mWEEtKeAIecmB_G9vnx',
    title: 'Curso de JavaScript Moderno & ES6+',
    description: 'Aprenda os fundamentos e recursos modernos do JavaScript para desenvolvimento web.',
    channelTitle: 'Web Dev Academy',
    thumbnailUrl: 'https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?auto=format&fit=crop&w=800&q=80',
    category: 'JavaScript',
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    currentLessonId: 'W6NZfCO5SIk',
    lessons: [
      {
        id: 'W6NZfCO5SIk',
        title: '01 - Introdução ao JavaScript e Configuração do Ambiente',
        duration: '15:20',
        thumbnailUrl: 'https://img.youtube.com/vi/W6NZfCO5SIk/mqdefault.jpg',
        completed: true,
        lastPositionSeconds: 920,
        notes: 'Configuração do VSCode e extensões essenciais para dev JS.',
      },
      {
        id: 'PkZNo7MFNFg',
        title: '02 - Variáveis, Tipos de Dados e Operadores',
        duration: '22:15',
        thumbnailUrl: 'https://img.youtube.com/vi/PkZNo7MFNFg/mqdefault.jpg',
        completed: false,
        lastPositionSeconds: 120,
        notes: 'Diferença entre let, const e var.',
      },
      {
        id: 'hdI2bqOjy3c',
        title: '03 - Funções, Arrow Functions e Escopo',
        duration: '18:40',
        thumbnailUrl: 'https://img.youtube.com/vi/hdI2bqOjy3c/mqdefault.jpg',
        completed: false,
        lastPositionSeconds: 0,
      },
      {
        id: 'R8rmfD9Y5-c',
        title: '04 - Arrays, Métodos de Iteração (Map, Filter, Reduce)',
        duration: '26:50',
        thumbnailUrl: 'https://img.youtube.com/vi/R8rmfD9Y5-c/mqdefault.jpg',
        completed: false,
        lastPositionSeconds: 0,
      },
      {
        id: 'PoRJizFvM7s',
        title: '05 - Objetos, Desestruturação e Spread Operator',
        duration: '20:10',
        thumbnailUrl: 'https://img.youtube.com/vi/PoRJizFvM7s/mqdefault.jpg',
        completed: false,
        lastPositionSeconds: 0,
      },
      {
        id: 'vn3tm0quoqE',
        title: '06 - Promises e Async/Await na Prática',
        duration: '31:05',
        thumbnailUrl: 'https://img.youtube.com/vi/vn3tm0quoqE/mqdefault.jpg',
        completed: false,
        lastPositionSeconds: 0,
      },
    ],
  },
  {
    id: 'demo-git-github',
    playlistId: 'PLHz_AreHm4dm7ZULPAmadvjNdH6zkzpMB',
    title: 'Git e GitHub Essencial para Desenvolvedores',
    description: 'Aprenda controle de versão, commits, branches, pull requests e resolução de conflitos.',
    channelTitle: 'Dev Mastery',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?auto=format&fit=crop&w=800&q=80',
    category: 'Git & DevOps',
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    currentLessonId: '6Czd1Yetaac',
    lessons: [
      {
        id: '6Czd1Yetaac',
        title: '01 - O que é Git e Controle de Versão',
        duration: '12:30',
        thumbnailUrl: 'https://img.youtube.com/vi/6Czd1Yetaac/mqdefault.jpg',
        completed: true,
        lastPositionSeconds: 750,
      },
      {
        id: 'xEKo29OWOPk',
        title: '02 - Comandos Básicos: init, add, status e commit',
        duration: '19:45',
        thumbnailUrl: 'https://img.youtube.com/vi/xEKo29OWOPk/mqdefault.jpg',
        completed: true,
        lastPositionSeconds: 1185,
      },
      {
        id: 'IbSZ364L76w',
        title: '03 - Trabalhando com Branches e Merges',
        duration: '24:10',
        thumbnailUrl: 'https://img.youtube.com/vi/IbSZ364L76w/mqdefault.jpg',
        completed: false,
        lastPositionSeconds: 340,
      },
      {
        id: 'V9P34Z8wQ6M',
        title: '04 - Conectando ao GitHub: Push, Pull e Remote',
        duration: '18:55',
        thumbnailUrl: 'https://img.youtube.com/vi/V9P34Z8wQ6M/mqdefault.jpg',
        completed: false,
        lastPositionSeconds: 0,
      },
    ],
  },
];

export function loadCourses(): Course[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COURSES);
    if (!raw) {
      saveCourses(INITIAL_DEMO_COURSES);
      return INITIAL_DEMO_COURSES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_DEMO_COURSES;
  } catch (e) {
    console.error('Falha ao carregar cursos do localStorage:', e);
    return INITIAL_DEMO_COURSES;
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
