import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Course, Lesson, Category } from '../types';

export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- SCHEMA NORMALIZADO PARA O TUBECOURSE TRACKER (SUPABASE / POSTGRESQL)
-- Execute este script no SQL Editor do seu projeto Supabase:
-- ==============================================================================

-- 1. Tabela de Categorias (Normalizada)
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text default 'purple',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique (user_id, name)
);

-- 2. Tabela de Cursos
create table if not exists public.courses (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  playlist_id text not null,
  title text not null,
  description text default '',
  channel_title text default '',
  thumbnail_url text default '',
  category text default 'Geral',
  category_id uuid references public.categories(id) on delete set null,
  current_lesson_id text default '',
  lessons jsonb default '[]'::jsonb, -- mantido para compatibilidade retroativa
  created_at timestamp with time zone default timezone('utc'::text, now()),
  last_accessed_at timestamp with time zone default timezone('utc'::text, now())
);

-- Adiciona a coluna category_id em courses se já existir a tabela courses
alter table public.courses
  add column if not exists category_id uuid references public.categories(id) on delete set null;

-- 3. Tabela de Aulas (Normalizada)
create table if not exists public.lessons (
  course_id text references public.courses(id) on delete cascade not null,
  id text not null, -- Video ID do YouTube
  title text not null,
  duration text default '',
  thumbnail_url text default '',
  position integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (course_id, id)
);

-- 4. Tabela de Progresso da Aula por Usuário (Normalizada e de Alta Performance)
create table if not exists public.user_lesson_progress (
  user_id uuid references auth.users(id) on delete cascade not null,
  course_id text not null,
  lesson_id text not null,
  completed boolean not null default false,
  completed_at timestamp with time zone,
  last_position_seconds integer default 0,
  notes text default '',
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (user_id, course_id, lesson_id),
  foreign key (course_id, lesson_id) references public.lessons(course_id, id) on delete cascade
);

-- Índices de alta performance
create index if not exists idx_categories_user on public.categories(user_id);
create index if not exists idx_courses_category on public.courses(category_id);
create index if not exists idx_lessons_course on public.lessons(course_id, position);
create index if not exists idx_progress_user_course on public.user_lesson_progress(user_id, course_id);
create index if not exists idx_progress_completed on public.user_lesson_progress(user_id, completed);

-- 5. Habilita RLS (Row Level Security)
alter table public.categories enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.user_lesson_progress enable row level security;

-- Políticas de RLS para categories
drop policy if exists "Usuários podem gerenciar suas próprias categorias" on public.categories;
create policy "Usuários podem gerenciar suas próprias categorias"
  on public.categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Políticas de RLS para courses
drop policy if exists "Usuários podem gerenciar seus próprios cursos" on public.courses;
create policy "Usuários podem gerenciar seus próprios cursos"
  on public.courses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Políticas de RLS para lessons (acesso através do curso do usuário)
drop policy if exists "Usuários podem gerenciar aulas dos seus cursos" on public.lessons;
create policy "Usuários podem gerenciar aulas dos seus cursos"
  on public.lessons for all
  using (
    exists (
      select 1 from public.courses c
      where c.id = lessons.course_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.courses c
      where c.id = lessons.course_id and c.user_id = auth.uid()
    )
  );

-- Políticas de RLS para user_lesson_progress
drop policy if exists "Usuários podem gerenciar seu próprio progresso" on public.user_lesson_progress;
create policy "Usuários podem gerenciar seu próprio progresso"
  on public.user_lesson_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 6. Migração Automática e Segura de Categorias dos Cursos Existentes
insert into public.categories (user_id, name)
select distinct user_id, coalesce(nullif(trim(category), ''), 'Geral') as name
from public.courses
where user_id is not null
on conflict (user_id, name) do nothing;

update public.courses c
set category_id = cat.id
from public.categories cat
where cat.user_id = c.user_id 
  and cat.name = coalesce(nullif(trim(c.category), ''), 'Geral')
  and c.category_id is null;

