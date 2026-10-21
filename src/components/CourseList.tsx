import React, { useState, useRef, useEffect } from 'react';
import { Course } from '../types';
import { useToast } from '../context/ToastContext';
import { calculateCourseTimeStats } from '../utils/duration';
import { User } from '@supabase/supabase-js';
import {
  Play,
  CheckCircle2,
  Trash2,
  RotateCcw,
  BookOpen,
  Clock,
  Sparkles,
  Tag,
  Edit2,
  Search,
  RefreshCw,
  Lock,
  LogIn,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  LayoutGrid,
} from 'lucide-react';

interface CourseListProps {
  courses: Course[];
  user: User | null;
  onSelectCourse: (course: Course) => void;
  onDeleteCourse: (courseId: string) => void;
  onResetCourseProgress: (courseId: string) => void;
  onUpdateCourseCategory: (courseId: string, newCategory: string) => void;
  onOpenAddModal: () => void;
  onOpenAuthModal?: () => void;
  onSyncCoursePlaylist?: (course: Course) => Promise<void> | void;
}


const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Inteligência Artificial': {
    bg: 'bg-purple-950/80',
    text: 'text-purple-300',
    border: 'border-purple-500/40',
  },
  Python: {
    bg: 'bg-blue-950/80',
    text: 'text-blue-300',
    border: 'border-blue-500/40',
  },
  JavaScript: {
    bg: 'bg-amber-950/80',
    text: 'text-amber-300',
    border: 'border-amber-500/40',
  },
  PHP: {
    bg: 'bg-indigo-950/80',
    text: 'text-indigo-300',
    border: 'border-indigo-500/40',
  },
  React: {
    bg: 'bg-cyan-950/80',
    text: 'text-cyan-300',
    border: 'border-cyan-500/40',
  },
  'HTML & CSS': {
    bg: 'bg-orange-950/80',
    text: 'text-orange-300',
    border: 'border-orange-500/40',
  },
  Idiomas: {
    bg: 'bg-emerald-950/80',
    text: 'text-emerald-300',
    border: 'border-emerald-500/40',
  },
};

