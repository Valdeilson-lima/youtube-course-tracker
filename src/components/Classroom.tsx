import React, { useState, useEffect, useRef } from 'react';
import { Course, Lesson, UserSettings } from '../types';
import { YouTubePlayer } from './YouTubePlayer';
import { fireLessonConfetti, fireCourseCompletedConfetti } from '../utils/confetti';
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
  ExternalLink,
  Download,
  Flame,
  Volume2,
} from 'lucide-react';

interface ClassroomProps {
  course: Course;
  settings: UserSettings;
  onBack: () => void;
  onUpdateCourse: (updatedCourse: Course) => void;
}

export const Classroom: React.FC<ClassroomProps> = ({
  course,
  settings,
  onBack,
  onUpdateCourse,
}) => {
  const [activeLessonId, setActiveLessonId] = useState<string>(
    course.currentLessonId || course.lessons[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [activeTab, setActiveTab] = useState<'notes' | 'info'>('notes');
  const [noteText, setNoteText] = useState('');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(settings.playbackRate || 1);
  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(settings.autoPlayNext);

  // Current active lesson
  const activeLessonIndex = course.lessons.findIndex((l) => l.id === activeLessonId);
  const activeLesson = course.lessons[activeLessonIndex] || course.lessons[0];

  // Sync noteText when activeLesson changes
  useEffect(() => {
    if (activeLesson) {
      setNoteText(activeLesson.notes || '');
    }
  }, [activeLessonId]);

  // Overall stats
  const totalLessons = course.lessons.length;
  const completedLessons = course.lessons.filter((l) => l.completed).length;
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Handle lesson completion toggle
  const toggleLessonCompletion = (lessonId: string, forceStatus?: boolean) => {
    const updatedLessons = course.lessons.map((lesson) => {
      if (lesson.id === lessonId) {
        const newStatus = forceStatus !== undefined ? forceStatus : !lesson.completed;
        if (newStatus && !lesson.completed) {
          fireLessonConfetti();
        }
        return {
          ...lesson,
          completed: newStatus,
          completedAt: newStatus ? new Date().toISOString() : undefined,
        };
      }
      return lesson;
    });

    const newlyCompletedCount = updatedLessons.filter((l) => l.completed).length;
    if (newlyCompletedCount === totalLessons && totalLessons > 0) {
      fireCourseCompletedConfetti();
    }

    const updatedCourse: Course = {
      ...course,
      lessons: updatedLessons,
      lastAccessedAt: new Date().toISOString(),
    };

    onUpdateCourse(updatedCourse);
  };

  // Switch to a new lesson
  const selectLesson = (lessonId: string) => {
    setActiveLessonId(lessonId);
    const updatedCourse: Course = {
      ...course,
      currentLessonId: lessonId,
      lastAccessedAt: new Date().toISOString(),
    };
    onUpdateCourse(updatedCourse);
  };

  // Navigate next / previous
  const goToNextLesson = () => {
    if (activeLessonIndex < totalLessons - 1) {
      selectLesson(course.lessons[activeLessonIndex + 1].id);
    }
  };

  const goToPrevLesson = () => {
    if (activeLessonIndex > 0) {
      selectLesson(course.lessons[activeLessonIndex - 1].id);
    }
  };

  // Called automatically when YouTube video finishes
  const handleVideoEnded = () => {
    if (settings.autoMarkCompleted && activeLesson && !activeLesson.completed) {
      toggleLessonCompletion(activeLesson.id, true);
    }

    if (autoPlayNext && activeLessonIndex < totalLessons - 1) {
      setTimeout(() => {
        goToNextLesson();
      }, 1200);
    }
  };

  // Track position periodically
  const handleTimeUpdate = (curr: number, dur: number) => {
    setCurrentTime(curr);
    setVideoDuration(dur);

    // Save position periodically in lesson
    if (activeLesson && Math.abs((activeLesson.lastPositionSeconds || 0) - curr) > 5) {
      const updatedLessons = course.lessons.map((l) =>
        l.id === activeLesson.id ? { ...l, lastPositionSeconds: Math.floor(curr) } : l
      );
      onUpdateCourse({ ...course, lessons: updatedLessons });
    }
  };

  // Save notes
  const handleSaveNotes = (text: string) => {
    setNoteText(text);
    if (!activeLesson) return;
    const updatedLessons = course.lessons.map((l) =>
      l.id === activeLesson.id ? { ...l, notes: text } : l
    );
    onUpdateCourse({ ...course, lessons: updatedLessons });
  };

  // Insert timestamp into notes
  const insertTimestamp = () => {
    const mins = Math.floor(currentTime / 60);
    const secs = Math.floor(currentTime % 60);
    const timestampStr = `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}] `;
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
  };

  // Filter lessons in sidebar
  const filteredLessons = course.lessons.filter((l) =>
    l.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-16 z-30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar para Cursos</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white line-clamp-1 max-w-md">
                {course.title}
              </h2>
              {course.category && (
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  {course.category}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Aula {activeLessonIndex + 1} de {totalLessons}
            </p>
          </div>
        </div>

        {/* Progress Display */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs text-slate-400 block sm:inline">Progresso: </span>
              <span className="text-xs sm:text-sm font-bold text-white">
                {completedLessons}/{totalLessons} ({progressPercent}%)
              </span>
            </div>
            <div className="w-24 sm:w-36 bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700/60">
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

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Column: Player & Lesson Notes (Flex 1) */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-5xl">
          {/* YouTube Video Player */}
          {activeLesson && (
            <YouTubePlayer
              key={activeLesson.id}
              videoId={activeLesson.id}
              initialTime={activeLesson.lastPositionSeconds || 0}
              playbackRate={playbackSpeed}
              onEnded={handleVideoEnded}
              onTimeUpdate={handleTimeUpdate}
            />
          )}

          {/* Action and Navigation Controls */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrevLesson}
                disabled={activeLessonIndex <= 0}
                className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-xl transition border border-slate-700"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              <button
                onClick={goToNextLesson}
                disabled={activeLessonIndex >= totalLessons - 1}
                className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-xl transition border border-slate-700"
              >
                <span>Próxima</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Mark as Completed Toggle Button */}
            {activeLesson && (
              <button
                onClick={() => toggleLessonCompletion(activeLesson.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition active:scale-95 shadow-md ${
                  activeLesson.completed
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                }`}
              >
                {activeLesson.completed ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Aula Concluída</span>
                  </>
                ) : (
                  <>
                    <Circle className="w-4 h-4" />
                    <span>Marcar como Concluída</span>
                  </>
                )}
              </button>
            )}

            {/* Controls (Autoplay & Speed) */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoPlayNext}
                  onChange={(e) => setAutoPlayNext(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-red-600 focus:ring-0 focus:ring-offset-0 w-4 h-4"
                />
                <span className="hidden sm:inline">Avanço automático</span>
              </label>

              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-2 font-medium focus:outline-none focus:border-red-500"
              >
                <option value={0.75}>0.75x</option>
                <option value={1}>1.0x (Normal)</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={1.75}>1.75x</option>
                <option value={2}>2.0x</option>
              </select>
            </div>
          </div>

          {/* Current Lesson Title */}
          <div>
            <div className="flex items-center gap-2 text-xs text-red-400 font-semibold mb-1">
              <span>AULA {activeLessonIndex + 1}</span>
              <span>•</span>
              <span>{course.channelTitle}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {activeLesson?.title}
            </h1>
          </div>

          {/* Tabs: Notes and Overview */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4">
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
                  <button
                    onClick={insertTimestamp}
                    title="Inserir timestamp atual do vídeo na anotação"
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Inserir Timestamp</span>
                  </button>
                  <button
                    onClick={downloadCourseNotes}
                    title="Exportar anotações completas do curso em Markdown"
                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {activeTab === 'notes' ? (
              <div>
                <textarea
                  value={noteText}
                  onChange={(e) => handleSaveNotes(e.target.value)}
                  placeholder="Escreva suas anotações, resumo e insights desta aula aqui... (Salvamento automático no navegador)"
                  rows={6}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500 font-mono transition"
                />
                <p className="text-[11px] text-slate-500 mt-2">
                  Dica: use o botão "Inserir Timestamp" para marcar momentos importantes da aula.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-slate-300">
                <p>{course.description || 'Sem descrição cadastrada.'}</p>
                <div className="pt-2 flex items-center gap-4 text-xs text-slate-400">
                  <a
                    href={`https://www.youtube.com/playlist?list=${course.playlistId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-red-400 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir playlist no YouTube</span>
                  </a>
                  {activeLesson && (
                    <a
                      href={`https://www.youtube.com/watch?v=${activeLesson.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-slate-400 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir vídeo original</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Lessons Sidebar (W-full on mobile, W-96 on desktop) */}
        <div className="w-full lg:w-96 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col h-auto lg:h-[calc(100vh-4rem)] lg:sticky lg:top-16">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Conteúdo das Aulas</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {completedLessons}/{totalLessons} concluídas
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar aula por título..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
              />
            </div>
          </div>

          {/* Lessons List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
            {filteredLessons.map((lesson, idx) => {
              const originalIndex = course.lessons.findIndex((l) => l.id === lesson.id);
              const isActive = lesson.id === activeLessonId;

              return (
                <div
                  key={lesson.id}
                  onClick={() => selectLesson(lesson.id)}
                  className={`group flex items-start gap-3 p-3 rounded-xl cursor-pointer transition select-none ${
                    isActive
                      ? 'bg-red-500/10 border border-red-500/30'
                      : 'hover:bg-slate-800/60 border border-transparent'
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
                    className="mt-0.5 text-slate-400 hover:text-emerald-400 transition"
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
                      {lesson.notes && (
                        <span className="flex items-center gap-0.5 text-amber-400" title="Possui anotações">
                          • <FileText className="w-2.5 h-2.5" />
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
              <div className="p-8 text-center text-xs text-slate-500">
                Nenhuma aula encontrada com esse termo.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
