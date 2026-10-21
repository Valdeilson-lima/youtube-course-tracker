import React, { useState } from 'react';
import { LessonSummary, CodeSnippet } from '../services/ai';
import {
  Sparkles,
  X,
  Copy,
  Check,
  FilePlus,
  BookOpen,
  Lightbulb,
  CheckCircle2,
  Code2,
  Terminal,
  Headphones,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface AiSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: LessonSummary | null;
  isLoading: boolean;
  onInsertIntoNotes: (markdownToAppend: string) => void;
}

const HighlightedCode: React.FC<{ code: string; language: string }> = ({ code }) => {
  const lines = code.split('\n');

  const highlightSyntax = (raw: string) => {
    // Escape HTML special characters
    let escaped = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Comentários: // ou # ou /*
    if (escaped.trim().startsWith('//') || escaped.trim().startsWith('#')) {
      return `<span class="text-slate-500 italic">${escaped}</span>`;
    }

    // Strings
    escaped = escaped.replace(
      /(["'`].*?["'`])/g,
      '<span class="text-emerald-300 font-medium">$1</span>'
    );

    // Palavras-chave essenciais de programação
    escaped = escaped.replace(
      /\b(const|let|var|function|def|class|return|import|export|from|async|await|if|else|elif|for|while|try|catch|except|finally|new|public|private|interface|type|select|where|insert|update|delete|as|yield|lambda)\b/g,
      '<span class="text-purple-400 font-bold">$1</span>'
    );

    // Booleanos e nulos
    escaped = escaped.replace(
      /\b(true|false|True|False|null|None|undefined)\b/g,
      '<span class="text-amber-400 font-bold">$1</span>'
    );

    // Números isolados
    escaped = escaped.replace(
      /\b(\d+(\.\d+)?)\b/g,
      '<span class="text-amber-300">$1</span>'
    );

    return escaped;
  };

  return (
    <div className="font-mono text-xs sm:text-[13px] leading-relaxed overflow-x-auto p-3.5 select-text bg-slate-950/90 scrollbar-thin">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, idx) => (
            <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
              <td className="w-7 select-none text-slate-600 font-mono text-[11px] pr-3 text-right align-top pt-0.5 opacity-60">
                {idx + 1}
              </td>
              <td
                className="whitespace-pre text-slate-200"
                dangerouslySetInnerHTML={{ __html: highlightSyntax(line) || '&nbsp;' }}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const AiSummaryModal: React.FC<AiSummaryModalProps> = ({
  isOpen,
  onClose,
  summary,
  isLoading,
  onInsertIntoNotes,
}) => {
  const toast = useToast();
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleCopyAll = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary.markdown);
    setCopiedAll(true);
    toast.success('Copiado!', 'Resumo e códigos copiados para a área de transferência.');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopyCode = (snippet: CodeSnippet, index: number) => {
    navigator.clipboard.writeText(snippet.code);
    setCopiedIndex(index);
    toast.success('Código Copiado!', `Trecho em ${snippet.language.toUpperCase()} copiado.`);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleInsert = () => {
    if (!summary) return;
    onInsertIntoNotes(summary.markdown);
    toast.success('Inserido nas Anotações!', 'O resumo e códigos foram salvos no seu bloco de notas.');
    onClose();
  };

  const isAudioTranscript = summary?.transcriptSource === 'youtube_captions';

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
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Resumo Inteligente & Códigos
                </h3>
                {isAudioTranscript && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Headphones className="w-3 h-3 text-emerald-400" />
                    Áudio Transcrito
                  </span>
                )}
                {summary?.aiModel === 'gemini-1.5-pro' && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-purple-500/30 to-indigo-500/30 text-purple-200 border border-purple-400/40 uppercase tracking-wider font-mono shadow-sm">
                    Gemini 1.5 Pro
                  </span>
                )}
                {summary?.aiModel === 'gemini-1.5-flash' && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-wider font-mono">
                    Gemini Flash
                  </span>
                )}
                {summary?.aiModel === 'offline' && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase tracking-wider font-mono">
                    Modo Offline
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md">
                {summary?.title || 'Analisando e transcrevendo aula...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
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
                Obtendo transcrição do áudio, reconstruindo códigos demonstrados e estruturando pontos-chave para seu aprendizado.
              </p>
            </div>
          ) : summary ? (
            <>
              {/* Offline mode alert banner */}
              {summary.aiModel === 'offline' && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-200">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold text-amber-300">Modo Offline Ativo:</span> Para ativar a transcrição oficial de áudio do YouTube e a reconstrução com o <strong>Gemini 1.5 Pro</strong>, adicione sua chave gratuita do Google AI Studio nas <strong>Configurações (ícone ⚙️)</strong>.
                  </div>
                </div>
              )}

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

              {/* Code Snippets Section (Passo 1 & 2) */}
              {summary.codeSnippets && summary.codeSnippets.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-cyan-400" />
                      Códigos e Implementações da Aula
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      {summary.codeSnippets.length} {summary.codeSnippets.length === 1 ? 'trecho de código' : 'trechos de código'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {summary.codeSnippets.map((snippet, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl border border-cyan-500/25 bg-slate-950 overflow-hidden shadow-lg"
                      >
                        {/* Snippet Header */}
                        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/90 border-b border-slate-800 text-xs">
                          <div className="flex items-center gap-2">
                            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="font-mono text-cyan-300 font-semibold uppercase text-[11px]">
                              {snippet.language || 'código'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopyCode(snippet, idx)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition active:scale-95 cursor-pointer"
                          >
                            {copiedIndex === idx ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-400" />
                                <span>Copiar Código</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Code Body with Highlighting and Line Numbers */}
                        <HighlightedCode code={snippet.code} language={snippet.language} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
          <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 relative z-10 pb-safe">
            <button
              onClick={handleCopyAll}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition border border-slate-700 active:scale-95 min-h-[44px] cursor-pointer"
            >
              {copiedAll ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedAll ? 'Copiado!' : 'Copiar Tudo'}</span>
            </button>

            <button
              onClick={handleInsert}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-purple-600/20 transition active:scale-95 cursor-pointer min-h-[44px]"
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
