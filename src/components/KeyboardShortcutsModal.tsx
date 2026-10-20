import React, { useEffect } from 'react';
import { X, Keyboard, Play, SkipBack, SkipForward, CheckCircle2, Volume2, Clock, HelpCircle } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  icon: React.ReactNode;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts: ShortcutItem[] = [
    {
      keys: ['Espaço', 'K'],
      description: 'Alternar Play / Pausar vídeo',
      icon: <Play className="w-4 h-4 text-red-400" />,
    },
    {
      keys: ['J'],
      description: 'Voltar 10 segundos no vídeo',
      icon: <SkipBack className="w-4 h-4 text-amber-400" />,
    },
    {
      keys: ['L'],
      description: 'Avançar 10 segundos no vídeo',
      icon: <SkipForward className="w-4 h-4 text-amber-400" />,
    },
    {
      keys: ['N'],
      description: 'Avançar para a próxima aula',
      icon: <SkipForward className="w-4 h-4 text-blue-400" />,
    },
    {
      keys: ['P'],
      description: 'Voltar para a aula anterior',
      icon: <SkipBack className="w-4 h-4 text-blue-400" />,
    },
    {
      keys: ['C'],
      description: 'Marcar / Desmarcar aula como concluída',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    },
    {
      keys: ['M'],
      description: 'Ativar / Desativar som (Mudo)',
      icon: <Volume2 className="w-4 h-4 text-purple-400" />,
    },
    {
      keys: ['T'],
      description: 'Inserir timestamp atual nas anotações',
      icon: <Clock className="w-4 h-4 text-amber-400" />,
    },
    {
      keys: ['?'],
      description: 'Abrir este guia de atalhos rápidos',
      icon: <HelpCircle className="w-4 h-4 text-slate-400" />,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 id="shortcuts-modal-title" className="text-base sm:text-lg font-bold text-white">
                Atalhos de Teclado
              </h3>
              <p className="text-xs text-slate-400">
                Navegue pelas aulas e controle o player sem tirar as mãos do teclado
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar atalhos"
            className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="grid grid-cols-1 gap-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0">{shortcut.icon}</span>
                <span className="text-xs sm:text-sm text-slate-300 truncate">
                  {shortcut.description}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-3">
                {shortcut.keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="px-2.5 py-1 text-xs font-mono font-semibold text-slate-200 bg-slate-800 border border-slate-700 rounded-lg shadow-sm"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
          <span>Dica: Os atalhos ficam inativos ao digitar nas anotações.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition active:scale-95 min-h-[38px]"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
