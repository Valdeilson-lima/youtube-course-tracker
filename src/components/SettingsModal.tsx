import React, { useState } from 'react';
import { UserSettings, Course } from '../types';
import {
  X,
  Settings,
  Key,
  Download,
  Upload,
  RotateCcw,
  Check,
  ShieldCheck,
  Sliders,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  settings: UserSettings;
  courses: Course[];
  onClose: () => void;
  onSaveSettings: (settings: UserSettings) => void;
  onImportCourses: (courses: Course[]) => void;
  onResetAllData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  courses,
  onClose,
  onSaveSettings,
  onImportCourses,
  onResetAllData,
}) => {
  const [currentSettings, setCurrentSettings] = useState<UserSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(currentSettings);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const handleExportBackup = () => {
    const data = {
      courses,
      settings: currentSettings,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-tubecourse-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.courses && Array.isArray(json.courses)) {
          onImportCourses(json.courses);
          if (json.settings) {
            setCurrentSettings(json.settings);
            onSaveSettings(json.settings);
          }
          alert('Backup importado com sucesso!');
          onClose();
        } else {
          alert('Arquivo JSON inválido.');
        }
      } catch (err) {
        alert('Erro ao ler arquivo de backup.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
              <Sliders className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Configurações</h3>
              <p className="text-[11px] sm:text-xs text-slate-400">Personalize seu ambiente de estudo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
          {/* Automation toggles */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Automações do Player
            </h4>

            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={currentSettings.autoMarkCompleted}
                onChange={(e) =>
                  setCurrentSettings({ ...currentSettings, autoMarkCompleted: e.target.checked })
                }
                className="mt-0.5 rounded bg-slate-800 border-slate-700 text-red-600 focus:ring-0 focus:ring-offset-0 w-4 h-4"
              />
              <div>
                <p className="text-sm font-semibold text-white">
                  Marcar como concluído automaticamente
                </p>
                <p className="text-xs text-slate-400">
                  Ao assistir um vídeo até o fim, a aula é marcada como concluída e dispara o progresso.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={currentSettings.autoPlayNext}
                onChange={(e) =>
                  setCurrentSettings({ ...currentSettings, autoPlayNext: e.target.checked })
                }
                className="mt-0.5 rounded bg-slate-800 border-slate-700 text-red-600 focus:ring-0 focus:ring-offset-0 w-4 h-4"
              />
              <div>
                <p className="text-sm font-semibold text-white">Avançar para a próxima aula</p>
                <p className="text-xs text-slate-400">
                  Carrega a próxima aula da playlist automaticamente quando a atual termina.
                </p>
              </div>
            </label>
          </div>

          {/* YouTube API Key (Optional) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                Chave da API do YouTube (Opcional)
              </label>
            </div>
            <input
              type="text"
              placeholder="AIzaSy..."
              value={currentSettings.youtubeApiKey || ''}
              onChange={(e) =>
                setCurrentSettings({ ...currentSettings, youtubeApiKey: e.target.value.trim() })
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 font-mono transition min-h-[44px] sm:min-h-[40px]"
            />
            <p className="text-[11px] text-slate-500">
              Não é obrigatória! Usamos importação pública sem chave por padrão. Se possuir uma chave do Google Cloud Console, insira-a para carregar playlists gigantes sem limite.
            </p>
          </div>

          {/* Gemini AI API Key & Model Selection */}
          <div className="space-y-3 p-4 rounded-2xl bg-purple-950/20 border border-purple-500/25">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Inteligência Artificial (Google Gemini)
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 hover:underline font-medium"
              >
                <span>Obter Chave Gratuita</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-slate-300 font-medium">Chave da API do Gemini</span>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={currentSettings.geminiApiKey || ''}
                onChange={(e) =>
                  setCurrentSettings({ ...currentSettings, geminiApiKey: e.target.value.trim() })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono transition min-h-[44px] sm:min-h-[40px]"
              />
            </div>

            {/* Model Selector: Pro vs Flash */}
            <div className="space-y-1.5 pt-1">
              <span className="text-xs text-slate-300 font-medium">Modelo de IA</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentSettings({
                      ...currentSettings,
                      geminiModel: 'gemini-1.5-pro',
                    })
                  }
                  className={`p-3 rounded-xl border text-left transition active:scale-98 cursor-pointer ${
                    (currentSettings.geminiModel || 'gemini-1.5-pro') === 'gemini-1.5-pro'
                      ? 'bg-purple-600/20 border-purple-400 text-white shadow-sm ring-1 ring-purple-400/30'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      Gemini 1.5 Pro
                      <span className="text-[10px] bg-purple-500/30 text-purple-200 px-1.5 py-0.2 rounded font-mono font-bold">
                        PRO
                      </span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Raciocínio avançado, máxima fidelidade para reconstrução de códigos e aulas longas.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCurrentSettings({
                      ...currentSettings,
                      geminiModel: 'gemini-1.5-flash',
                    })
                  }
                  className={`p-3 rounded-xl border text-left transition active:scale-98 cursor-pointer ${
                    currentSettings.geminiModel === 'gemini-1.5-flash'
                      ? 'bg-purple-600/20 border-purple-400 text-white shadow-sm ring-1 ring-purple-400/30'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      Gemini 1.5 Flash
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                        RÁPIDO
                      </span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Gera resumos leves em menos de 2 segundos. Ideal para conexões rápidas.
                  </p>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 pt-1">
              A chave do Google AI Studio dá acesso gratuito a ambos os modelos. Se o modelo Pro encontrar limite temporário de requisições, o sistema faz fallback automático para o Flash sem travar seu estudo.
            </p>
          </div>

          {/* Backup & Data */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Backup e Armazenamento Local
            </h4>

            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleExportBackup}
                className="flex items-center justify-center gap-2 px-3.5 py-2.5 sm:py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-xl border border-slate-700 transition min-h-[44px] sm:min-h-[38px] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportar Dados (JSON)</span>
              </button>

              <label className="flex items-center justify-center gap-2 px-3.5 py-2.5 sm:py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-xl border border-slate-700 transition min-h-[44px] sm:min-h-[38px] cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                <span>Importar Dados</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  if (confirm('Deseja restaurar os cursos padrão e apagar as alterações?')) {
                    onResetAllData();
                    onClose();
                  }
                }}
                className="flex items-center justify-center gap-2 px-3.5 py-2.5 sm:py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 rounded-xl border border-rose-500/20 transition sm:ml-auto min-h-[44px] sm:min-h-[38px] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Padrões</span>
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white rounded-xl transition min-h-[44px] sm:min-h-[40px] flex items-center justify-center cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-red-600/25 transition active:scale-95 min-h-[44px] sm:min-h-[40px] cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Salvo!</span>
                </>
              ) : (
                <span>Salvar Alterações</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
