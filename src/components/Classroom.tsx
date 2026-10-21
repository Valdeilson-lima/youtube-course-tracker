import React, { useState, useEffect, useRef } from 'react';
import { Course, UserSettings } from '../types';
import { YouTubePlayer, YouTubePlayerHandle } from './YouTubePlayer';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { CourseCompletedModal } from './CourseCompletedModal';
import { fireLessonConfetti, fireCourseCompletedConfetti } from '../utils/confetti';
import { useToast } from '../context/ToastContext';
import { calculateCourseTimeStats } from '../utils/duration';
import { recordLessonCompleted } from '../utils/streak';
import { syncCoursePlaylist } from '../services/youtube';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  FileText,
  Clock,
  Sparkles,
  Search,
  Download,
  Flame,
  ListVideo,
  Play,
  Keyboard,
  RotateCcw,
  Trophy,
  Eye,
  Edit3,
  Tv,
  RefreshCw,
  Lightbulb,
  LightbulbOff,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}:${String(remMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

interface ParsedTimestamp {
  raw: string;
  label: string;
  seconds: number;
}

function extractTimestamps(text: string): ParsedTimestamp[] {
  if (!text) return [];
  const regex = /\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?/g;
  const list: ParsedTimestamp[] = [];
  const seen = new Set<number>();
  let match;

  while ((match = regex.exec(text)) !== null) {
    let secs = 0;
    let label = '';
    if (match[3] !== undefined) {
      // HH:MM:SS
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const s = parseInt(match[3], 10);
      secs = h * 3600 + m * 60 + s;
      label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    } else {
      // MM:SS
      const m = parseInt(match[1], 10);
      const s = parseInt(match[2], 10);
      secs = m * 60 + s;
      label = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    if (!seen.has(secs)) {
      seen.add(secs);
      list.push({ raw: match[0], label, seconds: secs });
    }
  }
  return list.sort((a, b) => a.seconds - b.seconds);
}

function renderTextWithClickableTimestamps(
  text: string,
  onSeek: (seconds: number) => void
): React.ReactNode {
  const regex = /(\[?\d{1,2}:\d{2}(?::\d{2})?\]?)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    const timeMatch = part.match(/\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?/);
    if (timeMatch) {
      let secs = 0;
      if (timeMatch[3] !== undefined) {
        secs = parseInt(timeMatch[1], 10) * 3600 + parseInt(timeMatch[2], 10) * 60 + parseInt(timeMatch[3], 10);
      } else {
        secs = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
      }
      return (
        <button
          key={index}
          type="button"
          onClick={() => onSeek(secs)}
          className="inline-flex items-center px-1.5 py-0.5 mx-0.5 text-xs font-mono font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded hover:bg-amber-500/30 transition cursor-pointer"
          title={`Pular para ${part}`}
        >
          {part}
        </button>
      );
    }
    return part;
  });
}

interface ClassroomProps {
  course: Course;
  settings: UserSettings;
  onBack: () => void;
  onUpdateCourse: (updatedCourse: Course) => void;
  onUpdateLessonProgress?: (
    courseId: string,
    lessonId: string,
    progress: Partial<import('../types').Lesson>
  ) => void;
}

export const Classroom: React.FC<ClassroomProps> = ({
  course,
  settings,
  onBack,
  onUpdateCourse,
  onUpdateLessonProgress,
}) => {
  const toast = useToast();
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const notesDebounceRef = useRef<any>(null);
  const positionDebounceRef = useRef<any>(null);

  // Always keep an up-to-date ref of course to prevent stale closures
  const courseRef = useRef<Course>(course);
  useEffect(() => {
    courseRef.current = course;
  }, [course]);

  const [activeLessonId, setActiveLessonId] = useState<string>(
    course.currentLessonId || course.lessons[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [lessonFilter, setLessonFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [activeTab, setActiveTab] = useState<'notes' | 'info'>('notes');
  const [mobileTab, setMobileTab] = useState<'video' | 'lessons' | 'notes'>('video');
  const [noteText, setNoteText] = useState('');
  const [notesViewMode, setNotesViewMode] = useState<'edit' | 'preview'>('edit');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(settings.playbackRate || 1);
  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(settings.autoPlayNext);

  // Theater Mode, Lights Off, Sidebar & Playlist Sync state
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isLightsOff, setIsLightsOff] = useState(false);
  const [isLessonsSidebarOpen, setIsLessonsSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tubecourse_sidebar_open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [isSyncingPlaylist, setIsSyncingPlaylist] = useState(false);

  // Toggle Lights Off (Cinema / Focus Mode)
  const toggleLights = () => {
    setIsLightsOff((prev) => {
      const next = !prev;
      if (next) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast.info('Luzes Apagadas', 'Modo Cinema ativado! Pressione Esc, D ou clique fora para acender.');
      } else {
        toast.info('Luzes Acesas', 'Modo normal restaurado.');
      }
      return next;
    });
  };

  // Toggle Lessons List Sidebar
  const toggleLessonsSidebar = () => {
    setIsLessonsSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tubecourse_sidebar_open', String(next));
      } catch {}
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setMobileTab(next ? 'lessons' : 'video');
      }
      toast.info(
        next ? 'Lista de Aulas Aberta' : 'Lista de Aulas Ocultada',
        next ? 'Visualizando índice completo de aulas.' : 'Foco expandido na área de vídeo. Pressione S para reabrir.'
      );
      return next;
    });
  };

  // Modals state
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState(false);

  // Current active lesson
  const activeLessonIndex = course.lessons.findIndex((l) => l.id === activeLessonId);
  const activeLesson = course.lessons[activeLessonIndex] || course.lessons[0];
  const nextLesson = course.lessons[activeLessonIndex + 1];

  // Sync noteText when activeLesson changes
  useEffect(() => {
    if (activeLesson) {
      setNoteText(activeLesson.notes || '');
    }
  }, [activeLessonId]);

  // Overall stats & time remaining
  const totalLessons = course.lessons.length;
  const completedLessons = course.lessons.filter((l) => l.completed).length;
  const pendingLessons = totalLessons - completedLessons;
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const timeStats = calculateCourseTimeStats(course.lessons);

  // Jump player to specific timestamp (Clickable Timestamps)
  const handleSeekToTimestamp = (seconds: number) => {
    playerRef.current?.seekTo(seconds);
    setMobileTab('video');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info('Pulo no Vídeo', `Avançando para ${formatTime(seconds)}`);
  };

  // Switch to a new lesson
  const selectLesson = (lessonId: string) => {
    setActiveLessonId(lessonId);
    setMobileTab('video');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const currentLatest = courseRef.current;
    const updatedCourse: Course = {
      ...currentLatest,
      currentLessonId: lessonId,
      lastAccessedAt: new Date().toISOString(),
    };

    courseRef.current = updatedCourse;
    onUpdateCourse(updatedCourse);
  };

  // Navigate next / previous
  const goToNextLesson = () => {
    const currentLatest = courseRef.current;
    const currentIdx = currentLatest.lessons.findIndex((l) => l.id === activeLessonId);
    if (currentIdx < currentLatest.lessons.length - 1) {
      selectLesson(currentLatest.lessons[currentIdx + 1].id);
    }
  };

  const goToPrevLesson = () => {
    const currentLatest = courseRef.current;
    const currentIdx = currentLatest.lessons.findIndex((l) => l.id === activeLessonId);
    if (currentIdx > 0) {
      selectLesson(currentLatest.lessons[currentIdx - 1].id);
    }
  };

  // Incremental Playlist Sync with YouTube
  const handleSyncPlaylist = async () => {
    if (!course.playlistId) {
      toast.info('Playlist Manual', 'Este curso foi cadastrado manualmente e não possui ID de playlist associado.');
      return;
    }

    setIsSyncingPlaylist(true);
    toast.info('Sincronizando Playlist', 'Buscando novos vídeos no YouTube...');

    try {
      const { updatedCourse, addedCount } = await syncCoursePlaylist(course, settings.youtubeApiKey);
      if (addedCount > 0) {
        courseRef.current = updatedCourse;
        onUpdateCourse(updatedCourse);
        toast.success('Playlist Atualizada!', `${addedCount} nova(s) aula(s) foram adicionadas ao curso sem alterar seu progresso.`);
      } else {
        toast.info('Tudo Atualizado', 'Sua playlist já está com todas as aulas lançadas pelo canal.');
      }
    } catch (err: any) {
      toast.error('Falha ao sincronizar', err?.message || 'Não foi possível consultar a playlist no YouTube.');
    } finally {
      setIsSyncingPlaylist(false);
    }
  };

  // Handle lesson completion toggle
  const toggleLessonCompletion = (lessonId: string, forceStatus?: boolean) => {
    const currentLatest = courseRef.current;
    const target = currentLatest.lessons.find((l) => l.id === lessonId);
    if (!target) return;

    const newStatus = forceStatus !== undefined ? forceStatus : !target.completed;
    if (newStatus && !target.completed) {
      fireLessonConfetti();
      recordLessonCompleted();
      toast.success('Aula Concluída!', 'Seu progresso e sequência de estudo foram atualizados! 🔥');
    } else if (!newStatus) {
      toast.info('Aula Desmarcada', 'O status da aula voltou para pendente.');
    }

    const updatedLessons = currentLatest.lessons.map((lesson) => {
      if (lesson.id === lessonId) {
        return {
          ...lesson,
          completed: newStatus,
          completedAt: newStatus ? new Date().toISOString() : undefined,
        };
      }
      return lesson;
    });

    const newlyCompletedCount = updatedLessons.filter((l) => l.completed).length;
    const isNowAllCompleted = newlyCompletedCount === currentLatest.lessons.length && currentLatest.lessons.length > 0;

    if (isNowAllCompleted) {
      fireCourseCompletedConfetti();
      setIsCompletedModalOpen(true);
      toast.success('PARABÉNS! 🏆', `Você completou todas as ${currentLatest.lessons.length} aulas!`);
    }

    const updatedCourse: Course = {
      ...currentLatest,
      lessons: updatedLessons,
      lastAccessedAt: new Date().toISOString(),
    };

    courseRef.current = updatedCourse;
    if (onUpdateLessonProgress) {
      onUpdateLessonProgress(currentLatest.id, lessonId, {
        completed: newStatus,
        completedAt: newStatus ? new Date().toISOString() : undefined,
      });
    } else {
      onUpdateCourse(updatedCourse);
    }
  };

  // Called automatically when YouTube video finishes
  const handleVideoEnded = () => {
    const currentLatest = courseRef.current;

    // 1. Marca a aula atual como CONCLUÍDA de forma definitiva
    const updatedLessons = currentLatest.lessons.map((lesson) => {
      if (lesson.id === activeLessonId) {
        return {
          ...lesson,
          completed: true,
          completedAt: new Date().toISOString(),
        };
      }
      return lesson;
    });

    fireLessonConfetti();
    recordLessonCompleted();
    toast.success('Aula Concluída!', 'Progresso salvo com sucesso! 🎉');

    const newlyCompletedCount = updatedLessons.filter((l) => l.completed).length;
    const isNowAllCompleted = newlyCompletedCount === currentLatest.lessons.length && currentLatest.lessons.length > 0;

    if (isNowAllCompleted) {
      fireCourseCompletedConfetti();
      setIsCompletedModalOpen(true);
      toast.success('PARABÉNS! 🏆', `Você concluiu todas as ${currentLatest.lessons.length} aulas!`);
    }

    const currentIdx = currentLatest.lessons.findIndex((l) => l.id === activeLessonId);
    const hasNext = currentIdx < currentLatest.lessons.length - 1;
    const nextLessonId = hasNext ? currentLatest.lessons[currentIdx + 1].id : activeLessonId;

    if (autoPlayNext && hasNext) {
      const updatedCourse: Course = {
        ...currentLatest,
        lessons: updatedLessons,
        currentLessonId: nextLessonId,
        lastAccessedAt: new Date().toISOString(),
      };

      courseRef.current = updatedCourse;
      onUpdateCourse(updatedCourse);

      toast.info('Avanço Automático', 'Iniciando próxima aula em instantes...');

      setTimeout(() => {
        setActiveLessonId(nextLessonId);
        setMobileTab('video');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 1200);
    } else {
      const updatedCourse: Course = {
        ...currentLatest,
        lessons: updatedLessons,
        lastAccessedAt: new Date().toISOString(),
      };
      courseRef.current = updatedCourse;
      if (onUpdateLessonProgress) {
        onUpdateLessonProgress(currentLatest.id, activeLessonId, {
          completed: true,
          completedAt: new Date().toISOString(),
        });
      } else {
        onUpdateCourse(updatedCourse);
      }
    }
  };

  // Track position periodically (Resume Playback)
  const handleTimeUpdate = (curr: number, dur: number) => {
    setCurrentTime(curr);
    setVideoDuration(dur);

    const currentLatest = courseRef.current;
    const lesson = currentLatest.lessons.find((l) => l.id === activeLessonId);

    // Save position periodically in lesson without touching completed status
    if (lesson && Math.abs((lesson.lastPositionSeconds || 0) - curr) > 5) {
      const newPos = Math.floor(curr);
      const updatedLessons = currentLatest.lessons.map((l) =>
        l.id === activeLessonId ? { ...l, lastPositionSeconds: newPos } : l
      );
      const updatedCourse = { ...currentLatest, lessons: updatedLessons };
      courseRef.current = updatedCourse;

      if (onUpdateLessonProgress) {
        if (positionDebounceRef.current) clearTimeout(positionDebounceRef.current);
        positionDebounceRef.current = setTimeout(() => {
          onUpdateLessonProgress(currentLatest.id, activeLessonId, {
            lastPositionSeconds: newPos,
          });
        }, 1000);
      } else {
        onUpdateCourse(updatedCourse);
      }
    }
  };

  // Save notes (com debounce para não sobrecarregar o banco na nuvem)
  const handleSaveNotes = (text: string) => {
    setNoteText(text);
    const currentLatest = courseRef.current;
    const updatedLessons = currentLatest.lessons.map((l) =>
      l.id === activeLessonId ? { ...l, notes: text } : l
    );
    const updatedCourse = { ...currentLatest, lessons: updatedLessons };
    courseRef.current = updatedCourse;

    if (notesDebounceRef.current) {
      clearTimeout(notesDebounceRef.current);
    }
    notesDebounceRef.current = setTimeout(() => {
      if (onUpdateLessonProgress) {
        onUpdateLessonProgress(currentLatest.id, activeLessonId, { notes: text });
      } else {
        onUpdateCourse(updatedCourse);
      }
    }, 600);
  };

  // Insert timestamp into notes
  const insertTimestamp = () => {
    const currentSecs = playerRef.current?.getCurrentTime?.() ?? currentTime;
    const timestampStr = `[${formatTime(currentSecs)}] `;
    handleSaveNotes(noteText + (noteText ? '\n' : '') + timestampStr);
    toast.info('Timestamp Inserido', `Momento ${timestampStr.trim()} adicionado nas anotações.`);
  };

  // Export notes for this course
  const downloadCourseNotes = () => {
    let content = `# Anotações do Curso: ${course.title}\n`;
    content += `Canal: ${course.channelTitle}\n\n`;
    course.lessons.forEach((l, idx) => {
      if (l.notes) {
        content += `## Aula ${idx + 1}: ${l.title}\n`;
        content += `${l.notes}\n\n---\n\n`;
      }
    });

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Anotacoes-${course.title.slice(0, 30)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Download Concluído', 'Suas anotações foram exportadas em formato Markdown (.md).');
  };

  // Global Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      if (isInput) return;

      if (e.key === 'Escape') {
        if (isLightsOff) {
          e.preventDefault();
          setIsLightsOff(false);
          toast.info('Luzes Acesas', 'Modo normal restaurado.');
          return;
        }
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
      } else if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        playerRef.current?.togglePlay();
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        playerRef.current?.rewind(10);
        toast.info('Voltar 10s', '-10 segundos');
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        playerRef.current?.forward(10);
        toast.info('Avançar 10s', '+10 segundos');
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        goToNextLesson();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        goToPrevLesson();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        toggleLessonCompletion(activeLessonId);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsTheaterMode((prev) => !prev);
        toast.info('Modo Teatro', isTheaterMode ? 'Retornando ao modo normal' : 'Modo teatro expandido ativado');
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        toggleLights();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        toggleLessonsSidebar();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        playerRef.current?.toggleMute();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        insertTimestamp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLessonId, isTheaterMode, isLightsOff, isLessonsSidebarOpen, noteText, currentTime]);

  // Filter lessons in sidebar with both search query and completion filter
  const filteredLessons = course.lessons.filter((l) => {
    const matchesSearch = l.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (lessonFilter === 'pending') return !l.completed;
    if (lessonFilter === 'completed') return l.completed;
    return true;
  });

  const timestampsInNotes = extractTimestamps(noteText);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-safe">
      {/* Top Bar (Height responsive: top-14 on mobile, top-16 on desktop) */}
      <div className="bg-slate-900 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 sticky top-14 sm:top-16 z-30 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onBack}
            aria-label="Voltar para a lista de cursos"
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700 shrink-0 min-h-[40px] active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-[160px] sm:max-w-md">
                {course.title}
              </h2>
              {course.category && (
                <span className="hidden md:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                  {course.category}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>Aula {activeLessonIndex + 1} de {totalLessons}</span>
              <span>•</span>
              <span className="text-amber-400/90 font-medium">
                {progressPercent === 100 ? '100% Concluído' : `Restam ${timeStats.remainingFormatted}`}
              </span>
            </div>
          </div>
        </div>

        {/* Top Bar Right: Toggle Sidebar, Sync Playlist, Shortcuts, Trophy, Progress Display */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle Lessons List Sidebar Button */}
          <button
            onClick={toggleLessonsSidebar}
            title={isLessonsSidebarOpen ? 'Fechar lista de aulas (Atalho: S)' : 'Abrir lista de aulas (Atalho: S)'}
            aria-label={isLessonsSidebarOpen ? 'Fechar lista de aulas' : 'Abrir lista de aulas'}
            className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold rounded-xl transition border min-h-[40px] active:scale-95 ${
              isLessonsSidebarOpen
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                : 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border-red-500/40 shadow-sm'
            }`}
          >
            {isLessonsSidebarOpen ? (
              <>
                <PanelRightClose className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Fechar Aulas</span>
                <kbd className="hidden xl:inline px-1.5 py-0.5 text-[10px] bg-slate-900 border border-slate-700 rounded text-slate-400 font-mono">S</kbd>
              </>
            ) : (
              <>
                <PanelRightOpen className="w-4 h-4 text-red-400" />
                <span className="hidden sm:inline">Abrir Aulas</span>
                <kbd className="hidden xl:inline px-1.5 py-0.5 text-[10px] bg-slate-900 border border-slate-700 rounded text-slate-400 font-mono">S</kbd>
              </>
            )}
          </button>

          {/* Sync Playlist Button */}
          {course.playlistId && (
            <button
              onClick={handleSyncPlaylist}
              disabled={isSyncingPlaylist}
              title="Buscar novas aulas adicionadas à playlist no YouTube"
              aria-label="Sincronizar com playlist do YouTube"
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-300 hover:text-cyan-400 bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700 min-h-[40px] active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingPlaylist ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden md:inline">Sincronizar</span>
            </button>
          )}

          {/* Keyboard Shortcuts Button */}
          <button
            onClick={() => setIsShortcutsModalOpen(true)}
            title="Ver atalhos de teclado (ou pressione ?)"
            aria-label="Atalhos de teclado"
            className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700 min-h-[40px] active:scale-95"
          >
            <Keyboard className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Atalhos</span>
            <kbd className="hidden md:inline px-1.5 py-0.5 text-[10px] bg-slate-900 border border-slate-700 rounded text-slate-400 font-mono">?</kbd>
          </button>

          {/* 100% Celebration Trophy Button */}
          {progressPercent === 100 && (
            <button
              onClick={() => setIsCompletedModalOpen(true)}
              title="Ver certificado e comemoração de conclusão"
              aria-label="Ver certificado de conclusão"
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold text-amber-300 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/40 rounded-xl transition min-h-[40px] active:scale-95 shadow-md shadow-amber-500/10"
            >
              <Trophy className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="hidden sm:inline">Concluído</span>
            </button>
          )}

          {/* Progress Bar */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] sm:text-xs font-bold text-white">
              {completedLessons}/{totalLessons} ({progressPercent}%)
            </span>
            <div className="w-16 sm:w-24 bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700/60">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  progressPercent === 100 ? 'bg-emerald-500' : 'bg-red-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Segment Tabs */}
      <div className="lg:hidden flex bg-slate-900/95 backdrop-blur-md border-b border-slate-800 p-1.5 gap-2 text-xs font-semibold sticky top-[52px] z-20">
        <button
          onClick={() => setMobileTab('video')}
          aria-label="Ver reprodutor de vídeo"
          className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition min-h-[44px] active:scale-[0.98] ${
            mobileTab === 'video'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
              : 'text-slate-400 hover:text-slate-200 bg-slate-950/40'
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Vídeo</span>
        </button>
        <button
          onClick={() => setMobileTab('lessons')}
          aria-label={`Ver lista de todas as ${totalLessons} aulas`}
          className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition min-h-[44px] active:scale-[0.98] ${
            mobileTab === 'lessons'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
              : 'text-slate-400 hover:text-slate-200 bg-slate-950/40'
          }`}
        >
          <ListVideo className="w-4 h-4" />
          <span>Aulas ({totalLessons})</span>
        </button>
        <button
          onClick={() => setMobileTab('notes')}
          aria-label="Ver bloco de anotações da aula"
          className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition min-h-[44px] active:scale-[0.98] ${
            mobileTab === 'notes'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
              : 'text-slate-400 hover:text-slate-200 bg-slate-950/40'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Anotações</span>
        </button>
      </div>

      {/* Lights Off / Cinema Overlay */}
      {isLightsOff && (
        <div
          role="button"
          tabIndex={-1}
          aria-label="Clique para acender as luzes"
          onClick={toggleLights}
          className="fixed inset-0 bg-black/92 backdrop-blur-[2px] z-50 transition-opacity duration-300 cursor-pointer animate-fade-in flex flex-col items-center justify-start pt-4 sm:pt-6"
        >
          {/* Floating Header Banner */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-[70] flex items-center gap-2.5 sm:gap-3 px-4 py-2 rounded-full bg-slate-900/95 border border-slate-700 shadow-2xl text-xs text-slate-300 cursor-default animate-fade-in select-none"
          >
            <span className="flex items-center gap-1.5 font-bold text-amber-300">
              <LightbulbOff className="w-4 h-4 text-amber-400" />
              Luzes Apagadas
            </span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-slate-400 hidden sm:inline">
              Pressione <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono text-[10px]">Esc</kbd> ou <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono text-[10px]">D</kbd>
            </span>
            <button
              onClick={toggleLights}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-full transition active:scale-95 shadow-md text-xs cursor-pointer ml-1"
            >
              <Lightbulb className="w-3.5 h-3.5 fill-current" />
              Acender a Luz
            </button>
          </div>
        </div>
      )}

      {/* Main Content Layout (Theater Mode or Closed Sidebar expands max-w) */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Column (Video & Player) */}
        <div
          className={`flex-1 p-2 sm:p-6 lg:p-8 flex flex-col gap-3 sm:gap-6 transition-all duration-300 ${
            isTheaterMode || !isLessonsSidebarOpen ? 'w-full max-w-7xl mx-auto' : 'max-w-5xl'
          } ${mobileTab !== 'video' ? 'hidden lg:flex' : 'flex'} ${
            isLightsOff ? 'relative z-[60]' : ''
          }`}
        >
          {/* YouTube Player & Resume notification */}
          {activeLesson && (
            <div className={`space-y-2 transition-all duration-300 ${isLightsOff ? 'rounded-2xl ring-2 ring-amber-500/30 shadow-2xl shadow-amber-500/10' : ''}`}>
              <YouTubePlayer
                key={activeLesson.id}
                ref={playerRef}
                videoId={activeLesson.id}
                initialTime={activeLesson.lastPositionSeconds || 0}
                playbackRate={playbackSpeed}
                onEnded={handleVideoEnded}
                onTimeUpdate={handleTimeUpdate}
              />

              {/* Resume notification banner if position was saved */}
              {activeLesson.lastPositionSeconds && activeLesson.lastPositionSeconds > 5 && (!activeLesson.completed || activeLesson.lastPositionSeconds < (videoDuration - 10)) && (
                <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-300">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="truncate">
                      Continuando de onde você parou: <strong className="text-white font-mono">{formatTime(activeLesson.lastPositionSeconds)}</strong>
                    </span>
                  </div>
                  <button
                    onClick={() => handleSeekToTimestamp(0)}
                    className="flex items-center gap-1 text-slate-400 hover:text-white transition underline underline-offset-2 ml-2 shrink-0 active:scale-95"
                    title="Reiniciar aula do início"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Reiniciar</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action and Navigation Controls */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            {/* Row 1: Anterior, Concluir, Próxima */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={goToPrevLesson}
                disabled={activeLessonIndex <= 0}
                aria-label="Aula anterior"
                className="p-2 sm:px-3 sm:py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 rounded-xl transition border border-slate-700 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
              >
                <ChevronLeft className="w-5 h-5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline ml-1">Anterior</span>
              </button>

              <button
                onClick={() => toggleLessonCompletion(activeLesson.id)}
                aria-label={activeLesson.completed ? 'Desmarcar conclusão' : 'Marcar como concluída'}
                className={`flex-1 flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition active:scale-95 shadow-md min-h-[44px] ${
                  activeLesson.completed
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                }`}
              >
                {activeLesson.completed ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Aula Concluída</span>
                  </>
                ) : (
                  <>
                    <Circle className="w-4 h-4 shrink-0" />
                    <span>Concluir Aula</span>
                  </>
                )}
              </button>

              <button
                onClick={goToNextLesson}
                disabled={activeLessonIndex >= totalLessons - 1}
                aria-label="Próxima aula"
                className="p-2 sm:px-3 sm:py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 rounded-xl transition border border-slate-700 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
              >
                <span className="hidden sm:inline mr-1">Próxima</span>
                <ChevronRight className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {/* Row 2: Lights Off, Theater Mode, Autoplay & Speed Selector */}
            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 flex-wrap">
              {/* Lights Off Button */}
              <button
                onClick={toggleLights}
                title={isLightsOff ? 'Acender a luz (Atalho: D ou Esc)' : 'Apagar a luz para focar no vídeo (Atalho: D)'}
                aria-label={isLightsOff ? 'Acender a luz' : 'Apagar a luz'}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border min-h-[40px] active:scale-95 ${
                  isLightsOff
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
                }`}
              >
                {isLightsOff ? (
                  <>
                    <LightbulbOff className="w-4 h-4 text-slate-950 fill-current" />
                    <span>Acender Luz [D]</span>
                  </>
                ) : (
                  <>
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    <span>Apagar Luz</span>
                    <kbd className="hidden md:inline px-1 py-0.5 text-[10px] bg-slate-900 border border-slate-700 rounded text-slate-400 font-mono">D</kbd>
                  </>
                )}
              </button>

              {/* Theater Mode Button */}
              <button
                onClick={() => setIsTheaterMode(!isTheaterMode)}
                title="Modo Teatro: expande o vídeo na tela (Atalho: F)"
                aria-label="Alternar modo teatro"
                className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border min-h-[40px] active:scale-95 ${
                  isTheaterMode
                    ? 'bg-red-500/15 text-red-400 border-red-500/40 shadow-sm'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Tv className="w-4 h-4" />
                <span>{isTheaterMode ? 'Modo Normal' : 'Modo Teatro [F]'}</span>
              </button>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none min-h-[36px]">
                <input
                  type="checkbox"
                  checked={autoPlayNext}
                  onChange={(e) => setAutoPlayNext(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-red-600 focus:ring-0 focus:ring-offset-0 w-4 h-4"
                />
                <span className="text-[11px] sm:text-xs font-medium">Avanço automático</span>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 hidden sm:inline">Velocidade:</span>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  aria-label="Velocidade de reprodução"
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:border-red-500 min-h-[40px] cursor-pointer"
                >
                  <option value={0.75}>0.75x</option>
                  <option value={1}>1.0x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2.0x</option>
                </select>
              </div>
            </div>
          </div>

          {/* Current Lesson Title */}
          <div className="px-1 sm:px-0">
            <div className="flex items-center gap-2 text-[11px] sm:text-xs text-red-400 font-semibold mb-1">
              <span className="px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20">
                AULA {activeLessonIndex + 1}
              </span>
              <span>•</span>
              <span className="truncate">{course.channelTitle}</span>
            </div>
            <h1 className="text-base sm:text-xl lg:text-2xl font-extrabold text-white tracking-tight leading-snug">
              {activeLesson?.title}
            </h1>
          </div>

          {/* Next Lesson Preview Banner on Mobile */}
          {nextLesson && (
            <div
              onClick={() => selectLesson(nextLesson.id)}
              className="sm:hidden p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 cursor-pointer hover:border-slate-700 active:scale-[0.99] transition"
            >
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">A Seguir</p>
                <p className="text-xs font-semibold text-slate-200 truncate">{nextLesson.title}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </div>
          )}

          {/* Notes and Info on Desktop */}
          <div className="hidden lg:block bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`flex items-center gap-2 text-xs sm:text-sm font-medium pb-2 border-b-2 transition ${
                    activeTab === 'notes'
                      ? 'border-red-500 text-red-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Anotações desta Aula</span>
                </button>
                <button
                  onClick={() => setActiveTab('info')}
                  className={`flex items-center gap-2 text-xs sm:text-sm font-medium pb-2 border-b-2 transition ${
                    activeTab === 'info'
                      ? 'border-red-500 text-red-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Sobre o Curso</span>
                </button>
              </div>

              {activeTab === 'notes' && (
                <div className="flex items-center gap-2">
                  {/* Toggle Edit / Preview */}
                  <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                    <button
                      onClick={() => setNotesViewMode('edit')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition ${
                        notesViewMode === 'edit'
                          ? 'bg-slate-800 text-white font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => setNotesViewMode('preview')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition ${
                        notesViewMode === 'preview'
                          ? 'bg-slate-800 text-white font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      <span>Visualizar</span>
                    </button>
                  </div>

                  <button
                    onClick={insertTimestamp}
                    title="Inserir timestamp atual do vídeo (Atalho: T)"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700 active:scale-95"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Timestamp [T]</span>
                  </button>
                  <button
                    onClick={downloadCourseNotes}
                    title="Exportar anotações em Markdown"
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {activeTab === 'notes' ? (
              <div className="space-y-3">
                {/* Clickable Timestamps Pills */}
                {timestampsInNotes.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 shrink-0">
                      <Clock className="w-3.5 h-3.5 text-amber-400" /> Marcadores clicáveis:
                    </span>
                    {timestampsInNotes.map((ts, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSeekToTimestamp(ts.seconds)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg transition active:scale-95 cursor-pointer shadow-sm"
                        title={`Clique para pular para ${ts.label}`}
                      >
                        <span>⏱️ {ts.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {notesViewMode === 'edit' ? (
                  <textarea
                    value={noteText}
                    onChange={(e) => handleSaveNotes(e.target.value)}
                    placeholder="Escreva suas anotações, resumo e insights desta aula aqui... Marcadores de tempo como [02:30] ficam clicáveis para pular no vídeo!"
                    rows={6}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 font-mono transition"
                  />
                ) : (
                  <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs sm:text-sm text-slate-200 font-mono min-h-[140px] whitespace-pre-wrap leading-relaxed">
                    {noteText ? (
                      renderTextWithClickableTimestamps(noteText, handleSeekToTimestamp)
                    ) : (
                      <span className="text-slate-600 italic">Nenhuma anotação nesta aula ainda. Clique em Editar para escrever.</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-xs sm:text-sm text-slate-300">
                <p>{course.description || 'Sem descrição cadastrada.'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Notes Tab View */}
        <div
          className={`flex-1 p-3 ${
            mobileTab === 'notes' ? 'block lg:hidden' : 'hidden'
          }`}
        >
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-red-500" />
                <span>Anotações da Aula {activeLessonIndex + 1}</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={insertTimestamp}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 text-amber-400 rounded-xl border border-slate-700 min-h-[40px] active:scale-95"
                >
                  <Clock className="w-4 h-4" />
                  <span>Timestamp</span>
                </button>
                <button
                  onClick={downloadCourseNotes}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl border border-slate-700 min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-95"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mobile Timestamps list */}
            {timestampsInNotes.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-amber-400" /> Pular:
                </span>
                {timestampsInNotes.map((ts, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSeekToTimestamp(ts.seconds)}
                    className="px-2 py-1 text-xs font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-lg active:scale-95"
                  >
                    ⏱️ {ts.label}
                  </button>
                ))}
              </div>
            )}

            <textarea
              value={noteText}
              onChange={(e) => handleSaveNotes(e.target.value)}
              placeholder="Escreva suas anotações desta aula aqui... (Salvamento automático)"
              rows={12}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-red-500"
            />
          </div>
        </div>

        {/* Right Column: Lessons Sidebar */}
        <div
          className={`w-full ${
            isTheaterMode ? 'lg:w-80' : 'lg:w-96'
          } bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col h-auto lg:h-[calc(100vh-4rem)] lg:sticky lg:top-16 transition-all duration-300 ${
            !isLessonsSidebarOpen
              ? 'hidden'
              : mobileTab === 'lessons'
              ? 'flex'
              : isTheaterMode
              ? 'hidden xl:flex'
              : 'hidden lg:flex'
          }`}
        >
          {/* Sidebar Header with Filter Tabs and Search */}
          <div className="p-3 sm:p-4 border-b border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs sm:text-sm text-white">Conteúdo das Aulas</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {completedLessons}/{totalLessons}
                </span>
              </div>
              <button
                onClick={toggleLessonsSidebar}
                title="Fechar lista de aulas (Atalho: S)"
                aria-label="Fechar lista de aulas"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition active:scale-95 min-h-[32px] min-w-[32px] flex items-center justify-center border border-slate-800 hover:border-slate-700"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Tabs: Todas, Pendentes, Concluídas */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/80 text-xs">
              <button
                onClick={() => setLessonFilter('all')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition ${
                  lessonFilter === 'all'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todas ({totalLessons})
              </button>
              <button
                onClick={() => setLessonFilter('pending')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition ${
                  lessonFilter === 'pending'
                    ? 'bg-amber-950/70 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Pendentes ({pendingLessons})
              </button>
              <button
                onClick={() => setLessonFilter('completed')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition ${
                  lessonFilter === 'completed'
                    ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Concluídas ({completedLessons})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por nome da aula..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500 transition min-h-[42px]"
              />
            </div>
          </div>

          {/* Lessons List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1.5">
            {filteredLessons.map((lesson) => {
              const originalIndex = course.lessons.findIndex((l) => l.id === lesson.id);
              const isActive = lesson.id === activeLessonId;

              return (
                <div
                  key={lesson.id}
                  onClick={() => selectLesson(lesson.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && selectLesson(lesson.id)}
                  aria-label={`Aula ${originalIndex + 1}: ${lesson.title} - ${lesson.completed ? 'Concluída' : 'Pendente'}`}
                  className={`group flex items-start gap-3 p-3 rounded-xl cursor-pointer transition select-none min-h-[60px] active:scale-[0.99] ${
                    isActive
                      ? 'bg-red-500/10 border border-red-500/30'
                      : 'hover:bg-slate-800/60 border border-transparent active:bg-slate-800/80'
                  }`}
                >
                  {/* Checkbox button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLessonCompletion(lesson.id);
                    }}
                    title={lesson.completed ? 'Marcar como não concluída' : 'Marcar como concluída'}
                    className="mt-0.5 text-slate-400 hover:text-emerald-400 transition shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center active:scale-95"
                  >
                    {lesson.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-950" />
                    ) : (
                      <Circle className="w-5 h-5 hover:text-slate-300" />
                    )}
                  </button>

                  {/* Thumbnail snippet */}
                  <div className="relative w-16 h-10 rounded-lg overflow-hidden bg-slate-950 shrink-0 border border-slate-800">
                    <img
                      src={lesson.thumbnailUrl || `https://img.youtube.com/vi/${lesson.id}/mqdefault.jpg`}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {isActive && (
                      <div className="absolute inset-0 bg-red-600/40 flex items-center justify-center">
                        <Flame className="w-4 h-4 text-white animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium mb-0.5">
                      <span>Aula {String(originalIndex + 1).padStart(2, '0')}</span>
                      {lesson.duration && <span>• {lesson.duration}</span>}
                      {lesson.notes && (
                        <span className="flex items-center gap-0.5 text-amber-400" title="Possui anotações">
                          • <FileText className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-xs font-medium line-clamp-2 leading-snug ${
                        isActive ? 'text-red-400 font-semibold' : 'text-slate-200 group-hover:text-white'
                      }`}
                    >
                      {lesson.title}
                    </p>
                  </div>
                </div>
              );
            })}

            {filteredLessons.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <p>Nenhuma aula encontrada para este filtro.</p>
                {(searchQuery || lessonFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setLessonFilter('all');
                    }}
                    className="text-red-400 hover:underline font-semibold"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Dock Button to Reopen Lessons List on Desktop */}
      {!isLessonsSidebarOpen && !isLightsOff && (
        <button
          onClick={toggleLessonsSidebar}
          title="Abrir lista de aulas (Atalho: S)"
          aria-label="Abrir lista de aulas"
          className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-slate-900/95 hover:bg-slate-800 text-slate-300 hover:text-white border-l border-y border-slate-700 rounded-l-2xl px-2.5 py-3 shadow-2xl transition-all duration-200 flex-col items-center gap-2 group active:scale-95 cursor-pointer hover:border-red-500/50 backdrop-blur-sm"
        >
          <PanelRightOpen className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform" />
          <span className="[writing-mode:vertical-rl] text-[11px] font-bold tracking-wider uppercase text-slate-300 group-hover:text-white py-1">
            Aulas
          </span>
          <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {completedLessons}/{totalLessons}
          </span>
        </button>
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Course Completed Celebration Modal */}
      <CourseCompletedModal
        course={course}
        isOpen={isCompletedModalOpen}
        onClose={() => setIsCompletedModalOpen(false)}
        onDownloadNotes={downloadCourseNotes}
        onBackToDashboard={onBack}
      />
    </div>
  );
};