-- 7. Migração Automática e Segura de Aulas Legadas
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'courses' and column_name = 'lessons'
  ) then
    -- Migra aulas para a tabela lessons usando funções nativas seguras
    insert into public.lessons (course_id, id, title, duration, thumbnail_url, position)
    select 
      c.id as course_id,
      jsonb_extract_path_text(elem, 'id') as id,
      coalesce(jsonb_extract_path_text(elem, 'title'), 'Aula') as title,
      coalesce(jsonb_extract_path_text(elem, 'duration'), '') as duration,
      coalesce(jsonb_extract_path_text(elem, 'thumbnailUrl'), '') as thumbnail_url,
      (t.ordinality - 1)::integer as position
    from public.courses c
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(c.lessons) = 'array' then c.lessons else '[]'::jsonb end
    ) with ordinality as t(elem, ordinality)
    where jsonb_extract_path_text(elem, 'id') is not null
      and jsonb_extract_path_text(elem, 'id') != ''
    on conflict (course_id, id) do update set
      title = excluded.title,
      duration = excluded.duration,
      thumbnail_url = excluded.thumbnail_url,
      position = excluded.position;

    -- Migra progresso para a tabela user_lesson_progress
    insert into public.user_lesson_progress (user_id, course_id, lesson_id, completed, completed_at, last_position_seconds, notes)
    select 
      c.user_id,
      c.id as course_id,
      jsonb_extract_path_text(elem, 'id') as lesson_id,
      coalesce(nullif(jsonb_extract_path_text(elem, 'completed'), '')::boolean, false) as completed,
      case 
        when nullif(jsonb_extract_path_text(elem, 'completedAt'), '') is not null 
        then (jsonb_extract_path_text(elem, 'completedAt'))::timestamptz 
        else null 
      end as completed_at,
      coalesce(nullif(jsonb_extract_path_text(elem, 'lastPositionSeconds'), '')::integer, 0) as last_position_seconds,
      coalesce(jsonb_extract_path_text(elem, 'notes'), '') as notes
    from public.courses c
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(c.lessons) = 'array' then c.lessons else '[]'::jsonb end
    ) as elem
    where jsonb_extract_path_text(elem, 'id') is not null
      and jsonb_extract_path_text(elem, 'id') != ''
    on conflict (user_id, course_id, lesson_id) do update set
      completed = excluded.completed,
      completed_at = excluded.completed_at,
      last_position_seconds = excluded.last_position_seconds,
      notes = excluded.notes;
  end if;
end $$;
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
 * Suporta o schema normalizado (courses + lessons + user_lesson_progress)
 * com fallback transparente para o modelo legado (courses.lessons jsonb).
 */