export const CourseList: React.FC<CourseListProps> = ({
  courses,
  user,
  onSelectCourse,
  onDeleteCourse,
  onResetCourseProgress,
  onUpdateCourseCategory,
  onOpenAddModal,
  onOpenAuthModal,
  onSyncCoursePlaylist,
}) => {

  const toast = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState<boolean>(false);
  const categoriesContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);

  const checkScrollBounds = () => {
    const el = categoriesContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  };

  useEffect(() => {
    checkScrollBounds();
    const handleResize = () => checkScrollBounds();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCategoriesExpanded]);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (!categoriesContainerRef.current) return;
    const scrollAmount = 280;
    categoriesContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
    setTimeout(checkScrollBounds, 300);
  };

  const handleCategoriesWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0 && categoriesContainerRef.current && !isCategoriesExpanded) {
      categoriesContainerRef.current.scrollLeft += e.deltaY;
      checkScrollBounds();
    }
  };

  // Extract unique categories and calculate counts
  const categoryMap = courses.reduce<Record<string, number>>((acc, course) => {
    const cat = course.category || 'Geral';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const categories = ['Todas', ...Object.keys(categoryMap).sort()];

  // Filter courses by category and search
  const filteredCourses = courses.filter((course) => {
    const matchesCategory =
      selectedCategory === 'Todas' || (course.category || 'Geral') === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (course.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (course.channelTitle || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleStartEditCategory = (course: Course, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCourseId(course.id);
    setNewCategoryName(course.category || 'Programação');
  };

  const handleSaveCategory = (courseId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      onUpdateCourseCategory(courseId, newCategoryName.trim());
      toast.success('Categoria Atualizada', `O curso agora pertence a "${newCategoryName.trim()}".`);
    }
    setEditingCourseId(null);
  };

  if (courses.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-14 sm:py-24">
        <div className="study-hero relative overflow-hidden rounded-[2rem] border border-sky-300/15 px-6 py-12 sm:px-14 sm:py-16 text-center">
          <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-300/10 border border-cyan-200/20 flex items-center justify-center text-cyan-200 mb-6">
              {user ? <BookOpen className="w-8 h-8" /> : <Lock className="w-8 h-8 text-cyan-300" />}
            </div>
            <p className="study-kicker text-sm font-semibold mb-3">
              {user ? 'Seu espaço de estudo' : 'Acesso Exclusivo para Alunos'}
            </p>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              {user
                ? 'Comece pelo curso que você quer terminar.'
                : 'Estude no YouTube com foco e progresso na nuvem.'}
            </h2>
            <p className="text-slate-300 max-w-lg mx-auto mb-8 text-sm sm:text-base leading-7">
              {user
                ? 'Adicione uma playlist pública do YouTube e transforme vídeos soltos em uma trilha com progresso, notas e ritmo.'
                : 'Faça login ou crie sua conta para cadastrar playlists, marcar seu progresso aula por aula e sincronizar suas anotações em qualquer dispositivo.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {user ? (
                <button
                  onClick={onOpenAddModal}
                  className="w-full sm:w-auto px-6 py-3.5 bg-cyan-300 hover:bg-cyan-200 text-slate-950 font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition active:scale-95"
                >
                  Adicionar primeira playlist
                </button>
              ) : (
                <button
                  onClick={onOpenAuthModal || onOpenAddModal}
                  className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-cyan-300 to-sky-400 hover:from-cyan-200 hover:to-sky-300 text-slate-950 font-bold rounded-xl shadow-lg shadow-sky-500/20 transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <LogIn className="w-5 h-5" />
                  <span>Entrar ou Criar Conta</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-5 sm:space-y-8">
      {/* Guest Mode Notice */}
      {!user && (
        <div className="p-4 sm:p-5 rounded-2xl bg-sky-950/40 border border-sky-400/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-400/10 border border-sky-400/30 flex items-center justify-center text-sky-300 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Modo Visitante — Acesso Restrito</p>
              <p className="text-xs text-slate-300">
                Para assistir às aulas, marcar progresso e fazer alterações nos cursos, entre na sua conta ou crie uma gratuitamente.
              </p>
            </div>
          </div>
          {onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-cyan-300 to-sky-400 hover:from-cyan-200 hover:to-sky-300 text-slate-950 font-bold text-xs rounded-xl transition shadow active:scale-95 shrink-0 flex items-center justify-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              <span>Entrar / Criar Conta</span>
            </button>
          )}
        </div>
      )}

      {/* Hero Banner */}
      <div className="study-hero relative overflow-hidden rounded-2xl sm:rounded-3xl border border-sky-300/15 p-4 sm:p-10">
        <div className="relative z-10 max-w-2xl">
          <div className="study-kicker inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold mb-2 sm:mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Sua Sala de Estudos Pessoal
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight sm:leading-tight">
            Um pouco mais perto de terminar.
          </h1>
          <p className="text-slate-400 text-xs sm:text-base mt-1.5 sm:mt-2">
            Escolha uma trilha e retome de onde parou. Seu progresso fica no centro.
          </p>
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 opacity-10 pointer-events-none hidden lg:block">
          <BookOpen className="w-80 h-80 text-white" />
        </div>
      </div>

      {/* Categories & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Category Tabs Container */}
        <div className="flex-1 min-w-0 relative flex items-center gap-1.5">
          {/* Scroll Left Button */}
          {!isCategoriesExpanded && canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center pr-2 bg-gradient-to-r from-slate-950 via-slate-950/95 to-transparent">
              <button
                type="button"
                onClick={() => scrollCategories('left')}
                title="Rolar categorias para a esquerda"
                aria-label="Rolar categorias para a esquerda"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center shadow-lg transition active:scale-90 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Categories List (Scrollable strip or Expanded wrap) */}
          <div
            ref={categoriesContainerRef}
            onScroll={checkScrollBounds}
            onWheel={handleCategoriesWheel}
            className={`w-full transition-all duration-200 ${
              isCategoriesExpanded
                ? 'flex flex-wrap gap-1.5 sm:gap-2 py-1'
                : 'flex items-center gap-1.5 sm:gap-2 overflow-x-auto scroll-smooth py-1.5 px-0.5'
            }`}
            style={
              !isCategoriesExpanded
                ? {
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(51, 65, 85, 0.7) transparent',
                  }
                : undefined
            }
          >
            {categories.map((cat) => {
              const count = cat === 'Todas' ? courses.length : categoryMap[cat] || 0;
              const isSelected = selectedCategory === cat;

              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap min-h-[42px] sm:min-h-[36px] active:scale-95 cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/25 ring-2 ring-red-500/40'
                      : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isSelected ? 'bg-black/30 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          {!isCategoriesExpanded && canScrollRight && (
            <div
              className={`absolute top-0 bottom-0 z-20 flex items-center pl-2 bg-gradient-to-l from-slate-950 via-slate-950/95 to-transparent ${
                categories.length > 3 ? 'right-11' : 'right-0'
              }`}
            >
              <button
                type="button"
                onClick={() => scrollCategories('right')}
                title="Rolar categorias para a direita"
                aria-label="Rolar categorias para a direita"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center shadow-lg transition active:scale-90 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Toggle Expand/Collapse Button (when more than 3 categories) */}
          {categories.length > 3 && (
            <button
              type="button"
              onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
              title={isCategoriesExpanded ? 'Recolher categorias em linha' : 'Ver todas as categorias expandidas'}
              aria-label={isCategoriesExpanded ? 'Recolher categorias' : 'Expandir categorias'}
              className={`shrink-0 p-2 rounded-xl border transition min-h-[42px] min-w-[42px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center active:scale-95 cursor-pointer ${
                isCategoriesExpanded
                  ? 'bg-red-500/15 text-red-400 border-red-500/40 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border-slate-800'
              }`}
            >
              {isCategoriesExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <LayoutGrid className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Search Input (text-base sm:text-xs prevents iOS Safari auto-zoom) */}
        <div className="relative w-full md:w-72 lg:w-80 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por curso ou canal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-base sm:text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500 transition min-h-[44px] sm:min-h-[40px]"
          />
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
        {filteredCourses.map((course) => {
          const totalLessons = course.lessons.length;
          const completedCount = course.lessons.filter((l) => l.completed).length;
          const progressPercent =
            totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
          const isDone = progressPercent === 100 && totalLessons > 0;
          const timeStats = calculateCourseTimeStats(course.lessons);

          // Find current lesson index
          const currentIdx = course.lessons.findIndex((l) => l.id === course.currentLessonId);
          const nextLessonNum = currentIdx >= 0 ? currentIdx + 1 : 1;

          // Custom colors for known categories
          const catColor = CATEGORY_COLORS[course.category || ''] || {
            bg: 'bg-slate-900/90',
            text: 'text-slate-200',
            border: 'border-slate-700/60',
          };

          return (
            <div
              key={course.id}
              className="group flex flex-col bg-slate-900/90 rounded-2xl border border-slate-800/80 hover:border-slate-700 overflow-hidden shadow-xl hover:shadow-2xl transition duration-300"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                <img
                  src={
                    course.thumbnailUrl ||
                    (course.lessons[0] && course.lessons[0].thumbnailUrl) ||
                    ''
                  }
                  alt={course.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20" />

                {/* Category Badge with quick edit */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span
                    onClick={(e) => handleStartEditCategory(course, e)}
                    title="Clique para alterar a categoria"
                    className={`cursor-pointer group/cat flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-md border shadow-sm transition hover:scale-105 ${catColor.bg} ${catColor.text} ${catColor.border}`}
                  >
                    <Tag className="w-3 h-3" />
                    <span>{course.category || 'Geral'}</span>
                    <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover/cat:opacity-100 transition ml-0.5" />
                  </span>
                </div>

                <div className="absolute top-3 right-3">
                  {isDone ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/90 text-white backdrop-blur-md shadow-lg shadow-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Concluído
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900/80 text-slate-300 backdrop-blur-md border border-slate-700">
                      {completedCount}/{totalLessons} Aulas
                    </span>
                  )}
                </div>

                {/* Progress bar along bottom of thumbnail */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isDone ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Course Info */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="font-medium line-clamp-1">
                      {course.channelTitle || 'YouTube'}
                    </span>
                  </div>

                  <h3 className="font-bold text-base sm:text-lg text-white group-hover:text-red-400 transition line-clamp-2 leading-snug">
                    {course.title}
                  </h3>
                  {course.description && (
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                      {course.description}
                    </p>
                  )}

                  {/* Estimated Time Remaining */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      {isDone
                        ? `Concluído (${timeStats.totalFormatted})`
                        : `Faltam ${timeStats.remainingFormatted} (${timeStats.totalFormatted} total)`}
                    </span>
                  </div>
                </div>

                {/* Bottom Meta & Actions */}
                <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Progresso</span>
                    <span
                      className={`font-bold ${
                        isDone ? 'text-emerald-400' : 'text-slate-200'
                      }`}
                    >
                      {progressPercent}%
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                      onClick={() => onSelectCourse(course)}
                      className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2.5 px-2 sm:px-4 text-xs sm:text-sm rounded-xl transition group/btn active:scale-95 border ${
                        user
                          ? 'bg-slate-800 hover:bg-cyan-400 text-white hover:text-slate-950 border-slate-700 hover:border-cyan-300 font-medium'
                          : 'bg-sky-950/40 hover:bg-sky-900/60 text-sky-300 border-sky-400/30 hover:border-sky-300 font-semibold'
                      }`}
                    >
                      {user ? (
                        <>
                          <Play className="w-4 h-4 fill-current transition group-hover/btn:scale-110" />
                          <span className="truncate">
                            {completedCount === 0
                              ? 'Começar Aula 1'
                              : `Continuar Aula ${nextLessonNum}`}
                          </span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span className="truncate">Entrar para Assistir</span>
                        </>
                      )}
                    </button>

                    {course.playlistId && onSyncCoursePlaylist && (
                      <button
                        onClick={() => onSyncCoursePlaylist(course)}
                        title="Buscar novas aulas adicionadas no YouTube"
                        aria-label="Buscar novas aulas no YouTube"
                        className="p-2.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-xl transition border border-slate-800 hover:border-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}


                    <button
                      onClick={() => {
                        if (confirm(`Reiniciar todo o progresso do curso "${course.title}"?`)) {
                          onResetCourseProgress(course.id);
                          toast.info('Progresso Reiniciado', `As aulas de "${course.title}" voltaram ao início.`);
                        }
                      }}
                      title="Reiniciar Progresso"
                      className="p-2.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-xl transition border border-slate-800 hover:border-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja remover o curso "${course.title}"?`)) {
                          onDeleteCourse(course.id);
                          toast.info('Curso Removido', `O curso "${course.title}" foi excluído.`);
                        }
                      }}
                      title="Remover Curso"
                      className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition border border-slate-800 hover:border-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCourses.length === 0 && (
        <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800">
          <p className="text-slate-400 text-sm">
            Nenhum curso encontrado na categoria "{selectedCategory}".
          </p>
          <button
            onClick={() => {
              setSelectedCategory('Todas');
              setSearchQuery('');
            }}
            className="mt-3 text-xs text-red-400 hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Quick Category Edit Modal */}
      {editingCourseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h4 className="text-sm font-bold text-white mb-1">Alterar Categoria do Curso</h4>
            <p className="text-xs text-slate-400 mb-4">
              Defina a tecnologia deste curso para organizar seu painel.
            </p>
            <form onSubmit={(e) => handleSaveCategory(editingCourseId, e)} className="space-y-4">
              <input
                type="text"
                autoFocus
                placeholder="Ex: Inteligência Artificial, Python, PHP..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-200 focus:outline-none focus:border-red-500"
              />
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-slate-950/40 rounded-xl border border-slate-800/80">
                {Array.from(
                  new Set([
                    ...Object.keys(categoryMap),
                    'Inteligência Artificial',
                    'Python',
                    'JavaScript',
                    'PHP',
                    'React',
                    'Node.js',
                    'HTML & CSS',
                    'Java',
                    'C# / .NET',
                    'Banco de Dados',
                    'Git & DevOps',
                  ])
                )
                  .sort()
                  .map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewCategoryName(cat)}
                      className={`px-2.5 py-1.5 sm:py-0.5 rounded-lg text-xs sm:text-[11px] transition active:scale-95 cursor-pointer ${
                        newCategoryName === cat
                          ? 'bg-red-600 text-white font-semibold shadow-sm'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCourseId(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white min-h-[44px] sm:min-h-[36px] flex items-center justify-center rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold min-h-[44px] sm:min-h-[36px] flex items-center justify-center transition active:scale-95"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
