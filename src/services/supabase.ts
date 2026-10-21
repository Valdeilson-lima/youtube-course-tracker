import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Course, Category } from '../types';

export const SUPABASE_SQL_SCHEMA = `-- 1. Execute este script no SQL Editor do seu projeto Supabase:

-- Cria a tabela de cursos se não existir
create table if not exists public.courses (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  playlist_id text not null,
  title text not null,
  description text default '',
  channel_title text default '',
  thumbnail_url text default '',
  category text default 'Geral',
  current_lesson_id text default '',
  lessons jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  last_accessed_at timestamp with time zone default timezone('utc'::text, now())
);

-- Garante que todas as colunas existem mesmo se a tabela foi criada anteriormente:
alter table public.courses add column if not exists playlist_id text default '';
alter table public.courses add column if not exists description text default '';
alter table public.courses add column if not exists channel_title text default '';
alter table public.courses add column if not exists thumbnail_url text default '';
alter table public.courses add column if not exists category text default 'Geral';
alter table public.courses add column if not exists current_lesson_id text default '';
alter table public.courses add column if not exists lessons jsonb default '[]'::jsonb;
alter table public.courses add column if not exists last_accessed_at timestamp with time zone default timezone('utc'::text, now());

-- Habilita Row Level Security (RLS) para proteger os dados de cada usuário
alter table public.courses enable row level security;

-- Permite executar este script novamente sem erro de política já existente
drop policy if exists "Usuários podem visualizar seus próprios cursos" on public.courses;
drop policy if exists "Usuários podem inserir seus próprios cursos" on public.courses;
drop policy if exists "Usuários podem atualizar seus próprios cursos" on public.courses;
drop policy if exists "Usuários podem deletar seus próprios cursos" on public.courses;

-- Política de Leitura/Gravação restrita ao próprio usuário autenticado
create policy "Usuários podem visualizar seus próprios cursos"
  on public.courses for select
  using (auth.uid() = user_id);

create policy "Usuários podem inserir seus próprios cursos"
  on public.courses for insert
  with check (auth.uid() = user_id);

create policy "Usuários podem atualizar seus próprios cursos"
  on public.courses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Usuários podem deletar seus próprios cursos"
  on public.courses for delete
  using (auth.uid() = user_id);
`;

const STORAGE_KEY_SUPABASE = 'tube_supabase_config_v1';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function loadSupabaseConfig(): SupabaseConfig {
  const envUrl =
    import.meta.env.VITE_SUPABASE_URL || 'https://wptcpxfncngvevjfwjzs.supabase.co';
  const envKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_NoVZGBqpDTg_hLeLlAgiPQ_UFtOixVr';

  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUPABASE);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        url: parsed.url || envUrl,
        anonKey: parsed.anonKey || envKey,
      };
    }
  } catch {}

  return { url: envUrl, anonKey: envKey };
}

export function saveSupabaseConfig(config: SupabaseConfig) {
  try {
    localStorage.setItem(STORAGE_KEY_SUPABASE, JSON.stringify(config));
  } catch {}
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const config = loadSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }

  if (
    !supabaseInstance ||
    (supabaseInstance as any).supabaseUrl !== config.url
  ) {
    supabaseInstance = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return supabaseInstance;
}

export function resetSupabaseClient() {
  supabaseInstance = null;
}

/**
 * Busca todos os cursos salvos pelo usuário no Supabase
 */
export async function syncCoursesFromCloud(userId: string): Promise<Course[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('courses')
    .select('*')
    .eq('user_id', userId)
    .order('last_accessed_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar cursos do Supabase:', error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    playlistId: row.playlist_id,
    title: row.title,
    description: row.description || '',
    channelTitle: row.channel_title || '',
    thumbnailUrl: row.thumbnail_url || '',
    category: row.category || 'Geral',
    currentLessonId: row.current_lesson_id || '',
    lessons: row.lessons || [],
    createdAt: row.created_at,
    lastAccessedAt: row.last_accessed_at,
  }));
}

/**
 * Salva ou atualiza um curso no Supabase
 */
export async function saveCourseToCloud(course: Course, userId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const payload: any = {
    id: course.id,
    user_id: userId,
    playlist_id: course.playlistId,
    title: course.title,
    description: course.description || '',
    channel_title: course.channelTitle || '',
    thumbnail_url: course.thumbnailUrl || '',
    category: course.category || 'Geral',
    current_lesson_id: course.currentLessonId || '',
    lessons: course.lessons || [],
    last_accessed_at: course.lastAccessedAt || new Date().toISOString(),
  };

  let { error } = await client.from('courses').upsert(payload, { onConflict: 'id' });

  // Se o Supabase falhar porque a coluna 'category' não existe no schema cache do banco antigo (PGRST204)
  if (error && (error.code === 'PGRST204' || error.message?.includes('category'))) {
    console.warn(
      'A coluna "category" não foi encontrada na tabela courses do Supabase. Salvando em modo compatibilidade...',
      error.message
    );
    const fallbackPayload = { ...payload };
    delete fallbackPayload.category;
    const retry = await client.from('courses').upsert(fallbackPayload, { onConflict: 'id' });
    error = retry.error;
  }

  if (error) {
    console.error('Erro ao salvar curso no Supabase:', error);
    throw error;
  }
}

/**
 * Deleta um curso no Supabase
 */
export async function deleteCourseFromCloud(courseId: string, userId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const { error } = await client.from('courses').delete().eq('id', courseId).eq('user_id', userId);
  if (error) {
    console.error('Erro ao remover curso do Supabase:', error);
    throw error;
  }
}

