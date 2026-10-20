import React from 'react';
import {
  Plus,
  Settings,
  GraduationCap,
  CheckCircle2,
  Cloud,
  RefreshCw,
} from 'lucide-react';
import { YouTubeIcon } from './YouTubeIcon';
import { Course } from '../types';
import { User } from '@supabase/supabase-js';

interface HeaderProps {
  courses: Course[];
  currentCourse: Course | null;
  user: User | null;
  isSyncing?: boolean;
  onBackToDashboard: () => void;
  onOpenAddModal: () => void;
  onOpenSettings: () => void;
  onOpenAuthModal: () => void;
  onManualSync?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  courses,
  currentCourse,
  user,
  isSyncing = false,
  onBackToDashboard,
  onOpenAddModal,
  onOpenSettings,
  onOpenAuthModal,
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
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Brand */}
        <div
          className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none shrink-0"
          onClick={onBackToDashboard}
        >
          <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 text-white shadow-lg shadow-red-500/20 shrink-0">
            <YouTubeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 absolute -top-1 -right-1 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                TubeCourse
              </span>
              <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                PRO
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 hidden sm:block">
              Transforme Playlists em Cursos
            </p>
          </div>
        </div>

        {/* Center: Global Progress if multiple courses (Hidden on mobile) */}
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

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Cloud Sync Button */}
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenAuthModal}
              title={
                user
                  ? `Conectado como ${user.email} (Clique para gerenciar)`
                  : 'Conectar ao Supabase para sincronizar com o celular'
              }
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
                user
                  ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/50'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:text-white hover:bg-slate-800'
              }`}
            >
              <div className="relative">
                <Cloud
                  className={`w-3.5 h-3.5 ${
                    user ? 'text-emerald-400 fill-emerald-400/20' : 'text-slate-400'
                  }`}
                />
                {user && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </div>
              <span className="hidden sm:inline">
                {user ? user.email?.split('@')[0] : 'Sincronizar'}
              </span>
            </button>

            {user && onManualSync && (
              <button
                onClick={onManualSync}
                disabled={isSyncing}
                title="Forçar Sincronização Agora"
                className="p-1.5 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 border border-slate-800 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            )}
          </div>

          {currentCourse && (
            <button
              onClick={onBackToDashboard}
              className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Meus Cursos</span>
              <span className="sm:hidden">Cursos</span>
            </button>
          )}

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-xl transition shadow-lg shadow-red-600/25 active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Adicionar Playlist</span>
            <span className="sm:hidden">Novo</span>
          </button>

          <button
            onClick={onOpenSettings}
            title="Configurações"
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition border border-transparent hover:border-slate-700"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
