import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  X,
  Filter,
} from 'lucide-react';

interface CourseListProps {
  courses: Course[];
  user: User | null;
  isLoading?: boolean;
  onSelectCourse: (course: Course) => void;
  onDeleteCourse: (courseId: string) => void;
  onResetCourseProgress: (courseId: string) => void;
  onUpdateCourseCategory: (courseId: string, newCategory: string) => void;
  onOpenAddModal: () => void;
  onOpenAuthModal?: () => void;
  onSyncCoursePlaylist?: (course: Course) => Promise<void> | void;
}

export const CourseCardSkeleton: React.FC = () => (
  <div className="flex flex-col bg-slate-900/90 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl animate-pulse">
    <div className="aspect-video w-full bg-slate-950/80 relative">
      <div className="absolute top-3 left-3 w-24 h-6 bg-slate-800/80 rounded-lg" />
      <div className="absolute top-3 right-3 w-16 h-6 bg-slate-800/80 rounded-lg" />
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800" />
    </div>
    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-5">
      <div className="space-y-2.5">
        <div className="h-3 bg-slate-800/60 rounded-md w-1/3" />
        <div className="h-5 bg-slate-800 rounded-lg w-4/5" />
        <div className="h-3.5 bg-slate-800/40 rounded w-2/3" />
        <div className="h-3 bg-slate-800/50 rounded w-1/2 pt-1" />
      </div>
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <div className="h-10 bg-slate-800/80 rounded-xl flex-1" />
        <div className="h-10 w-10 bg-slate-800/60 rounded-xl shrink-0" />
        <div className="h-10 w-10 bg-slate-800/60 rounded-xl shrink-0" />
      </div>
    </div>
  </div>
);

export interface CategoryTheme {
  bg: string;
  text: string;
  border: string;
  dot: string;
  badge: string;
}

const KNOWN_CATEGORY_COLORS: Record<string, CategoryTheme> = {
  'Inteligência Artificial': {
    bg: 'bg-purple-950/70',
    text: 'text-purple-300',
    border: 'border-purple-500/40',
    dot: 'bg-purple-400',
    badge: 'bg-purple-500/20 text-purple-300',
  },
  Python: {
    bg: 'bg-blue-950/70',
    text: 'text-blue-300',
    border: 'border-blue-500/40',
    dot: 'bg-blue-400',
    badge: 'bg-blue-500/20 text-blue-300',
  },
  JavaScript: {
    bg: 'bg-amber-950/70',
    text: 'text-amber-300',
    border: 'border-amber-500/40',
    dot: 'bg-amber-400',
    badge: 'bg-amber-500/20 text-amber-300',
  },
  PHP: {
    bg: 'bg-indigo-950/70',
    text: 'text-indigo-300',
    border: 'border-indigo-500/40',
    dot: 'bg-indigo-400',
    badge: 'bg-indigo-500/20 text-indigo-300',
  },
  React: {
    bg: 'bg-cyan-950/70',
    text: 'text-cyan-300',
    border: 'border-cyan-500/40',
    dot: 'bg-cyan-400',
    badge: 'bg-cyan-500/20 text-cyan-300',
  },
  'HTML & CSS': {
    bg: 'bg-orange-950/70',
    text: 'text-orange-300',
    border: 'border-orange-500/40',
    dot: 'bg-orange-400',
    badge: 'bg-orange-500/20 text-orange-300',
  },
  Idiomas: {
    bg: 'bg-emerald-950/70',
    text: 'text-emerald-300',
    border: 'border-emerald-500/40',
    dot: 'bg-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300',
  },
  'Node.js': {
    bg: 'bg-lime-950/70',
    text: 'text-lime-300',
    border: 'border-lime-500/40',
    dot: 'bg-lime-400',
    badge: 'bg-lime-500/20 text-lime-300',
  },
  'Banco de Dados': {
    bg: 'bg-sky-950/70',
    text: 'text-sky-300',
    border: 'border-sky-500/40',
    dot: 'bg-sky-400',
    badge: 'bg-sky-500/20 text-sky-300',
  },
  'Git & DevOps': {
    bg: 'bg-rose-950/70',
    text: 'text-rose-300',
    border: 'border-rose-500/40',
    dot: 'bg-rose-400',
    badge: 'bg-rose-500/20 text-rose-300',
  },
  'Design & UX': {
    bg: 'bg-pink-950/70',
    text: 'text-pink-300',
    border: 'border-pink-500/40',
    dot: 'bg-pink-400',
    badge: 'bg-pink-500/20 text-pink-300',
  },
  'Finanças & Negócios': {
    bg: 'bg-teal-950/70',
    text: 'text-teal-300',
    border: 'border-teal-500/40',
    dot: 'bg-teal-400',
    badge: 'bg-teal-500/20 text-teal-300',
  },
};

