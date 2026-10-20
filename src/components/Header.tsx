import React from 'react';
import {
  Plus,
  Settings,
  GraduationCap,
  CheckCircle2,
  Cloud,
  RefreshCw,
  LayoutGrid,
  Flame,
} from 'lucide-react';
import { YouTubeIcon } from './YouTubeIcon';
import { Course } from '../types';
import { User } from '@supabase/supabase-js';
import { StudyStreakData } from '../utils/streak';

interface HeaderProps {
  courses: Course[];
  currentCourse: Course | null;
  user: User | null;
  isSyncing?: boolean;
  streak?: StudyStreakData;
  onBackToDashboard: () => void;
  onOpenAddModal: () => void;
  onOpenSettings: () => void;
  onOpenAuthModal: () => void;
  onOpenStreakModal?: () => void;
  onManualSync?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  courses,
  currentCourse,
  user,
  isSyncing = false,
  streak,
  onBackToDashboard,
  onOpenAddModal,
  onOpenSettings,
  onOpenAuthModal,
  onOpenStreakModal,
  onManualSync,
}) => {

  const totalLessons = courses.reduce((acc, c) => acc + c.lessons.length, 0);
  const totalCompleted = courses.reduce(
    (acc, c) => acc + c.lessons.filter((l) => l.completed).length,
    0
  );
  const overallPercentage =
    totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <div
          className="flex items-center gap-2 sm:gap-2.5 cursor-pointer select-none shrink-0 group"
          onClick={onBackToDashboard}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onBackToDashboard()}
          aria-label="Ir para página inicial do TubeCourse"
        >
          <div className="relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 text-white shadow-md shadow-red-500/20 shrink-0 group-hover:scale-105 transition-transform duration-200">
            <YouTubeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            <GraduationCap className="w-3 h-3 sm:w-4 sm:h-4 text-amber-300 absolute -top-1 -right-1 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm sm:text-lg tracking-tight text-white group-hover:text-red-400 transition-colors">
                TubeCourse
              </span>
              <span className="text-[8px] sm:text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden md:block">
              Transforme Playlists em Cursos
            </p>
          </div>
        </div>

        {/* Center: Global Progress if multiple courses (Desktop only) */}
        {courses.length > 0 && !currentCourse && (
          <div className="hidden lg:flex items-center gap-3 px-4 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/60 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300">
              Progresso Geral: <strong className="text-white">{totalCompleted}</strong> de{' '}
              <strong className="text-white">{totalLessons}</strong> aulas ({overallPercentage}%)
            </span>
            <div className="w-20 bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${overallPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons (Touch friendly: min 44px on mobile) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Study Streak Badge */}
          {streak && onOpenStreakModal && (
            <button
              onClick={onOpenStreakModal}
              title={`Sequência de estudo: ${streak.currentStreak} dias seguidos. Meta de hoje: ${streak.todayLessonsCompleted}/${streak.dailyGoal} aulas.`}
              aria-label="Abrir meta e sequência de estudos"
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 text-xs font-bold rounded-xl border border-amber-500/40 bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 transition min-h-[40px] sm:min-h-[38px] active:scale-95 shadow-sm shadow-amber-500/10"
            >
              <Flame className="w-4 h-4 text-amber-400 fill-amber-400/20 animate-pulse" />
              <span>{streak.currentStreak}d</span>
              <span className="hidden sm:inline text-[11px] text-amber-400/80">
                ({streak.todayLessonsCompleted}/{streak.dailyGoal})
              </span>
            </button>
          )}

          {/* Cloud Sync Button */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenAuthModal}
              title={
                user
                  ? `Conectado como ${user.email} (Clique para gerenciar)`
                  : 'Conectar ao Supabase'
              }
              aria-label="Sincronização na nuvem"
              className={`flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-semibold rounded-xl border transition min-h-[40px] sm:min-h-[38px] active:scale-95 ${
                user
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:text-white hover:bg-slate-800'
              }`}
            >
              <div className="relative flex items-center">
                <Cloud
                  className={`w-4 h-4 ${
                    user ? 'text-emerald-400 fill-emerald-400/20' : 'text-slate-400'
                  }`}
                />
                {user && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </div>
              <span className="hidden md:inline">
                {user ? user.email?.split('@')[0] : 'Nuvem'}
              </span>
            </button>

            {user && onManualSync && (
              <button
                onClick={onManualSync}
                disabled={isSyncing}
                title="Forçar Sincronização Agora"
                aria-label="Sincronizar agora"
                className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 border border-slate-800 transition min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-95"
              >
                <RefreshCw
                  className={`w-4 h-4 ${
                    isSyncing ? 'animate-spin text-emerald-400' : ''
                  }`}
                />
              </button>
            )}
          </div>

          {currentCourse && (
            <button
              onClick={onBackToDashboard}
              aria-label="Voltar para Meus Cursos"
              className="flex items-center justify-center gap-1 px-3 py-2 sm:py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700 min-h-[40px] min-w-[40px] active:scale-95"
            >
              <LayoutGrid className="w-4 h-4 sm:hidden" />
              <span className="hidden sm:inline">Meus Cursos</span>
            </button>
          )}

          <button
            onClick={onOpenAddModal}
            aria-label="Adicionar nova playlist"
            className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-1.5 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-xl transition shadow-md shadow-red-600/20 active:scale-95 min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Adicionar Playlist</span>
            <span className="sm:hidden font-medium">Novo</span>
          </button>

          <button
            onClick={onOpenSettings}
            title="Configurações"
            aria-label="Abrir configurações"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition border border-transparent hover:border-slate-700 min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-95"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
