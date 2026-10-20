import React from 'react';
import { Plus, Settings, GraduationCap, CheckCircle2, Cloud, User as UserIcon } from 'lucide-react';
import { YouTubeIcon } from './YouTubeIcon';
import { Course } from '../types';
import { User } from '@supabase/supabase-js';

interface HeaderProps {
  courses: Course[];
  currentCourse: Course | null;
  user: User | null;
  onBackToDashboard: () => void;
  onOpenAddModal: () => void;
  onOpenSettings: () => void;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  courses,
  currentCourse,
  user,
  onBackToDashboard,
  onOpenAddModal,
  onOpenSettings,
  onOpenAuthModal,
}) => {
  const totalLessons = courses.reduce((acc, c) => acc + c.lessons.length, 0);
  const totalCompleted = courses.reduce(
    (acc, c) => acc + c.lessons.filter((l) => l.completed).length,
    0
  );
  const overallPercentage = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer select-none" onClick={onBackToDashboard}>
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 text-white shadow-lg shadow-red-500/20">
            <YouTubeIcon className="w-5 h-5" />
            <GraduationCap className="w-4 h-4 text-amber-300 absolute -top-1 -right-1 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">TubeCourse</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Transforme Playlists em Cursos</p>
          </div>
        </div>

        {/* Center: Global Progress if multiple courses */}
        {courses.length > 0 && !currentCourse && (
          <div className="hidden md:flex items-center gap-3 px-4 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/60 text-xs">
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
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Supabase Cloud Sync Status */}
          <button
            onClick={onOpenAuthModal}
            title={user ? `Conectado como ${user.email}` : 'Conectar ao Supabase para salvar na nuvem'}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
              user
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/40'
                : 'bg-slate-800/80 text-slate-400 border-slate-700/80 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Cloud className={`w-3.5 h-3.5 ${user ? 'text-emerald-400 fill-emerald-400/20' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">
              {user ? user.email?.split('@')[0] : 'Nuvem'}
            </span>
          </button>

          {currentCourse && (
            <button
              onClick={onBackToDashboard}
              className="px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition border border-slate-700"
            >
              Meus Cursos
            </button>
          )}

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-xl transition shadow-lg shadow-red-600/25 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Adicionar Playlist</span>
            <span className="sm:hidden">Novo</span>
          </button>

          <button
            onClick={onOpenSettings}
            title="Configurações"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition border border-transparent hover:border-slate-700"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
