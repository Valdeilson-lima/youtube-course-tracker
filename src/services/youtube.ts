import { Course, Lesson } from '../types';

export function extractPlaylistId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();

  // Direct playlist ID check
  if (
    /^[a-zA-Z0-9_-]{10,}$/.test(trimmed) &&
    (trimmed.startsWith('PL') ||
      trimmed.startsWith('UU') ||
      trimmed.startsWith('FL') ||
      trimmed.startsWith('RD') ||
      trimmed.startsWith('OL') ||
      trimmed.startsWith('TL'))
  ) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const listParam = url.searchParams.get('list');
    if (listParam) return listParam;
  } catch {
    // Regex fallback
    const match = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return match[1];
  }

  return null;
}

export function extractVideoId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * 1. Tenta carregar através do servidor Vite local (/api/playlist)
 * Não sofre com CORS nem bloqueio de navegador
 */
export async function fetchPlaylistViaLocalServer(
  playlistId: string
): Promise<{ title: string; channelTitle: string; description: string; lessons: Lesson[] }> {
  const res = await fetch(`/api/playlist?id=${encodeURIComponent(playlistId)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erro HTTP ${res.status} ao carregar playlist`);
  }
  const data = await res.json();
  if (!data.lessons || data.lessons.length === 0) {
    throw new Error('A playlist não possui vídeos visíveis ou é privada.');
  }
  return data;
}

/**
 * 2. Busca itens da playlist usando a API oficial v3 (se o usuário informou chave)
 */
export async function fetchPlaylistViaApi(
  playlistId: string,
  apiKey: string
): Promise<{ title: string; channelTitle: string; description: string; lessons: Lesson[] }> {
  const plUrl = `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${apiKey}`;
  const plRes = await fetch(plUrl);
  if (!plRes.ok) {
    const err = await plRes.json();
    throw new Error(err?.error?.message || 'Erro ao carregar detalhes da playlist');
  }
  const plData = await plRes.json();
  const plSnippet = plData.items?.[0]?.snippet || {};

  const itemsUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}&key=${apiKey}`;
  const itemsRes = await fetch(itemsUrl);
  if (!itemsRes.ok) {
    const err = await itemsRes.json();
    throw new Error(err?.error?.message || 'Erro ao carregar vídeos da playlist');
  }
  const itemsData = await itemsRes.json();

  const lessons: Lesson[] = (itemsData.items || [])
    .filter(
      (item: any) =>
        item.snippet?.title !== 'Private video' && item.snippet?.title !== 'Deleted video'
    )
    .map((item: any, idx: number) => {
      const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
      const title = item.snippet?.title || `Aula ${idx + 1}`;
      const thumb =
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url ||
        `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      return {
        id: videoId,
        title,
        thumbnailUrl: thumb,
        completed: false,
        lastPositionSeconds: 0,
      };
    });

  return {
    title: plSnippet.title || 'Curso Sem Nome',
    channelTitle: plSnippet.channelTitle || 'Canal do YouTube',
    description: plSnippet.description || '',
    lessons,
  };
}

/**
 * 3. Fallback: Busca via RSS com proxies alternativos
 */
