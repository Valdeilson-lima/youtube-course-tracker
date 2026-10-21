import React, { useState, useEffect } from 'react';
import { Course, UserSettings } from './types';
import {
  INITIAL_DEMO_COURSES,
  DEFAULT_SETTINGS,
} from './utils/storage';
import {
  getSupabaseClient,
  syncCoursesFromCloud,
  saveCourseToCloud,
  deleteCourseFromCloud,
  updateLessonProgressInCloud,
  saveUserSettingsToCloud,
  loadUserSettingsFromCloud,
  saveUserStreakToCloud,
  loadUserStreakFromCloud,
} from './services/supabase';
import { Lesson } from './types';
import { User } from '@supabase/supabase-js';
import { Header } from './components/Header';
import { CourseList } from './components/CourseList';
import { Classroom } from './components/Classroom';
import { AddCourseModal } from './components/AddCourseModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { OfflineBanner } from './components/OfflineBanner';
import { StreakModal } from './components/StreakModal';
import { calculateNextStreak, DEFAULT_STREAK, StudyStreakData } from './utils/streak';
import { syncCoursePlaylist } from './services/youtube';
import { ToastProvider, useToast } from './context/ToastContext';
import { Smartphone, Database, AlertCircle, RefreshCw } from 'lucide-react';

