import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Course } from '../types';

export const SUPABASE_SQL_SCHEMA = `-- 1. Execute este script no SQL Editor do seu projeto Supabase:

-- Cria a tabela de cursos
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

-- Habilita Row Level Security (RLS) para proteger os dados de cada usuário
alter table public.courses enable row level security;

-- Política de Leitura/Gravação restrita ao próprio usuário autenticado
create policy "Usuários podem visualizar seus próprios cursos"
  on public.courses for select
  using (auth.uid() = user_id);

create policy "Usuários podem inserir seus próprios cursos"
  on public.courses for insert
  with check (auth.uid() = user_id);

create policy "Usuários podem atualizar seus próprios cursos"
  on public.courses for update
  using (auth.uid() = user_id);

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

  const payload = {
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

  const { error } = await client.from('courses').upsert(payload, { onConflict: 'id' });
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
 * Sincronização inteligente bidirecional:
 * 1. Baixa os cursos da nuvem.
 * 2. Se a nuvem estiver vazia e o usuário tiver cursos locais, sobe todos os locais para a nuvem!
 * 3. Se ambos tiverem cursos, mescla os locais que faltam na nuvem.
 */
export async function syncAllCoursesWithCloud(
  localCourses: Course[],
  userId: string
): Promise<Course[]> {
  const client = getSupabaseClient();
  if (!client) return localCourses;

  const cloudCourses = await syncCoursesFromCloud(userId);

  if (cloudCourses.length > 0) {
    // Cloud tem cursos. Se local tiver algum curso que ainda não está na nuvem, faz upload.
    const cloudIds = new Set(cloudCourses.map((c) => c.id));
    for (const local of localCourses) {
      if (!cloudIds.has(local.id)) {
        await saveCourseToCloud(local, userId).catch(console.error);
        cloudCourses.push(local);
      }
    }
    return cloudCourses;
  }

  // Cloud está vazia. Se local tiver cursos, sobe TODOS para o Supabase!
  if (localCourses.length > 0) {
    for (const local of localCourses) {
      await saveCourseToCloud(local, userId).catch(console.error);
    }
    return localCourses;
  }

  return [];
}