export async function syncCoursesFromCloud(userId: string): Promise<Course[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data: coursesData, error: coursesError } = await client
    .from('courses')
    .select('*')
    .eq('user_id', userId)
    .order('last_accessed_at', { ascending: false });

  if (coursesError) {
    console.error('Erro ao buscar cursos do Supabase:', coursesError);
    throw coursesError;
  }

  if (!coursesData || coursesData.length === 0) {
    return [];
  }

  const courseIds = coursesData.map((c: any) => c.id);

  // Tenta buscar aulas da tabela normalizada
  let normalizedLessonsMap = new Map<string, any[]>();
  let progressMap = new Map<string, any>(); // key: `${courseId}_${lessonId}`

  try {
    const [lessonsRes, progressRes] = await Promise.all([
      client
        .from('lessons')
        .select('*')
        .in('course_id', courseIds)
        .order('position', { ascending: true }),
      client
        .from('user_lesson_progress')
        .select('*')
        .eq('user_id', userId)
        .in('course_id', courseIds),
    ]);

    if (!lessonsRes.error && lessonsRes.data && lessonsRes.data.length > 0) {
      for (const item of lessonsRes.data) {
        const list = normalizedLessonsMap.get(item.course_id) || [];
        list.push(item);
        normalizedLessonsMap.set(item.course_id, list);
      }
    }

    if (!progressRes.error && progressRes.data) {
      for (const p of progressRes.data) {
        progressMap.set(`${p.course_id}_${p.lesson_id}`, p);
      }
    }
  } catch (err) {
    // Caso as tabelas ainda não existam no banco, usaremos o fallback JSONB
    console.warn('Tabelas normalizadas não encontradas ou erro na consulta, usando fallback JSONB:', err);
  }

  return coursesData.map((row: any) => {
    const normalizedLessons = normalizedLessonsMap.get(row.id);

    let lessons: Lesson[] = [];
    if (normalizedLessons && normalizedLessons.length > 0) {
      lessons = normalizedLessons.map((l: any) => {
        const prog = progressMap.get(`${row.id}_${l.id}`);
        return {
          id: l.id,
          title: l.title,
          duration: l.duration || '',
          thumbnailUrl: l.thumbnail_url || '',
          completed: Boolean(prog?.completed),
          completedAt: prog?.completed_at || undefined,
          lastPositionSeconds: prog?.last_position_seconds || 0,
          notes: prog?.notes || '',
        };
      });
    } else {
      // Fallback para JSONB legado
      lessons = row.lessons || [];
    }

    return {
      id: row.id,
      playlistId: row.playlist_id,
      title: row.title,
      description: row.description || '',
      channelTitle: row.channel_title || '',
      thumbnailUrl: row.thumbnail_url || '',
      category: row.category || 'Geral',
      categoryId: row.category_id || undefined,
      currentLessonId: row.current_lesson_id || '',
      lessons,
      createdAt: row.created_at,
      lastAccessedAt: row.last_accessed_at,
    };
  });
}

/**
 * Salva ou atualiza um curso completo no Supabase (normalizado)
 */
export async function saveCourseToCloud(course: Course, userId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const coursePayload: any = {
    id: course.id,
    user_id: userId,
    playlist_id: course.playlistId,
    title: course.title,
    description: course.description || '',
    channel_title: course.channelTitle || '',
    thumbnail_url: course.thumbnailUrl || '',
    category: course.category || 'Geral',
    current_lesson_id: course.currentLessonId || '',
    lessons: course.lessons || [], // mantido em sincronia para compatibilidade
    last_accessed_at: course.lastAccessedAt || new Date().toISOString(),
  };

  if (course.categoryId) {
    coursePayload.category_id = course.categoryId;
  }

  const { error: courseError } = await client.from('courses').upsert(coursePayload, { onConflict: 'id' });
  if (courseError) {
    console.error('Erro ao salvar curso no Supabase:', courseError);
    throw courseError;
  }

  // Se tiver aulas, salva em lote nas tabelas normalizadas
  if (course.lessons && course.lessons.length > 0) {
    const lessonsBatch = course.lessons.map((l, index) => ({
      course_id: course.id,
      id: l.id,
      title: l.title,
      duration: l.duration || '',
      thumbnail_url: l.thumbnailUrl || '',
      position: index,
    }));

    const progressBatch = course.lessons.map((l) => ({
      user_id: userId,
      course_id: course.id,
      lesson_id: l.id,
      completed: Boolean(l.completed),
      completed_at: l.completedAt || null,
      last_position_seconds: l.lastPositionSeconds || 0,
      notes: l.notes || '',
      updated_at: new Date().toISOString(),
    }));

    // Executa upserts silenciosos para tabela normalizada
    try {
      await Promise.all([
        client.from('lessons').upsert(lessonsBatch, { onConflict: 'course_id,id' }),
        client.from('user_lesson_progress').upsert(progressBatch, { onConflict: 'user_id,course_id,lesson_id' }),
      ]);
    } catch (e) {
      console.warn('Aviso: Não foi possível salvar em tabelas normalizadas (verifique se rodou o script SQL):', e);
    }
  }
}