const AppContent: React.FC = () => {
  const toast = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [streak, setStreak] = useState<StudyStreakData>(DEFAULT_STREAK);
  const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(true);

  // Supabase Auth state
  const [user, setUser] = useState<User | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Listen to PWA install prompt
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Carrega todos os dados do usuário direto do Banco de Dados Supabase
  const loadUserDataFromDatabase = async (activeUser: User, showToast = false) => {
    setIsSyncing(true);
    try {
      // 1. Carrega configurações e streak do usuário na nuvem
      const cloudSettings = loadUserSettingsFromCloud(activeUser, DEFAULT_SETTINGS);
      const cloudStreak = loadUserStreakFromCloud(activeUser, DEFAULT_STREAK);
      setSettings(cloudSettings);
      setStreak(cloudStreak);

      // 2. Carrega cursos do banco de dados
      const cloudCourses = await syncCoursesFromCloud(activeUser.id);
      if (cloudCourses && cloudCourses.length > 0) {
        setCourses(cloudCourses);
      } else {
        // Primeiro acesso: inicializa os cursos de demonstração gravando direto no banco
        for (const demo of INITIAL_DEMO_COURSES) {
          await saveCourseToCloud(demo, activeUser.id).catch(console.error);
        }
        setCourses(INITIAL_DEMO_COURSES);
      }

      if (showToast) {
        toast.success('Banco de Dados Conectado!', 'Seus cursos estão 100% atualizados na nuvem.');
      }
    } catch (err: any) {
      console.error('Falha ao sincronizar com banco de dados:', err);
      if (showToast) {
        toast.error('Erro de Conexão', 'Não foi possível carregar os cursos do banco de dados.');
      }
    } finally {
      setIsSyncing(false);
      setIsLoadingCloud(false);
    }
  };

  // Gerencia o ciclo de autenticação do Supabase
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setIsLoadingCloud(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        loadUserDataFromDatabase(sessionUser, false);
      } else {
        setIsLoadingCloud(false);
        // Abre o modal para incentivar login imediato para persistência no banco
        setIsAuthModalOpen(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        loadUserDataFromDatabase(sessionUser, true);
      } else {
        setCourses([]);
        setIsLoadingCloud(false);
        setIsAuthModalOpen(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Current active course
  const currentCourse = courses.find((c) => c.id === currentCourseId) || null;

  // Handlers
  const handleSelectCourse = (course: Course) => {
    setCurrentCourseId(course.id);
  };

  const handleBackToDashboard = () => {
    setCurrentCourseId(null);
  };

  const handleUpdateCourse = (updatedCourse: Course) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c))
    );

    // Salva direto no Supabase
    if (user) {
      saveCourseToCloud(updatedCourse, user.id).catch((err) =>
        console.error('Falha ao atualizar curso no banco:', err)
      );
    }
  };

  const handleUpdateLessonProgress = (
    courseId: string,
    lessonId: string,
    partialProgress: Partial<Lesson>
  ) => {
    let latestCourseLessons: Lesson[] = [];

    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== courseId) return c;
        const updatedLessons = c.lessons.map((l) =>
          l.id === lessonId ? { ...l, ...partialProgress } : l
        );
        latestCourseLessons = updatedLessons;
        return {
          ...c,
          lessons: updatedLessons,
          lastAccessedAt: new Date().toISOString(),
        };
      })
    );

    // Atualiza sequência de estudos (streak) no banco de dados se aula foi marcada como concluída
    if (partialProgress.completed) {
      setStreak((prev) => {
        const next = calculateNextStreak(prev);
        if (user) {
          saveUserStreakToCloud(user.id, next);
        }
        return next;
      });
    }

    // Grava atomicamente no banco de dados Supabase
    if (user) {
      updateLessonProgressInCloud(
        user.id,
        courseId,
        lessonId,
        {
          completed: partialProgress.completed,
          completedAt: partialProgress.completedAt,
          lastPositionSeconds: partialProgress.lastPositionSeconds,
          notes: partialProgress.notes,
        },
        latestCourseLessons
      ).catch((err) =>
        console.error('Falha ao salvar progresso da aula no banco:', err)
      );
    }
  };

  const handleUpdateCourseCategory = (courseId: string, newCategory: string) => {
    setCourses((prev) =>
      prev.map((c) => {
        if (c.id === courseId) {
          const updated = { ...c, category: newCategory };
          if (user) {
            saveCourseToCloud(updated, user.id).catch(console.error);
          }
          return updated;
        }
        return c;
      })
    );
  };

  const handleDeleteCourse = (courseId: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== courseId));
    if (currentCourseId === courseId) {
      setCurrentCourseId(null);
    }

    if (user) {
      deleteCourseFromCloud(courseId, user.id).catch(console.error);
    }
  };

  const handleResetCourseProgress = (courseId: string) => {
    setCourses((prev) =>
      prev.map((c) => {
        if (c.id === courseId) {
          const updated = {
            ...c,
            lessons: c.lessons.map((l) => ({
              ...l,
              completed: false,
              completedAt: undefined,
              lastPositionSeconds: 0,
            })),
          };
          if (user) {
            saveCourseToCloud(updated, user.id).catch(console.error);
          }
          return updated;
        }
        return c;
      })
    );
  };

  const handleAddCourse = (newCourse: Course) => {
    setCourses((prev) => [newCourse, ...prev]);
    setCurrentCourseId(newCourse.id);
    toast.success('Curso Adicionado!', `"${newCourse.title}" foi importado com sucesso.`);

    if (user) {
      saveCourseToCloud(newCourse, user.id)
        .then(() => toast.info('Salvo no Banco', 'Curso gravado com sucesso no Supabase.'))
        .catch((err) => console.error('Falha ao salvar no banco:', err));
    }
  };

  const handleLoadDemoCourses = () => {
    setCourses(INITIAL_DEMO_COURSES);
    toast.success('Cursos Restaurados', 'Cursos de demonstração recarregados.');
    if (user) {
      INITIAL_DEMO_COURSES.forEach((c) => saveCourseToCloud(c, user.id).catch(console.error));
    }
  };

  const handleResetAllData = () => {
    setCourses(INITIAL_DEMO_COURSES);
    setSettings(DEFAULT_SETTINGS);
    setCurrentCourseId(null);
    if (user) {
      saveUserSettingsToCloud(user.id, DEFAULT_SETTINGS);
      INITIAL_DEMO_COURSES.forEach((c) => saveCourseToCloud(c, user.id).catch(console.error));
    }
    toast.info('Dados Restaurados', 'As configurações e cursos voltaram aos padrões.');
  };

  const handleImportCourses = (imported: Course[]) => {
    setCourses(imported);
    toast.success('Backup Importado', `${imported.length} cursos foram importados.`);
    if (user) {
      imported.forEach((c) => saveCourseToCloud(c, user.id).catch(console.error));
    }
  };

  const handleSaveSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    if (user) {
      saveUserSettingsToCloud(user.id, newSettings);
    }
  };

  const handleUpdateStreak = (newStreak: StudyStreakData) => {
    setStreak(newStreak);
    if (user) {
      saveUserStreakToCloud(user.id, newStreak);
    }
  };

  const handleInstallPWA = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        setDeferredPrompt(null);
        toast.success('Aplicativo Instalado!', 'TubeCourse adicionado à sua tela inicial.');
      });
    }
  };

  const handleSyncCoursePlaylist = async (course: Course) => {
    try {
      toast.info('Sincronizando Playlist', `Buscando novidades para "${course.title}"...`);
      const { updatedCourse, addedCount } = await syncCoursePlaylist(course, settings.youtubeApiKey);
      if (addedCount > 0) {
        handleUpdateCourse(updatedCourse);
        toast.success('Playlist Atualizada!', `${addedCount} nova(s) aula(s) foram adicionadas ao curso.`);
      } else {
        toast.info('Tudo Atualizado', 'Nenhuma aula nova foi adicionada a esta playlist no YouTube.');
      }
    } catch (err: any) {
      toast.error('Erro na sincronização', err?.message || 'Não foi possível consultar a playlist.');
    }
  };

  // Tela de carregamento elegante enquanto conecta ao banco de dados
  if (isLoadingCloud) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 animate-pulse">
          <Database className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">TubeCourse Cloud</h2>
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          Conectando e carregando dados do banco...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <OfflineBanner onReconnected={() => user && loadUserDataFromDatabase(user, false)} />

      {/* Banner de Aviso quando o usuário NÃO está conectado */}
      {!user && (
        <aside
          aria-label="Aviso de sincronização"
          className="bg-amber-500/10 border-b border-amber-500/20 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-200"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">
              <strong>Modo Desconectado:</strong> Conecte sua conta para salvar o progresso no banco de dados e sincronizar entre casa e trabalho.
            </span>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition shrink-0 cursor-pointer"
          >
            Conectar Agora
          </button>
        </aside>
      )}

      <Header
        courses={courses}
        currentCourse={currentCourse}
        user={user}
        isSyncing={isSyncing}
        streak={streak}
        onBackToDashboard={handleBackToDashboard}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenStreakModal={() => setIsStreakModalOpen(true)}
        onManualSync={user ? () => loadUserDataFromDatabase(user, true) : undefined}
      />

      {/* PWA Install Notice on mobile */}
      {deferredPrompt && (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-600 px-3 sm:px-4 py-2 flex items-center justify-between text-xs text-white shadow-md">
          <div className="flex items-center gap-2 min-w-0">
            <Smartphone className="w-4 h-4 shrink-0" />
            <span className="truncate">Instale o TubeCourse como app no seu celular!</span>
          </div>
          <button
            onClick={handleInstallPWA}
            className="px-2.5 py-1 bg-white text-red-600 font-bold rounded-lg shadow hover:bg-slate-100 transition shrink-0 ml-2"
          >
            Instalar
          </button>
        </div>
      )}

      <main className="flex-1">
        {currentCourse ? (
          <Classroom
            key={currentCourse.id}
            course={currentCourse}
            settings={settings}
            onBack={handleBackToDashboard}
            onUpdateCourse={handleUpdateCourse}
            onUpdateLessonProgress={handleUpdateLessonProgress}
          />
        ) : (
          <CourseList
            courses={courses}
            onSelectCourse={handleSelectCourse}
            onDeleteCourse={handleDeleteCourse}
            onResetCourseProgress={handleResetCourseProgress}
            onUpdateCourseCategory={handleUpdateCourseCategory}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onLoadDemoCourses={handleLoadDemoCourses}
            onSyncCoursePlaylist={handleSyncCoursePlaylist}
          />
        )}
      </main>

      <AddCourseModal
        isOpen={isAddModalOpen}
        settings={settings}
        onClose={() => setIsAddModalOpen(false)}
        onAddCourse={handleAddCourse}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        courses={courses}
        onClose={() => setIsSettingsOpen(false)}
        onSaveSettings={handleSaveSettings}
        onImportCourses={handleImportCourses}
        onResetAllData={handleResetAllData}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        user={user}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(loggedUser) => {
          setUser(loggedUser);
          if (loggedUser) {
            loadUserDataFromDatabase(loggedUser, true);
          }
        }}
      />

      <StreakModal
        isOpen={isStreakModalOpen}
        onClose={() => setIsStreakModalOpen(false)}
        streak={streak}
        onUpdateStreak={handleUpdateStreak}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};