const DYNAMIC_PALETTES: CategoryTheme[] = [
  { bg: 'bg-cyan-950/70', text: 'text-cyan-300', border: 'border-cyan-500/40', dot: 'bg-cyan-400', badge: 'bg-cyan-500/20 text-cyan-300' },
  { bg: 'bg-purple-950/70', text: 'text-purple-300', border: 'border-purple-500/40', dot: 'bg-purple-400', badge: 'bg-purple-500/20 text-purple-300' },
  { bg: 'bg-emerald-950/70', text: 'text-emerald-300', border: 'border-emerald-500/40', dot: 'bg-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
  { bg: 'bg-amber-950/70', text: 'text-amber-300', border: 'border-amber-500/40', dot: 'bg-amber-400', badge: 'bg-amber-500/20 text-amber-300' },
  { bg: 'bg-rose-950/70', text: 'text-rose-300', border: 'border-rose-500/40', dot: 'bg-rose-400', badge: 'bg-rose-500/20 text-rose-300' },
  { bg: 'bg-blue-950/70', text: 'text-blue-300', border: 'border-blue-500/40', dot: 'bg-blue-400', badge: 'bg-blue-500/20 text-blue-300' },
  { bg: 'bg-indigo-950/70', text: 'text-indigo-300', border: 'border-indigo-500/40', dot: 'bg-indigo-400', badge: 'bg-indigo-500/20 text-indigo-300' },
  { bg: 'bg-fuchsia-950/70', text: 'text-fuchsia-300', border: 'border-fuchsia-500/40', dot: 'bg-fuchsia-400', badge: 'bg-fuchsia-500/20 text-fuchsia-300' },
  { bg: 'bg-teal-950/70', text: 'text-teal-300', border: 'border-teal-500/40', dot: 'bg-teal-400', badge: 'bg-teal-500/20 text-teal-300' },
  { bg: 'bg-orange-950/70', text: 'text-orange-300', border: 'border-orange-500/40', dot: 'bg-orange-400', badge: 'bg-orange-500/20 text-orange-300' },
];

export const getCategoryTheme = (category: string): CategoryTheme => {
  if (!category || category === 'Geral') {
    return {
      bg: 'bg-slate-800/80',
      text: 'text-slate-200',
      border: 'border-slate-700/60',
      dot: 'bg-slate-400',
      badge: 'bg-slate-700/50 text-slate-300',
    };
  }
  if (KNOWN_CATEGORY_COLORS[category]) {
    return KNOWN_CATEGORY_COLORS[category];
  }
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash << 5) - hash + category.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % DYNAMIC_PALETTES.length;
  return DYNAMIC_PALETTES[index];
};

