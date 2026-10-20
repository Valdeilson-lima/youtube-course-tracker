import React, { useState } from 'react';
import { Course } from '../types';
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
} from 'lucide-react';

interface CourseListProps {
  courses: Course[];
  onSelectCourse: (course: Course) => void;
  onDeleteCourse: (courseId: string) => void;
  onResetCourseProgress: (courseId: string) => void;
  onUpdateCourseCategory: (courseId: string, newCategory: string) => void;
  onOpenAddModal: () => void;
  onLoadDemoCourses: () => void;
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
  onSelectCourse,
  onDeleteCourse,
  onResetCourseProgress,
  onUpdateCourseCategory,
  onOpenAddModal,
  onLoadDemoCourses,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

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
    }
    setEditingCourseId(null);
  };

  if (courses.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-red-500 mb-6 shadow-xl shadow-red-500/5">
          <BookOpen className="w-10 h-10" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
          Nenhum curso cadastrado ainda
        </h2>
        <p className="text-slate-400 max-w-md mx-auto mb-8 text-sm sm:text-base">
          Transforme qualquer playlist do YouTube em uma trilha de aprendizado estruturada com progresso e marcação automática.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onOpenAddModal}
            className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl shadow-lg shadow-red-600/25 transition active:scale-95"
          >
            Adicionar Minha Primeira Playlist
          </button>
          <button
            onClick={onLoadDemoCourses}
            className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-700 transition flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            Carregar Cursos de Demonstração
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 p-6 sm:p-10 shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Sua Sala de Estudos Pessoal
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Continue seus estudos com foco total
          </h1>
          <p className="text-slate-400 text-sm sm:text-base mt-2">
            Organize suas playlists por tecnologia (Inteligência Artificial, Python, JavaScript, PHP) com progresso contínuo e anotações.
          </p>
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 opacity-10 pointer-events-none hidden lg:block">
          <BookOpen className="w-80 h-80 text-white" />
        </div>
      </div>

      {/* Categories & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const count = cat === 'Todas' ? courses.length : categoryMap[cat] || 0;
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                  isSelected
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 hover:border-slate-700'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-black/30 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por curso ou canal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
          />
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map((course) => {
          const totalLessons = course.lessons.length;
          const completedCount = course.lessons.filter((l) => l.completed).length;
          const progressPercent =
            totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
          const isDone = progressPercent === 100 && totalLessons > 0;

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
              <div className="p-5 flex-1 flex flex-col justify-between">
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

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectCourse(course)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-red-600 text-white font-medium text-sm rounded-xl transition group/btn active:scale-95 border border-slate-700 hover:border-red-500"
                    >
                      <Play className="w-4 h-4 fill-current transition group-hover/btn:scale-110" />
                      <span>
                        {completedCount === 0
                          ? 'Começar Aula 1'
                          : `Continuar Aula ${nextLessonNum}`}
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Reiniciar todo o progresso do curso "${course.title}"?`)) {
                          onResetCourseProgress(course.id);
                        }
                      }}
                      title="Reiniciar Progresso"
                      className="p-2.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-xl transition border border-slate-800 hover:border-slate-700"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja remover o curso "${course.title}"?`)) {
                          onDeleteCourse(course.id);
                        }
                      }}
                      title="Remover Curso"
                      className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition border border-slate-800 hover:border-slate-700"
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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-red-500"
              />
              <div className="flex flex-wrap gap-1.5">
                {['Inteligência Artificial', 'Python', 'JavaScript', 'PHP', 'React', 'HTML & CSS'].map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewCategoryName(cat)}
                      className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      {cat}
                    </button>
                  )
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCourseId(null)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold"
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
