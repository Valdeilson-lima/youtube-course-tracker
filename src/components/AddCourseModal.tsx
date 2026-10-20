import React, { useState, useEffect } from 'react';
import { Course, Lesson, UserSettings } from '../types';
import {
  extractPlaylistId,
  fetchPlaylistData,
  parseManualLessonList,
} from '../services/youtube';
import { YouTubeIcon } from './YouTubeIcon';
import {
  X,
  Sparkles,
  AlertCircle,
  Loader2,
  ListPlus,
  Link2,
  Tag,
  Plus,
} from 'lucide-react';

interface AddCourseModalProps {
  isOpen: boolean;
  settings: UserSettings;
  onClose: () => void;
  onAddCourse: (newCourse: Course) => void;
}

const POPULAR_CATEGORIES = [
  'Inteligência Artificial',
  'Python',
  'JavaScript',
  'PHP',
  'React',
  'Node.js',
  'HTML & CSS',
  'Java',
  'C# / .NET',
  'Banco de Dados',
  'Git & DevOps',
  'Idiomas',
  'Design & UX',
  'Finanças & Negócios',
];

const SAMPLE_PLAYLISTS = [
  {
    title: 'Curso de Inteligência Artificial - IA',
    channel: 'Curso em Vídeo',
    category: 'Inteligência Artificial',
    url: 'https://www.youtube.com/watch?v=jQMbuK6URws&list=PLHz_AreHm4dm24MhlWJYiR_Rm7TFtvs6S',
  },
  {
    title: 'Curso de Python 3 - Mundo 1: Fundamentos',
    channel: 'Curso em Vídeo',
    category: 'Python',
    url: 'https://www.youtube.com/playlist?list=PLHz_AreHm4dlKP6QQCekuIPky1CiwmdI6',
  },
  {
    title: 'HTML5 e CSS3 Moderno Completo',
    channel: 'Gustavo Guanabara',
    category: 'HTML & CSS',
    url: 'https://www.youtube.com/playlist?list=PLHz_AreHm4dkZ9-atkcmcBaMZdmLHft8n',
  },
];

function detectCategoryFromText(text: string): string | null {
  const lower = text.toLowerCase();
  if (
    lower.includes('inteligência artificial') ||
    lower.includes('inteligencia artificial') ||
    lower.includes(' ia ') ||
    lower.includes('ia -') ||
    lower.includes('chatgpt') ||
    lower.includes('machine learning') ||
    lower.includes('deep learning')
  ) {
    return 'Inteligência Artificial';
  }
  if (lower.includes('python') || lower.includes('django') || lower.includes('flask')) {
    return 'Python';
  }
  if (
    lower.includes('javascript') ||
    lower.includes('typescript') ||
    lower.includes(' js ') ||
    lower.includes(' ts ')
  ) {
    return 'JavaScript';
  }
  if (lower.includes('php') || lower.includes('laravel')) {
    return 'PHP';
  }
  if (lower.includes('react') || lower.includes('next.js') || lower.includes('nextjs')) {
    return 'React';
  }
  if (lower.includes('html') || lower.includes('css')) {
    return 'HTML & CSS';
  }
  if (lower.includes('inglês') || lower.includes('ingles') || lower.includes('english')) {
    return 'Idiomas';
  }
  return null;
}