/**
 * Mescla de forma inteligente o estado local e em nuvem de um curso:
 * - Preserva aulas marcadas como concluídas em qualquer um dos lados.
 * - Preserva a maior minutagem assistida (lastPositionSeconds).
 * - Preserva as notas de estudo digitadas.
 * - Adiciona aulas novas identificadas em qualquer lado.
 */
function mergeCourses(local: Course, cloud: Course): Course {
  const localDate = new Date(local.lastAccessedAt || 0).getTime();
  const cloudDate = new Date(cloud.lastAccessedAt || 0).getTime();
  const mostRecentDate = localDate >= cloudDate ? local.lastAccessedAt : cloud.lastAccessedAt;

  const cloudLessonMap = new Map((cloud.lessons || []).map((l) => [l.id, l]));
  const mergedLessons = (local.lessons || []).map((localLesson) => {
    const cloudLesson = cloudLessonMap.get(localLesson.id);
    if (!cloudLesson) return localLesson;

    return {
      ...localLesson,
      completed: Boolean(localLesson.completed || cloudLesson.completed),
      lastPositionSeconds: Math.max(
        localLesson.lastPositionSeconds || 0,
        cloudLesson.lastPositionSeconds || 0
      ),
      notes: localLesson.notes?.trim() ? localLesson.notes : cloudLesson.notes || '',
    };
  });

  // Inclui eventuais aulas da nuvem que ainda não estavam no cliente local
  const localLessonIdSet = new Set((local.lessons || []).map((l) => l.id));
  for (const cloudLesson of cloud.lessons || []) {
    if (!localLessonIdSet.has(cloudLesson.id)) {
      mergedLessons.push(cloudLesson);
    }
  }

  return {
    ...cloud,
    ...local,
    category: local.category || cloud.category || 'Geral',
    lessons: mergedLessons,
    currentLessonId:
      localDate >= cloudDate
        ? local.currentLessonId || cloud.currentLessonId
        : cloud.currentLessonId || local.currentLessonId,
    lastAccessedAt: mostRecentDate,
  };
}

/**
 * Sincronização inteligente bidirecional:
 * 1. Baixa os cursos da nuvem.
 * 2. Faz o merge refinado de progresso, aulas e anotações.
 * 3. Envia os cursos novos ou atualizados para o Supabase.
 */
export async function syncAllCoursesWithCloud(
  localCourses: Course[],
  userId: string
): Promise<Course[]> {
  const client = getSupabaseClient();
  if (!client) return localCourses;

  const cloudCourses = await syncCoursesFromCloud(userId);

  const cloudMap = new Map<string, Course>(cloudCourses.map((c) => [c.id, c]));
  const mergedCourses: Course[] = [];

  // 1. Processa todos os cursos locais
  for (const local of localCourses) {
    const cloud = cloudMap.get(local.id);
    if (!cloud) {
      // Curso existe localmente mas ainda não na nuvem: sobe para o Supabase
      try {
        await saveCourseToCloud(local, userId);
      } catch (err) {
        console.warn(`[Sync] Falha ao subir curso local "${local.title}":`, err);
      }
      mergedCourses.push(local);
    } else {
      // Curso existe em ambos: mescla progresso e anotações
      const merged = mergeCourses(local, cloud);
      mergedCourses.push(merged);

      // Se o curso mesclado tiver dados novos em relação à nuvem, sincroniza
      const needsCloudUpdate =
        JSON.stringify(merged.lessons) !== JSON.stringify(cloud.lessons) ||
        merged.category !== cloud.category ||
        merged.currentLessonId !== cloud.currentLessonId;

      if (needsCloudUpdate) {
        try {
          await saveCourseToCloud(merged, userId);
        } catch (err) {
          console.warn(`[Sync] Falha ao atualizar curso mesclado "${merged.title}":`, err);
        }
      }

      cloudMap.delete(local.id);
    }
  }

  // 2. Adiciona cursos que estavam salvos na nuvem mas não no dispositivo local
  for (const [, cloud] of cloudMap) {
    mergedCourses.push(cloud);
  }

  return mergedCourses;
}

/**
 * Salva as preferências de reprodução/configurações do usuário no Supabase
 */
export async function saveUserSettingsToCloud(
  _userId: string,
  settings: import('../types').UserSettings
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { error } = await client.auth.updateUser({
      data: { settings },
    });
    if (error) {
      console.warn('Erro ao salvar configurações no Supabase:', error.message);
    }
  } catch (err) {
    console.warn('Falha ao sincronizar configurações com o banco:', err);
  }
}

/**
 * Carrega as preferências do usuário diretamente do perfil no Supabase
 */
export function loadUserSettingsFromCloud(
  user: User | null,
  fallback: import('../types').UserSettings
): import('../types').UserSettings {
  if (user?.user_metadata?.settings) {
    return { ...fallback, ...user.user_metadata.settings };
  }
  return fallback;
}

/**
 * Salva o streak (sequência e meta de estudos) do usuário no Supabase
 */
export async function saveUserStreakToCloud(
  _userId: string,
  streak: import('../utils/streak').StudyStreakData
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { error } = await client.auth.updateUser({
      data: { streak },
    });
    if (error) {
      console.warn('Erro ao salvar streak no Supabase:', error.message);
    }
  } catch (err) {
    console.warn('Falha ao salvar streak no banco:', err);
  }
}

/**
 * Carrega a sequência de estudos do usuário diretamente do Supabase
 */
export function loadUserStreakFromCloud(
  user: User | null,
  fallback: import('../utils/streak').StudyStreakData
): import('../utils/streak').StudyStreakData {
  if (user?.user_metadata?.streak) {
    return { ...fallback, ...user.user_metadata.streak };
  }
  return fallback;
}
