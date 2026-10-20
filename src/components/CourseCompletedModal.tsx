import React from 'react';
import { Course } from '../types';
import { Trophy, Award, CheckCircle2, Share2, Download, X, Sparkles, RotateCcw } from 'lucide-react';
import { fireCourseCompletedConfetti } from '../utils/confetti';
import { useToast } from '../context/ToastContext';

interface CourseCompletedModalProps {
  course: Course;
  isOpen: boolean;
  onClose: () => void;
  onDownloadNotes: () => void;
  onResetProgress?: () => void;
  onBackToDashboard?: () => void;
}

export const CourseCompletedModal: React.FC<CourseCompletedModalProps> = ({
  course,
  isOpen,
  onClose,
  onDownloadNotes,
  onResetProgress,
  onBackToDashboard,
}) => {
  const toast = useToast();

  if (!isOpen) return null;

  const totalLessons = course.lessons.length;
  const notesCount = course.lessons.filter((l) => l.notes && l.notes.trim().length > 0).length;

  const handleShare = async () => {
    const shareText = `🎓 Acabei de concluir o curso "${course.title}" (${course.channelTitle}) com todas as ${totalLessons} aulas concluídas pelo YouTube Course Tracker! 🚀`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Curso Concluído: ${course.title}`,
          text: shareText,
          url: window.location.href,
        });
        toast.success('Compartilhado!', 'Sua conquista foi compartilhada com sucesso.');
        return;
      } catch (err) {
        // Fallback to clipboard if share was cancelled or failed
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      toast.success('Copiado!', 'Mensagem de conquista copiada para sua área de transferência!');
    } catch {
      toast.error('Erro ao copiar', 'Não foi possível copiar para a área de transferência.');
    }
  };

  const handleReplayConfetti = () => {
    fireCourseCompletedConfetti();
    toast.success('Celebração! 🎉', 'Parabéns novamente pela dedicação aos estudos!');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-completed-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
    >
      <div
        className="w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/30 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Effects */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 right-0 w-60 h-60 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Fechar modal"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-95"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Trophy Animated Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-xl shadow-amber-500/25 animate-bounce">
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
              <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400 fill-amber-400/20" />
            </div>
          </div>
          <button
            onClick={handleReplayConfetti}
            title="Lançar confetes novamente!"
            className="absolute -bottom-2 -right-2 p-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-full shadow-lg transition active:scale-90"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>

        {/* Title and Praise */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Award className="w-3.5 h-3.5" /> CURSO CONCLUÍDO COM SUCESSO!
          </span>
          <h2
            id="course-completed-title"
            className="text-xl sm:text-2xl font-black text-white leading-tight"
          >
            {course.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Produzido por <span className="text-slate-200 font-semibold">{course.channelTitle}</span>
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 sm:p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-left">
          <div className="space-y-0.5">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium">Progresso</span>
            <div className="flex items-center gap-1 text-emerald-400 font-bold text-sm sm:text-base">
              <CheckCircle2 className="w-4 h-4" />
              <span>100% Completo</span>
            </div>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium">Aulas Assistidas</span>
            <div className="text-white font-bold text-sm sm:text-base">
              {totalLessons} / {totalLessons}
            </div>
          </div>
          <div className="space-y-0.5 col-span-2 sm:col-span-1">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium">Anotações</span>
            <div className="text-amber-300 font-bold text-sm sm:text-base">
              {notesCount} {notesCount === 1 ? 'aula com nota' : 'aulas com notas'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <button
            onClick={handleShare}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-red-600/30 transition active:scale-95 min-h-[44px]"
          >
            <Share2 className="w-4 h-4" />
            <span>Compartilhar Conquista</span>
          </button>

          {notesCount > 0 && (
            <button
              onClick={onDownloadNotes}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-semibold text-xs sm:text-sm transition active:scale-95 min-h-[44px]"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Notas (.md)</span>
            </button>
          )}
        </div>

        {/* Secondary Buttons */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="hover:text-slate-200 transition underline underline-offset-4"
            >
              Ir para Meus Cursos
            </button>
          )}
          <span>•</span>
          <button
            onClick={onClose}
            className="hover:text-slate-200 transition underline underline-offset-4"
          >
            Revisar Aulas deste Curso
          </button>
        </div>
      </div>
    </div>
  );
};