export async function fetchPlaylistViaRssFallback(
  playlistId: string
): Promise<{ title: string; channelTitle: string; description: string; lessons: Lesson[] }> {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
  const proxies = [
    `https://corsproxy.io/?url=${encodeURIComponent(rssUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`,
  ];

  let lastError: any = null;
  for (const proxyUrl of proxies) {
    try {
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;

      const xmlText = await res.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      const channelTitle = xmlDoc.querySelector('author > name')?.textContent || 'Canal do YouTube';
      const playlistTitle = xmlDoc.querySelector('feed > title')?.textContent || 'Curso do YouTube';

      const entryNodes = xmlDoc.querySelectorAll('entry');
      const lessons: Lesson[] = [];

      entryNodes.forEach((entry, idx) => {
        const videoId =
          entry.querySelector('videoId')?.textContent ||
          entry.querySelector('yt\\:videoId')?.textContent;
        const title = entry.querySelector('title')?.textContent || `Aula ${idx + 1}`;

        if (videoId) {
          lessons.push({
            id: videoId,
            title,
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
            completed: false,
            lastPositionSeconds: 0,
          });
        }
      });

      if (lessons.length > 0) {
        return {
          title: playlistTitle,
          channelTitle,
          description: `Playlist importada com ${lessons.length} aulas`,
          lessons,
        };
      }
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('Não foi possível obter dados públicos da playlist.');
}

/**
 * Função unificada com estratégia de fallback inteligente
 */
export async function fetchPlaylistData(
  playlistId: string,
  apiKey?: string
): Promise<{ title: string; channelTitle: string; description: string; lessons: Lesson[] }> {
  // Se usuário forneceu chave API
  if (apiKey && apiKey.trim().length > 15) {
    try {
      return await fetchPlaylistViaApi(playlistId, apiKey);
    } catch (e) {
      console.warn('Falha na API v3, tentando servidor local:', e);
    }
  }

  // 1ª tentativa: Servidor local Vite (sem limites e sem CORS)
  try {
    return await fetchPlaylistViaLocalServer(playlistId);
  } catch (localErr: any) {
    console.warn('Falha no endpoint local, tentando RSS proxy:', localErr);
  }

  // 2ª tentativa: RSS proxy
  try {
    return await fetchPlaylistViaRssFallback(playlistId);
  } catch (rssErr: any) {
    throw new Error(
      'Não foi possível importar automaticamente esta playlist. Verifique se a playlist é Pública ou use a aba "Lista Manual de Vídeos" para colar os links diretamente.'
    );
  }
}

/**
 * Importa múltiplos links colados manualmente
 */
export function parseManualLessonList(rawText: string): Lesson[] {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const lessons: Lesson[] = [];

  lines.forEach((line, index) => {
    const parts = line.split(/[|;]/);
    let urlOrId = parts[0].trim();
    let title = parts[1]?.trim();

    if (!extractVideoId(urlOrId) && parts[1] && extractVideoId(parts[1].trim())) {
      urlOrId = parts[1].trim();
      title = parts[0].trim();
    }

    const videoId = extractVideoId(urlOrId);
    if (videoId) {
      lessons.push({
        id: videoId,
        title: title || `Aula ${String(index + 1).padStart(2, '0')}`,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        completed: false,
        lastPositionSeconds: 0,
      });
    }
  });

  return lessons;
}

/**
 * Sincroniza incrementalmente uma playlist existente com o YouTube:
 * - Mantém intactas todas as aulas já concluídas, anotações e progresso.
 * - Adiciona novos vídeos lançados no final da lista.
 */
export async function syncCoursePlaylist(
  course: Course,
  apiKey?: string
): Promise<{ updatedCourse: Course; addedCount: number }> {
  if (!course.playlistId || course.playlistId.trim() === '') {
    throw new Error('Este curso não possui um ID de playlist do YouTube associado.');
  }

  const freshData = await fetchPlaylistData(course.playlistId, apiKey);
  const existingIdSet = new Set(course.lessons.map((l) => l.id));

  const newLessons: Lesson[] = [];

  for (const freshLesson of freshData.lessons) {
    if (!existingIdSet.has(freshLesson.id)) {
      newLessons.push({
        ...freshLesson,
        completed: false,
        lastPositionSeconds: 0,
      });
      existingIdSet.add(freshLesson.id);
    }
  }

  if (newLessons.length === 0) {
    return {
      updatedCourse: course,
      addedCount: 0,
    };
  }

  const updatedCourse: Course = {
    ...course,
    lessons: [...course.lessons, ...newLessons],
    lastAccessedAt: new Date().toISOString(),
  };

  return {
    updatedCourse,
    addedCount: newLessons.length,
  };
}

