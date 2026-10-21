import React, { useState } from 'react';
import { LessonSummary } from '../services/ai';
import {
  Sparkles,
  X,
  Copy,
  Check,
  FilePlus,
  BookOpen,
  Lightbulb,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface AiSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: LessonSummary | null;
  isLoading: boolean;
  onInsertIntoNotes: (markdownToAppend: string) => void;
}

export const AiSummaryModal: React.FC<AiSummaryModalProps> = ({
  isOpen,
  onClose,
  summary,
  isLoading,
  onInsertIntoNotes,
}) => {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary.markdown);
    setCopied(true);
    toast.success('Copiado!', 'Resumo copiado para a área de transferência.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    if (!summary) return;
    onInsertIntoNotes(summary.markdown);
    toast.success('Inserido nas Anotações!', 'O resumo foi adicionado ao seu bloco de notas.');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-purple-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow background */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Resumo Inteligente da Aula
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                  IA
                </span>
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-md">
                {summary?.title || 'Analisando conteúdo da aula...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 relative z-10">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 animate-spin">
                <Sparkles className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-white">A Inteligência Artificial está sintetizando a aula...</p>
              <p className="text-xs text-slate-400 max-w-sm">
                Extraindo conceitos-chave, exemplos práticos e organizando os tópicos mais importantes para o seu aprendizado.
              </p>
            </div>
          ) : summary ? (
            <>
              {/* Overview Card */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  Visão Geral do Conteúdo
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {summary.overview}
                </p>
              </div>

              {/* Key Points */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Conceitos e Pontos Fundamentais
                </h4>
                <div className="grid gap-2">
                  {summary.keyPoints.map((point, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5 text-xs sm:text-sm text-slate-300"
                    >
                      <span className="w-5 h-5 rounded-lg bg-purple-500/10 text-purple-400 font-mono text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tip Card */}
              {summary.tips && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-amber-300 uppercase tracking-wide mb-1">
                      Dica de Aplicação Prática
                    </h5>
                    <p className="text-xs sm:text-sm text-amber-200/90 leading-relaxed">
                      {summary.tips}
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        {summary && !isLoading && (
          <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-3 relative z-10">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition border border-slate-700 active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>

            <button
              onClick={handleInsert}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-purple-600/20 transition active:scale-95 cursor-pointer"
            >
              <FilePlus className="w-4 h-4" />
              <span>Inserir nas minhas Anotações</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
