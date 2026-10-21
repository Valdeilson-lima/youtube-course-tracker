import React, { useState, useEffect, useRef } from 'react';
import { Course, UserSettings } from '../types';
import { YouTubePlayer, YouTubePlayerHandle } from './YouTubePlayer';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { CourseCompletedModal } from './CourseCompletedModal';
import { AiSummaryModal } from './AiSummaryModal';
import { generateLessonSummary, LessonSummary } from '../services/ai';
import { fireLessonConfetti, fireCourseCompletedConfetti } from '../utils/confetti';
import { useToast } from '../context/ToastContext';
import { calculateCourseTimeStats } from '../utils/duration';
import { recordLessonCompleted } from '../utils/streak';
import { syncCoursePlaylist } from '../services/youtube';
import { getCategoryTheme } from './CourseList';
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
  PictureInPicture2,
  Maximize2,
  X,
  AlertCircle,
  Database,
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
  onRecordStudyTime?: (seconds: number) => void;
}

export const Classroom: React.FC<ClassroomProps> = ({
  course,
  settings,
  onBack,
  onUpdateCourse,
  onUpdateLessonProgress,
  onRecordStudyTime,
}) => {
  const toast = useToast();
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const notesDebounceRef = useRef<any>(null);
  const positionDebounceRef = useRef<any>(null);

  // Status de salvamento no banco de dados na nuvem
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>(() =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );

  const notifySave = (type: 'saving' | 'saved' | 'error') => {
    setSaveStatus(type);
    if (type === 'saved') {
      setLastSavedTime(
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }
  };

  // Miniplayer (Picture-in-Picture)
  const [isMiniplayer, setIsMiniplayer] = useState(false);

  // Resumo com Inteligência Artificial (Gemini)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [currentSummary, setCurrentSummary] = useState<LessonSummary | null>(null);

  // Horímetro de Estudo: acumula segundos de vídeo ativamente assistido
  const isPlayingRef = useRef(false);
  const studyTimerAccumulatorRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (isPlayingRef.current) {
        studyTimerAccumulatorRef.current += 1;
        // A cada 15 segundos em reprodução, envia ao horímetro
        if (studyTimerAccumulatorRef.current >= 15) {
          onRecordStudyTime?.(studyTimerAccumulatorRef.current);
          studyTimerAccumulatorRef.current = 0;
        }
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      if (studyTimerAccumulatorRef.current > 0) {
        onRecordStudyTime?.(studyTimerAccumulatorRef.current);
        studyTimerAccumulatorRef.current = 0;
      }
    };
  }, [onRecordStudyTime]);

  const handlePlaybackStateChange = (isPlaying: boolean) => {
    isPlayingRef.current = isPlaying;
  };

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
      }
      return next;
    });
  };

  // Toggle Theater Mode (Widescreen Top Stage)
  const toggleTheaterMode = () => {
    setIsTheaterMode((prev) => {
      const next = !prev;
      if (next) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
    notifySave('saving');
    if (onUpdateLessonProgress) {
      onUpdateLessonProgress(currentLatest.id, lessonId, {
        completed: newStatus,
        completedAt: newStatus ? new Date().toISOString() : undefined,
      });
      setTimeout(() => notifySave('saved'), 400);
    } else {
      onUpdateCourse(updatedCourse);
      setTimeout(() => notifySave('saved'), 400);
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
    notifySave('saving');
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
      notifySave('saved');
    }, 600);
  };

  // Gerador de Resumo com Inteligência Artificial
  const handleGenerateSummary = async () => {
    setIsAiModalOpen(true);
    setIsGeneratingSummary(true);
    try {
      const summary = await generateLessonSummary(
        activeLesson.title,
        course.title,
        course.channelTitle,
        settings.geminiApiKey
      );
      setCurrentSummary(summary);
    } catch (err) {
      toast.error('Erro na IA', 'Não foi possível gerar o resumo da aula.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleInsertSummaryIntoNotes = (markdownToAppend: string) => {
    const newText = noteText
      ? `${noteText}\n\n---\n${markdownToAppend}`
      : markdownToAppend;
    handleSaveNotes(newText);
  };

  // Insert timestamp into notes
  const insertTimestamp = () => {
    const currentSecs = playerRef.current?.getCurrentTime?.() ?? currentTime;
    const timestampStr = `[${formatTime(currentSecs)}] `;
    handleSaveNotes(noteText + (noteText ? '\n' : '') + timestampStr);
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
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        playerRef.current?.forward(10);
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
        toggleTheaterMode();
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        toggleLights();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        toggleLessonsSidebar();
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setIsMiniplayer((prev) => !prev);
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
      <div className="bg-slate-900 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 sticky top-14 sm:top-16 z-30 flex flex-wrap items-center justify-between gap-2 sm:gap-3 shadow-md">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
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
              {course.category && (() => {
                const theme = getCategoryTheme(course.category);
                return (
                  <span className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${theme.bg} ${theme.text} ${theme.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
                    <span>{course.category}</span>
                  </span>
                );
              })()}
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
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 max-w-full overflow-x-auto no-scrollbar pb-0.5">
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

      {/* Main Content Layout (Widescreen Theater Mode or Standard 2-Column Mode) */}
      <div
        className={`flex-1 min-w-0 w-full transition-all duration-300 ${
          isTheaterMode
            ? `max-w-[1750px] mx-auto p-2 sm:p-4 lg:p-6 lg:grid ${
                isLessonsSidebarOpen
                  ? 'lg:grid-cols-[minmax(0,1fr)_384px] xl:grid-cols-[minmax(0,1fr)_420px] lg:gap-6'
                  : 'lg:grid-cols-1 max-w-7xl'
              }`
            : isLessonsSidebarOpen
            ? 'flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_384px]'
            : 'flex flex-col p-2 sm:p-6 lg:p-8 max-w-7xl mx-auto'
        }`}
      >
        {/* 1. Video & Player Controls Stage */}
        <div
          className={`min-w-0 transition-all duration-300 ${
            isTheaterMode
              ? 'lg:col-span-full lg:row-start-1 w-full flex flex-col gap-3 sm:gap-4'
              : isLessonsSidebarOpen
              ? 'lg:col-start-1 lg:col-end-2 lg:row-start-1 p-2 sm:p-6 lg:px-8 lg:pt-8 lg:pb-3 flex flex-col gap-3 sm:gap-6'
              : 'w-full flex flex-col gap-3 sm:gap-6'
          } ${mobileTab !== 'video' ? 'hidden lg:flex' : 'flex'} ${
            isLightsOff ? 'relative z-[60]' : ''
          }`}
        >
          {/* Placeholder quando o vídeo está no Miniplayer */}
          {isMiniplayer && (
            <div className="w-full aspect-video rounded-2xl bg-slate-900/60 border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <PictureInPicture2 className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Vídeo reproduzindo no Miniplayer flutuante</p>
                <p className="text-xs text-slate-400">Você pode rolar a tela, fazer anotações e navegar nas aulas sem pausar o vídeo.</p>
              </div>
              <button
                onClick={() => setIsMiniplayer(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 transition active:scale-95 cursor-pointer"
              >
                Restaurar para Tela Principal
              </button>
            </div>
          )}

          {/* YouTube Player & Resume notification */}
          {activeLesson && (
            <div
              className={
                isMiniplayer
                  ? 'fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50 rounded-2xl shadow-2xl border-2 border-slate-700 bg-slate-950 overflow-hidden ring-4 ring-black/60 transition-all duration-300 pb-safe'
                  : `space-y-2 transition-all duration-300 ${isLightsOff ? 'rounded-2xl ring-2 ring-amber-500/30 shadow-2xl shadow-amber-500/10' : ''}`
              }
            >
              {isMiniplayer && (
                <div className="bg-slate-900 px-3 py-1.5 flex items-center justify-between border-b border-slate-800 text-xs">
                  <span className="font-semibold text-white truncate max-w-[220px]">
                    {activeLesson?.title}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsMiniplayer(false)}
                      title="Restaurar tamanho normal"
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setIsMiniplayer(false)}
                      title="Fechar miniplayer"
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <YouTubePlayer
                key={activeLesson.id}
                ref={playerRef}
                videoId={activeLesson.id}
                initialTime={activeLesson.lastPositionSeconds || 0}
                playbackRate={playbackSpeed}
                onEnded={handleVideoEnded}
                onTimeUpdate={handleTimeUpdate}
                onPlaybackStateChange={handlePlaybackStateChange}
              />

              {/* Resume notification banner if position was saved */}
              {!isMiniplayer && activeLesson.lastPositionSeconds && activeLesson.lastPositionSeconds > 5 && (!activeLesson.completed || activeLesson.lastPositionSeconds < (videoDuration - 10)) && (
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
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-3 sm:p-4 shadow-lg space-y-3">
            {/* Tier 1: Navegação Principal & Conclusão */}
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <button
                onClick={goToPrevLesson}
                disabled={activeLessonIndex <= 0}
                aria-label="Aula anterior"
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-200 rounded-xl transition border border-slate-700 shrink-0 min-h-[44px] active:scale-95 cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              <button
                onClick={() => toggleLessonCompletion(activeLesson.id)}
                aria-label={activeLesson.completed ? 'Desmarcar conclusão' : 'Marcar como concluída'}
                className={`flex-1 max-w-md flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition active:scale-95 shadow-md min-h-[44px] cursor-pointer ${
                  activeLesson.completed
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25 border border-emerald-500/40'
                    : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/25 border border-red-500/40'
                }`}
              >
                {activeLesson.completed ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    <span className="truncate">Aula Concluída</span>
                  </>
                ) : (
                  <>
                    <Circle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    <span className="truncate">Concluir Aula</span>
                  </>
                )}
              </button>

              <button
                onClick={goToNextLesson}
                disabled={activeLessonIndex >= totalLessons - 1}
                aria-label="Próxima aula"
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-200 rounded-xl transition border border-slate-700 shrink-0 min-h-[44px] active:scale-95 cursor-pointer"
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {/* Separador sutil */}
            <div className="h-px bg-slate-800/80" />

            {/* Tier 2: Ferramentas de Visualização & Preferências de Reprodução */}
            <div className="flex flex-col min-[520px]:flex-row items-stretch min-[520px]:items-center justify-between gap-2.5 sm:gap-3">
              {/* Grupo 1: Modos de Tela (Apagar Luz, Miniplayer, Teatro) */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <button
                  onClick={toggleLights}
                  title={isLightsOff ? 'Acender a luz (Atalho: D ou Esc)' : 'Apagar a luz para focar no vídeo (Atalho: D)'}
                  aria-label={isLightsOff ? 'Acender a luz' : 'Apagar a luz'}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border min-h-[40px] sm:min-h-[36px] active:scale-95 cursor-pointer flex-1 min-[520px]:flex-none ${
                    isLightsOff
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/20'
                      : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {isLightsOff ? (
                    <>
                      <LightbulbOff className="w-4 h-4 text-slate-950 fill-current" />
                      <span>Acender Luz</span>
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                      <span>Apagar Luz</span>
                      <kbd className="hidden md:inline px-1 py-0.5 text-[9px] bg-slate-900 border border-slate-700 rounded text-slate-400 font-mono">D</kbd>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setIsMiniplayer(!isMiniplayer)}
                  title={isMiniplayer ? 'Restaurar para a tela principal (Atalho: I)' : 'Miniplayer flutuante para continuar assistindo enquanto anota (Atalho: I)'}
                  aria-label="Alternar miniplayer"
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border min-h-[40px] sm:min-h-[36px] active:scale-95 cursor-pointer flex-1 min-[520px]:flex-none ${
                    isMiniplayer
                      ? 'bg-red-500/15 text-red-400 border-red-500/40 shadow-sm font-bold'
                      : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <PictureInPicture2 className="w-4 h-4 text-red-400" />
                  <span>{isMiniplayer ? 'Restaurar' : 'Miniplayer'}</span>
                  <kbd className="hidden lg:inline px-1 py-0.5 text-[9px] bg-slate-900 border border-slate-700 rounded text-slate-400 font-mono">I</kbd>
                </button>

                <button
                  onClick={toggleTheaterMode}
                  title={isTheaterMode ? 'Sair do Modo Teatro (Atalho: F)' : 'Modo Teatro: expande o vídeo em tela ampla (Atalho: F)'}
                  aria-label={isTheaterMode ? 'Sair do modo teatro' : 'Ativar modo teatro'}
                  className={`hidden sm:inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border min-h-[40px] sm:min-h-[36px] active:scale-95 cursor-pointer ${
                    isTheaterMode
                      ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/30 font-bold ring-2 ring-red-500/40'
                      : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Tv className="w-4 h-4" />
                  <span>{isTheaterMode ? 'Teatro Ativo' : 'Modo Teatro'}</span>
                  <kbd className={`hidden md:inline px-1 py-0.5 text-[9px] rounded font-mono ${
                    isTheaterMode ? 'bg-red-700/60 text-red-100 border border-red-400/40' : 'bg-slate-900 border border-slate-700 text-slate-400'
                  }`}>F</kbd>
                </button>
              </div>

              {/* Grupo 2: Preferências (Avanço Automático & Velocidade) */}
              <div className="flex items-center justify-between min-[520px]:justify-end gap-2 sm:gap-2.5">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 cursor-pointer select-none hover:border-slate-700 transition min-h-[40px] sm:min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={autoPlayNext}
                    onChange={(e) => setAutoPlayNext(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-red-600 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-medium whitespace-nowrap">Avanço automático</span>
                </label>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 min-h-[40px] sm:min-h-[36px]">
                  <span className="text-[11px] text-slate-400 hidden lg:inline">Velocidade:</span>
                  <select
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                    aria-label="Velocidade de reprodução"
                    className="bg-transparent text-slate-200 text-xs font-bold focus:outline-none cursor-pointer pr-1"
                  >
                    <option value={0.75} className="bg-slate-900 text-white">0.75x</option>
                    <option value={1} className="bg-slate-900 text-white">1.0x</option>
                    <option value={1.25} className="bg-slate-900 text-white">1.25x</option>
                    <option value={1.5} className="bg-slate-900 text-white">1.5x</option>
                    <option value={2} className="bg-slate-900 text-white">2.0x</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Lesson Title, Details & Notes Deck */}
        <div
          className={`min-w-0 transition-all duration-300 ${
            isTheaterMode
              ? 'lg:col-start-1 lg:col-end-2 lg:row-start-2 flex flex-col gap-4 sm:gap-6'
              : isLessonsSidebarOpen
              ? 'lg:col-start-1 lg:col-end-2 lg:row-start-2 p-2 sm:p-6 lg:px-8 lg:pt-0 lg:pb-8 flex flex-col gap-3 sm:gap-6'
              : 'w-full flex flex-col gap-4 sm:gap-6'
          }`}
        >
          {/* Current Lesson Title */}
          <div className={`px-1 sm:px-0 ${mobileTab !== 'video' ? 'hidden lg:block' : 'block'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-red-400 font-semibold">
                <span className="px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20">
                  AULA {activeLessonIndex + 1}
                </span>
                <span>•</span>
                <span className="truncate">{course.channelTitle}</span>
              </div>

              {/* Status de Salvamento no Banco de Dados */}
              <div className="flex items-center gap-1.5">
                {saveStatus === 'saving' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                    Salvando no banco...
                  </span>
                ) : saveStatus === 'saved' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <Database className="w-3 h-3 text-emerald-400" />
                    Salvo no banco às {lastSavedTime}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                    <AlertCircle className="w-3 h-3 text-rose-400" />
                    Erro ao salvar
                  </span>
                )}
              </div>
            </div>
            <h1 className="text-base sm:text-xl lg:text-2xl font-extrabold text-white tracking-tight leading-snug">
              {activeLesson?.title}
            </h1>
          </div>

          {/* Next Lesson Preview Banner on Mobile */}
          {nextLesson && (
            <div
              onClick={() => selectLesson(nextLesson.id)}
              className={`p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 cursor-pointer hover:border-slate-700 active:scale-[0.99] transition ${
                mobileTab !== 'video' ? 'hidden' : 'block sm:hidden'
              }`}
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

                  {/* Botão Resumo com IA */}
                  <button
                    onClick={handleGenerateSummary}
                    title="Gerar resumo inteligente da aula com Inteligência Artificial"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg shadow-sm shadow-purple-500/20 transition active:scale-95 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                    <span>Resumo com IA</span>
                  </button>

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
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-base sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 font-mono transition"
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

          {/* Mobile Notes Tab View */}
          <div
            className={`${
              mobileTab === 'notes' ? 'block lg:hidden' : 'hidden'
            }`}
          >
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-red-500" />
                  <span>Anotações da Aula {activeLessonIndex + 1}</span>
                </h3>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={handleGenerateSummary}
                    title="Resumo com IA"
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl shadow-sm min-h-[44px] active:scale-95 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>IA</span>
                  </button>
                  <button
                    onClick={insertTimestamp}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 text-amber-400 rounded-xl border border-slate-700 min-h-[44px] active:scale-95 cursor-pointer"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Timestamp</span>
                  </button>
                  <button
                    onClick={downloadCourseNotes}
                    className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl border border-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95 cursor-pointer"
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
                      className="px-2.5 py-1.5 text-xs font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-lg active:scale-95 min-h-[36px] flex items-center"
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-base sm:text-sm font-mono text-slate-200 focus:outline-none focus:border-red-500 leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* 3. Lessons Sidebar */}
        <div
          className={`w-full transition-all duration-300 ${
            isTheaterMode
              ? 'lg:col-start-2 lg:col-end-3 lg:row-start-2 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden flex flex-col h-[750px] lg:sticky lg:top-20'
              : 'lg:col-start-2 lg:col-end-3 lg:row-start-1 lg:row-span-2 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col h-auto lg:h-[calc(100vh-4rem)] lg:sticky lg:top-16'
          } ${
            !isLessonsSidebarOpen
              ? 'hidden'
              : mobileTab === 'lessons'
              ? 'flex'
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-base sm:text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500 transition min-h-[44px]"
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

      {/* AI Lesson Summary Modal */}
      <AiSummaryModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        summary={currentSummary}
        isLoading={isGeneratingSummary}
        onInsertIntoNotes={handleInsertSummaryIntoNotes}
      />
    </div>
  );
};