export const CourseList: React.FC<CourseListProps> = ({
  courses,
  user,
  isLoading = false,
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

  // Extract unique categories and calculate counts
  const categoryMap = useMemo(() => {
    return courses.reduce<Record<string, number>>((acc, course) => {
      const cat = course.category || 'Geral';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});
  }, [courses]);

  const categories = useMemo(() => {
    return ['Todas', ...Object.keys(categoryMap).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }, [categoryMap]);

  const checkScrollBounds = () => {
    const el = categoriesContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  };

  useEffect(() => {
    checkScrollBounds();
    const el = categoriesContainerRef.current;
    if (!el) return;

    // Use ResizeObserver for instant responsive recalculation whenever content or window size changes
    const resizeObserver = new ResizeObserver(() => {
      checkScrollBounds();
    });
    resizeObserver.observe(el);

    const handleResize = () => checkScrollBounds();
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [categories, isCategoriesExpanded, courses.length]);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (!categoriesContainerRef.current) return;
    const scrollAmount = Math.max(categoriesContainerRef.current.clientWidth * 0.75, 240);
    categoriesContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
    setTimeout(checkScrollBounds, 320);
  };

  const handleCategoriesWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0 && categoriesContainerRef.current && !isCategoriesExpanded) {
      categoriesContainerRef.current.scrollLeft += e.deltaY;
      checkScrollBounds();
    }
  };

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
    setNewCategoryName(course.category || 'Geral');
  };

  const handleSaveCategory = (courseId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      onUpdateCourseCategory(courseId, newCategoryName.trim());
      toast.success('Categoria Atualizada', `O curso agora pertence a "${newCategoryName.trim()}".`);
    }
    setEditingCourseId(null);
  };

  // Skeleton Loading State (CLS < 0.1)
  if (isLoading && courses.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8 animate-fade-in">
        {/* Skeleton Hero Banner */}
        <div className="study-hero relative overflow-hidden rounded-2xl sm:rounded-3xl border border-sky-300/15 p-6 sm:p-10 animate-pulse">
          <div className="space-y-3 max-w-xl">
            <div className="h-4 w-36 bg-cyan-300/20 rounded-full" />
            <div className="h-8 sm:h-10 w-3/4 bg-slate-800 rounded-xl" />
            <div className="h-4 w-1/2 bg-slate-800/60 rounded-lg" />
          </div>
        </div>

        {/* Skeleton Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 animate-pulse">
          <div className="h-4 w-40 bg-slate-800 rounded-md" />
          <div className="h-10 w-full sm:w-72 bg-slate-950 rounded-xl" />
        </div>

        {/* Skeleton Categories Track */}
        <div className="flex items-center gap-2 overflow-hidden py-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-9 w-28 bg-slate-900/80 rounded-xl border border-slate-800/60 animate-pulse shrink-0" />
          ))}
        </div>

        {/* Skeleton Course Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CourseCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

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

      {/* Search Bar & Filter Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 sm:p-4 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
        {/* Course Count / Active Filter Label */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300">
          <Filter className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            {filteredCourses.length === courses.length ? (
              <>
                <strong className="text-white font-semibold">{courses.length}</strong>{' '}
                {courses.length === 1 ? 'curso cadastrado' : 'cursos cadastrados'}
              </>
            ) : (
              <>
                Exibindo <strong className="text-white font-semibold">{filteredCourses.length}</strong> de{' '}
                <strong className="text-slate-400 font-semibold">{courses.length}</strong> cursos
              </>
            )}
          </span>
          {(selectedCategory !== 'Todas' || searchQuery.trim() !== '') && (
            <button
              onClick={() => {
                setSelectedCategory('Todas');
                setSearchQuery('');
              }}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2 ml-1 cursor-pointer font-medium"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Search Input & Expand/Collapse Toggle */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72 md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por curso, categoria ou canal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none transition min-h-[40px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 rounded-md cursor-pointer"
                aria-label="Limpar texto da busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Toggle Expand View Button */}
          {categories.length > 2 && (
            <button
              type="button"
              onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
              title={
                isCategoriesExpanded
                  ? 'Recolher para fita horizontal'
                  : 'Ver todas as categorias em grade'
              }
              aria-label={
                isCategoriesExpanded
                  ? 'Recolher categorias'
                  : 'Expandir todas as categorias'
              }
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition active:scale-95 cursor-pointer min-h-[40px] ${
                isCategoriesExpanded
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-400/40 shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border-slate-800'
              }`}
            >
              {isCategoriesExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 text-cyan-400" />
                  <span className="hidden sm:inline">Recolher</span>
                </>
              ) : (
                <>
                  <LayoutGrid className="w-4 h-4 text-slate-400" />
                  <span className="hidden sm:inline">Ver todas</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Full-Width Categories Track */}
      <div className="relative w-full">
        {/* Scroll Left Button */}
        {!isCategoriesExpanded && canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center pr-4 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent pointer-events-none">
            <button
              type="button"
              onClick={() => scrollCategories('left')}
              title="Rolar categorias para a esquerda"
              aria-label="Rolar categorias para a esquerda"
              className="pointer-events-auto w-8 h-8 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 flex items-center justify-center shadow-lg transition active:scale-90 cursor-pointer backdrop-blur-sm"
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
              ? 'flex flex-wrap gap-2 p-1.5 bg-slate-900/40 rounded-2xl border border-slate-800/60'
              : 'flex items-center gap-2 overflow-x-auto scroll-smooth py-1 px-1 overscroll-x-contain touch-pan-x'
          }`}
          style={
            !isCategoriesExpanded
              ? {
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(51, 65, 85, 0.6) transparent',
                }
              : undefined
          }
        >
          {categories.map((cat) => {
            const count = cat === 'Todas' ? courses.length : categoryMap[cat] || 0;
            const isSelected = selectedCategory === cat;
            const theme = getCategoryTheme(cat);

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap min-h-[38px] active:scale-95 cursor-pointer shrink-0 border ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-400 to-sky-400 text-slate-950 font-bold border-cyan-300 shadow-md shadow-cyan-500/20 ring-2 ring-cyan-400/40'
                    : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                {cat === 'Todas' ? (
                  <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-slate-950' : 'text-cyan-400'}`} />
                ) : (
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isSelected ? 'bg-slate-950' : theme.dot
                    }`}
                  />
                )}
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold transition ${
                    isSelected
                      ? 'bg-slate-950/20 text-slate-950 font-extrabold'
                      : 'bg-slate-800 text-slate-400 group-hover:text-slate-300'
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
          <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center pl-4 bg-gradient-to-l from-slate-950 via-slate-950/80 to-transparent pointer-events-none">
            <button
              type="button"
              onClick={() => scrollCategories('right')}
              title="Rolar categorias para a direita"
              aria-label="Rolar categorias para a direita"
              className="pointer-events-auto w-8 h-8 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 flex items-center justify-center shadow-lg transition active:scale-90 cursor-pointer backdrop-blur-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
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

          // Custom dynamic theme for course category
          const catTheme = getCategoryTheme(course.category || 'Geral');

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
                  <button
                    type="button"
                    onClick={(e) => handleStartEditCategory(course, e)}
                    title="Clique para alterar a categoria deste curso"
                    className={`group/cat flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-md border shadow-sm transition hover:scale-105 active:scale-95 cursor-pointer ${catTheme.bg} ${catTheme.text} ${catTheme.border}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${catTheme.dot}`} />
                    <span>{course.category || 'Geral'}</span>
                    <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover/cat:opacity-100 transition ml-0.5 text-slate-300" />
                  </button>
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
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
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
                    'Idiomas',
                    'Design & UX',
                    'Finanças & Negócios',
                  ])
                )
                  .sort((a, b) => a.localeCompare(b, 'pt-BR'))
                  .map((cat) => {
                    const theme = getCategoryTheme(cat);
                    const isSelected = newCategoryName.trim().toLowerCase() === cat.toLowerCase();
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewCategoryName(cat)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition active:scale-95 cursor-pointer border ${
                          isSelected
                            ? 'bg-gradient-to-r from-cyan-400 to-sky-400 text-slate-950 font-bold border-cyan-300 shadow-sm'
                            : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-800'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-slate-950' : theme.dot}`} />
                        <span>{cat}</span>
                      </button>
                    );
                  })}
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
                  className="px-5 py-2 bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 rounded-lg text-xs font-bold min-h-[44px] sm:min-h-[36px] flex items-center justify-center transition active:scale-95 shadow-md shadow-cyan-500/20"
                >
                  Salvar Categoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
