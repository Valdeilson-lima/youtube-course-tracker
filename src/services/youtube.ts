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
 * 2. Busca itens da playlist usando a API oficial v3 (com paginação completa e suporte a vídeos de membros)
 */
export async function fetchPlaylistViaApi(
  playlistId: string,
  apiKey: string
): Promise<{ title: string; channelTitle: string; description: string; lessons: Lesson[] }> {
  const cleanKey = apiKey.trim();

  // 1. Busca metadados da playlist
  const plUrl = `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${encodeURIComponent(playlistId)}&key=${cleanKey}`;
  const plRes = await fetch(plUrl);
  if (!plRes.ok) {
    const err = await plRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro HTTP ${plRes.status} ao carregar detalhes da playlist`);
  }
  const plData = await plRes.json();
  const plSnippet = plData.items?.[0]?.snippet || {};

  // 2. Busca TODOS os vídeos com paginação completa (nextPageToken)
  const allItems: any[] = [];
  let nextPageToken: string | undefined = undefined;
  let pageCount = 0;
  const MAX_PAGES = 30; // Suporta playlists com até 1500 vídeos

  do {
    pageCount++;
    let itemsUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails,status&maxResults=50&playlistId=${encodeURIComponent(playlistId)}&key=${cleanKey}`;
    if (nextPageToken) {
      itemsUrl += `&pageToken=${encodeURIComponent(nextPageToken)}`;
    }

    const itemsRes = await fetch(itemsUrl);
    if (!itemsRes.ok) {
      const err = await itemsRes.json().catch(() => ({}));
      if (allItems.length > 0) {
        console.warn('Interrompendo paginação por aviso da API:', err);
        break;
      }
      throw new Error(err?.error?.message || 'Erro ao carregar vídeos da playlist');
    }

    const itemsData = await itemsRes.json();
    if (Array.isArray(itemsData.items)) {
      allItems.push(...itemsData.items);
    }

    nextPageToken = itemsData.nextPageToken;
  } while (nextPageToken && pageCount < MAX_PAGES);

  // 3. Busca a duração exata de todos os vídeos em lotes de 50
  const videoIds = allItems
    .map((item) => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId)
    .filter((id): id is string => Boolean(id && typeof id === 'string'));

  const durationMap: Record<string, string> = {};

  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    try {
      const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${chunk.join(',')}&key=${cleanKey}`;
      const vRes = await fetch(vUrl);
      if (vRes.ok) {
        const vData = await vRes.json();
        for (const vItem of vData.items || []) {
          if (vItem.id && vItem.contentDetails?.duration) {
            durationMap[vItem.id] = vItem.contentDetails.duration;
          }
        }
      }
    } catch {
      // Ignora falha de duração pontual
    }
  }

  // 4. Mapeia as aulas preservando a sequência original e tratando vídeos de membros
  const lessons: Lesson[] = [];

  allItems.forEach((item: any, idx: number) => {
    const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
    if (!videoId) return;

    const rawTitle = (item.snippet?.title || '').trim();
    const isDeleted =
      rawTitle.toLowerCase() === 'deleted video' ||
      rawTitle.toLowerCase() === 'vídeo excluído';

    // Vídeos excluídos que não existem mais são ignorados
    if (isDeleted) return;

    const isPrivateOrMember =
      rawTitle.toLowerCase() === 'private video' ||
      rawTitle.toLowerCase() === 'vídeo privado' ||
      item.status?.privacyStatus === 'private';

    // Vídeos exclusivos para membros mantêm a aula indexada e acessível
    let title = rawTitle;
    if (isPrivateOrMember || !title) {
      title = `Aula ${idx + 1} (Exclusiva para Membros / Restrita)`;
    }

    const thumb =
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.high?.url ||
      item.snippet?.thumbnails?.default?.url ||
      `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

    lessons.push({
      id: videoId,
      title,
      duration: durationMap[videoId] || '',
      thumbnailUrl: thumb,
      completed: false,
      lastPositionSeconds: 0,
    });
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
 * - Mantém intactas todas as aulas já concluídas, anotações e progresso do aluno.
 * - Adiciona novos vídeos lançados respeitando a ordem cronológica original da playlist.
 */
export async function syncCoursePlaylist(
  course: Course,
  apiKey?: string
): Promise<{ updatedCourse: Course; addedCount: number }> {
  if (!course.playlistId || course.playlistId.trim() === '') {
    throw new Error('Este curso não possui um ID de playlist do YouTube associado.');
  }

  const freshData = await fetchPlaylistData(course.playlistId, apiKey);
  const existingLessonsMap = new Map(course.lessons.map((l) => [l.id, l]));

  let addedCount = 0;
  const mergedLessons: Lesson[] = freshData.lessons.map((freshLesson) => {
    const existing = existingLessonsMap.get(freshLesson.id);
    if (existing) {
      // Preserva progresso, notas e timestamp salvos pelo aluno
      return {
        ...freshLesson,
        ...existing,
        duration: existing.duration || freshLesson.duration,
        title: existing.title && !existing.title.startsWith('Aula ') ? existing.title : freshLesson.title,
      };
    } else {
      addedCount++;
      return {
        ...freshLesson,
        completed: false,
        lastPositionSeconds: 0,
      };
    }
  });

  // Mantém também aulas adicionadas manualmente se houver alguma fora da playlist oficial
  const freshIdSet = new Set(freshData.lessons.map((l) => l.id));
  for (const existingLesson of course.lessons) {
    if (!freshIdSet.has(existingLesson.id)) {
      mergedLessons.push(existingLesson);
    }
  }

  if (addedCount === 0 && mergedLessons.length === course.lessons.length) {
    return {
      updatedCourse: course,
      addedCount: 0,
    };
  }

  const updatedCourse: Course = {
    ...course,
    lessons: mergedLessons,
    lastAccessedAt: new Date().toISOString(),
  };

  return {
    updatedCourse,
    addedCount,
  };
}