export const AddCourseModal: React.FC<AddCourseModalProps> = ({
  isOpen,
  settings,
  onClose,
  onAddCourse,
}) => {
  const [tab, setTab] = useState<'url' | 'manual'>('url');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [manualText, setManualText] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [category, setCategory] = useState('Inteligência Artificial');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-detect category when customTitle or URL changes
  useEffect(() => {
    const detected = detectCategoryFromText(customTitle || playlistUrl);
    if (detected) {
      setCategory(detected);
    }
  }, [customTitle, playlistUrl]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    const finalCategory = isAddingCustomCategory && customCategoryInput.trim()
      ? customCategoryInput.trim()
      : category;

    try {
      if (tab === 'url') {
        const playlistId = extractPlaylistId(playlistUrl);
        if (!playlistId) {
          throw new Error('Link ou ID de playlist inválido. Por favor, cole uma URL completa do YouTube.');
        }

        const result = await fetchPlaylistData(playlistId, settings.youtubeApiKey);

        if (!result.lessons || result.lessons.length === 0) {
          throw new Error('Nenhum vídeo pôde ser extraído desta playlist.');
        }

        // Try detecting category from fetched title if still generic
        let resolvedCategory = finalCategory;
        if (!isAddingCustomCategory) {
          const autoCat = detectCategoryFromText(result.title);
          if (autoCat) resolvedCategory = autoCat;
        }

        const newCourse: Course = {
          id: `course-${Date.now()}`,
          playlistId,
          title: customTitle.trim() || result.title,
          description: result.description,
          channelTitle: result.channelTitle,
          thumbnailUrl: result.lessons[0]?.thumbnailUrl || '',
          lessons: result.lessons,
          currentLessonId: result.lessons[0]?.id || '',
          category: resolvedCategory,
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
        };

        onAddCourse(newCourse);
        onClose();
      } else {
        // Manual mode
        const parsedLessons = parseManualLessonList(manualText);
        if (parsedLessons.length === 0) {
          throw new Error('Nenhum link de vídeo válido foi encontrado no texto inserido.');
        }

        const newCourse: Course = {
          id: `course-${Date.now()}`,
          playlistId: `custom-${Date.now()}`,
          title: customTitle.trim() || 'Meu Curso Personalizado',
          description: `Curso criado manualmente com ${parsedLessons.length} aulas.`,
          channelTitle: 'Personalizado',
          thumbnailUrl: parsedLessons[0]?.thumbnailUrl || '',
          lessons: parsedLessons,
          currentLessonId: parsedLessons[0]?.id || '',
          category: finalCategory,
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
        };

        onAddCourse(newCourse);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro ao carregar a playlist. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickSample = (sample: typeof SAMPLE_PLAYLISTS[0]) => {
    setPlaylistUrl(sample.url);
    setCustomTitle(sample.title);
    setCategory(sample.category);
    setIsAddingCustomCategory(false);
    setTab('url');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
              <YouTubeIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Adicionar Nova Playlist</h3>
              <p className="text-xs text-slate-400">Importe do YouTube e organize por tecnologia/categoria</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 px-6 pt-3 gap-6 text-sm">
          <button
            type="button"
            onClick={() => setTab('url')}
            className={`flex items-center gap-2 pb-3 font-medium transition border-b-2 ${
              tab === 'url'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>Link da Playlist</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('manual')}
            className={`flex items-center gap-2 pb-3 font-medium transition border-b-2 ${
              tab === 'manual'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListPlus className="w-4 h-4" />
            <span>Lista Manual de Vídeos</span>
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {tab === 'url' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                URL da Playlist do YouTube
              </label>
              <input
                type="text"
                required
                placeholder="https://www.youtube.com/playlist?list=PL..."
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 transition"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Cole a URL completa de qualquer playlist pública do YouTube.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Lista de Links / IDs dos Vídeos (um por linha)
              </label>
              <textarea
                required
                rows={4}
                placeholder="https://www.youtube.com/watch?v=VIDEO_ID_1 | Aula 01&#10;https://www.youtube.com/watch?v=VIDEO_ID_2 | Aula 02"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 transition"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Formato opcional: <code className="text-red-400">URL | Nome da Aula</code>
              </p>
            </div>
          )}

          {/* Custom Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Título do Curso (Opcional - detecta o título do YouTube automaticamente)
            </label>
            <input
              type="text"
              placeholder="Ex: Inteligência Artificial do Zero"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 transition"
            />
          </div>

          {/* Category Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-red-400" />
                Categoria / Tecnologia
              </label>
              <button
                type="button"
                onClick={() => setIsAddingCustomCategory(!isAddingCustomCategory)}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-medium transition"
              >
                {isAddingCustomCategory ? 'Escolher das sugestões' : '+ Digitar outra categoria'}
              </button>
            </div>

            {isAddingCustomCategory ? (
              <input
                type="text"
                placeholder="Ex: Rust, Kotlin, Docker, Inteligência Artificial..."
                value={customCategoryInput}
                onChange={(e) => setCustomCategoryInput(e.target.value)}
                autoFocus
                className="w-full bg-slate-950 border border-red-500/50 rounded-xl px-4 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 transition"
              />
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-950/40 rounded-xl border border-slate-800/80">
                {POPULAR_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                      category === cat
                        ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                        : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Sample Links */}
          {tab === 'url' && (
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Exemplos de playlists para testar:
              </span>
              <div className="space-y-1.5">
                {SAMPLE_PLAYLISTS.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePickSample(sample)}
                    className="w-full text-left p-2 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-medium">
                        {sample.category}
                      </span>
                      <span className="font-medium group-hover:text-red-400 transition truncate">
                        {sample.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                      {sample.channel}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-red-600/25 transition active:scale-95"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importando Aulas...</span>
                </>
              ) : (
                <span>Criar Curso</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
