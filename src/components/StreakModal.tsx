import React, { useState } from 'react';
import { Flame, Trophy, Target, CheckCircle2, X, Sparkles } from 'lucide-react';
import { StudyStreakData, updateDailyGoal } from '../utils/streak';
import { useToast } from '../context/ToastContext';

interface StreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  streak: StudyStreakData;
  onUpdateStreak: (newStreak: StudyStreakData) => void;
}

export const StreakModal: React.FC<StreakModalProps> = ({
  isOpen,
  onClose,
  streak,
  onUpdateStreak,
}) => {
  const toast = useToast();
  const [selectedGoal, setSelectedGoal] = useState(streak.dailyGoal);

  if (!isOpen) return null;

  const handleSetGoal = (goal: number) => {
    setSelectedGoal(goal);
    const updated = updateDailyGoal(goal, streak);
    onUpdateStreak(updated);
    toast.success('Meta Atualizada! 🎯', `Sua meta agora é concluir ${goal} aulas por dia.`);
  };

  const progressPercent = Math.min(100, Math.round((streak.todayLessonsCompleted / streak.dailyGoal) * 100));
  const isGoalReached = streak.todayLessonsCompleted >= streak.dailyGoal;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-6 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-95"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Streak Flame Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-400 p-0.5 shadow-xl shadow-amber-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
              <Flame className="w-10 h-10 text-amber-400 fill-amber-400/20 animate-pulse" />
            </div>
          </div>
          <div>
            <h3 id="streak-modal-title" className="text-2xl font-black text-white">
              {streak.currentStreak} {streak.currentStreak === 1 ? 'Dia Seguido' : 'Dias Seguidos'}
            </h3>
            <p className="text-xs text-slate-400">
              Constância nos estudos é o segredo para dominar qualquer tecnologia
            </p>
          </div>
        </div>

        {/* Daily Goal Card */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
              <Target className="w-4 h-4 text-amber-400" /> Meta de Hoje
            </span>
            <span className="font-bold text-white">
              {streak.todayLessonsCompleted} / {streak.dailyGoal} aulas ({progressPercent}%)
            </span>
          </div>

          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700/60">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isGoalReached ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {isGoalReached ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold pt-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Meta de hoje batida! Parabéns pelo foco! 🎉</span>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 pt-1">
              Complete mais {Math.max(0, streak.dailyGoal - streak.todayLessonsCompleted)} aula(s) hoje para manter a chama acesa.
            </p>
          )}
        </div>

        {/* Change Goal */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 block">
            Ajustar Meta Diária de Aulas:
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 5].map((g) => (
              <button
                key={g}
                onClick={() => handleSetGoal(g)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition border min-h-[40px] active:scale-95 ${
                  streak.dailyGoal === g
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                }`}
              >
                {g} {g === 1 ? 'aula' : 'aulas'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats footer */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Seu melhor recorde: <strong className="text-white">{streak.bestStreak} dias</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition active:scale-95"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