/**
 * Atualização ATÔMICA e RESILIENTE do progresso de uma única aula no banco de dados!
 * Atualiza a tabela normalizada user_lesson_progress E TAMBÉM a tabela courses.
 */
export async function updateLessonProgressInCloud(
  userId: string,
  courseId: string,
  lessonId: string,
  progress: {
    completed?: boolean;
    completedAt?: string;
    lastPositionSeconds?: number;
    notes?: string;
  },
  allLessons?: Lesson[]
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const payload: any = {
    user_id: userId,
    course_id: courseId,
    lesson_id: lessonId,
    updated_at: new Date().toISOString(),
  };

  if (progress.completed !== undefined) payload.completed = progress.completed;
  if (progress.completedAt !== undefined) payload.completed_at = progress.completedAt;
  if (progress.lastPositionSeconds !== undefined) payload.last_position_seconds = progress.lastPositionSeconds;
  if (progress.notes !== undefined) payload.notes = progress.notes;

  try {
    const p1 = Promise.resolve(
      client
        .from('user_lesson_progress')
        .upsert(payload, { onConflict: 'user_id,course_id,lesson_id' })
    );

    const promises: Promise<any>[] = [p1];

    if (allLessons && allLessons.length > 0) {
      const p2 = Promise.resolve(
        client
          .from('courses')
          .update({
            lessons: allLessons,
            last_accessed_at: new Date().toISOString(),
          })
          .eq('id', courseId)
          .eq('user_id', userId)
      );
      promises.push(p2);
    }

    const results = await Promise.allSettled(promises);
    results.forEach((r, idx) => {
      if (r.status === 'rejected') {
        console.warn(`Aviso ao persistir progresso na etapa ${idx}:`, r.reason);
      }
    });
  } catch (err) {
    console.warn('Falha na atualização de progresso no banco:', err);
  }
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

/**
 * Deleta um curso no Supabase (CASCADE cuidará das aulas e progressos)
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
 * Sincronização inteligente bidirecional
 */
export async function syncAllCoursesWithCloud(
  localCourses: Course[],
  userId: string
): Promise<Course[]> {
  const client = getSupabaseClient();
  if (!client) return localCourses;

  const cloudCourses = await syncCoursesFromCloud(userId);

  if (cloudCourses.length > 0) {
    const cloudIds = new Set(cloudCourses.map((c) => c.id));
    for (const local of localCourses) {
      if (!cloudIds.has(local.id)) {
        await saveCourseToCloud(local, userId).catch(console.error);
        cloudCourses.push(local);
      }
    }
    return cloudCourses;
  }

  if (localCourses.length > 0) {
    for (const local of localCourses) {
      await saveCourseToCloud(local, userId).catch(console.error);
    }
    return localCourses;
  }

  return [];
}

/**
 * Busca todas as categorias salvas pelo usuário no Supabase
 */
export async function fetchCategoriesFromCloud(userId: string): Promise<Category[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) {
      console.warn('Tabela categories ainda não configurada no Supabase:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.warn('Erro ao consultar categories:', err);
    return [];
  }
}

/**
 * Salva ou atualiza uma categoria no Supabase
 */
export async function saveCategoryToCloud(
  userId: string,
  name: string,
  color: string = 'purple'
): Promise<Category | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const payload = {
      user_id: userId,
      name: name.trim(),
      color,
    };

    const { data, error } = await client
      .from('categories')
      .upsert(payload, { onConflict: 'user_id,name' })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar categoria no Supabase:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      color: data.color,
      createdAt: data.created_at,
    };
  } catch (err) {
    console.error('Falha ao salvar categoria:', err);
    return null;
  }
}

/**
 * Deleta uma categoria no Supabase
 */
export async function deleteCategoryFromCloud(userId: string, categoryId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { error } = await client
      .from('categories')
      .delete()
      .eq('id', categoryId)
      .eq('user_id', userId);

    if (error) {
      console.error('Erro ao excluir categoria do Supabase:', error);
    }
  } catch (err) {
    console.error('Falha ao excluir categoria:', err);
  }
}
