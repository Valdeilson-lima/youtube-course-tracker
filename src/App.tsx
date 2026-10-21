import React, { useState, useEffect, useRef } from 'react';
import { Course, UserSettings } from './types';
import {
  loadCourses,
  saveCourses,
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
} from './utils/storage';
import {
  getSupabaseClient,
  syncAllCoursesWithCloud,
  saveCourseToCloud,
  deleteCourseFromCloud,
  saveUserSettingsToCloud,
  loadUserSettingsFromCloud,
  saveUserStreakToCloud,
  loadUserStreakFromCloud,
} from './services/supabase';
import { User } from '@supabase/supabase-js';
import { Header } from './components/Header';
import { CourseList } from './components/CourseList';
import { Classroom } from './components/Classroom';
import { AddCourseModal } from './components/AddCourseModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { OfflineBanner } from './components/OfflineBanner';
import { StreakModal } from './components/StreakModal';
import { DEFAULT_STREAK, StudyStreakData, calculateNextStreak, recordStudyTime } from './utils/streak';
import { syncCoursePlaylist } from './services/youtube';
import { ToastProvider, useToast } from './context/ToastContext';
import { Smartphone, AlertCircle, Database, RefreshCw } from 'lucide-react';

const AppContent: React.FC = () => {
  const toast = useToast();
  const [courses, setCourses] = useState<Course[]>(() => loadCourses());
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [streak, setStreak] = useState<StudyStreakData>(() => DEFAULT_STREAK);
  const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const coursesRef = useRef(courses);

  // Supabase Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    coursesRef.current = courses;
  }, [courses]);

  // Se o usuário deslogar enquanto estiver dentro de uma sala de aula, volta ao dashboard
  useEffect(() => {
    if (!user && currentCourseId) {
      setCurrentCourseId(null);
    }
  }, [user, currentCourseId]);

  // Helper para exigir login antes de qualquer ação
  const requireAuth = (action: () => void, promptMessage?: string): boolean => {
    if (!user) {
      if (promptMessage) {
        toast.info('Login Necessário', promptMessage);
      }
      setIsAuthModalOpen(true);
      return false;
    }
    action();
    return true;
  };

  // Listen to PWA install prompt
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Sync handler with cloud
  const handleCloudSync = async (activeUser: User, showToast = false) => {
    setIsSyncing(true);
    try {
      // Carrega settings e streak da nuvem
      const cloudSettings = loadUserSettingsFromCloud(activeUser, DEFAULT_SETTINGS);
      const cloudStreak = loadUserStreakFromCloud(activeUser, DEFAULT_STREAK);
      setSettings(cloudSettings);
      setStreak(cloudStreak);

      const mergedCourses = await syncAllCoursesWithCloud(coursesRef.current, activeUser.id);
      if (Array.isArray(mergedCourses)) {
        setCourses(mergedCourses);
        saveCourses(mergedCourses);
      }
      if (showToast) {
        toast.success('Sincronizado!', 'Seus cursos estão 100% atualizados na nuvem.');
      }
    } catch (err: any) {
      console.error('Falha na sincronização:', err);
      if (showToast) {
        const message = err instanceof Error ? err.message : 'Verifique sua conexão ou tente novamente.';
        toast.error('Erro na sincronização', message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Listen to Supabase Auth changes
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setIsAuthChecking(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        handleCloudSync(session.user);
      }
      setIsAuthChecking(false);
    }).catch(() => {
      setIsAuthChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Sincronização em segundo plano silenciosa (não emite toast repetitivo)
        handleCloudSync(session.user, false);
      } else {
        setCourses([]);
        setIsAuthModalOpen(true);
      }
      setIsAuthChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Current active course
  const currentCourse = courses.find((c) => c.id === currentCourseId) || null;

  // Handlers
  const handleSelectCourse = (course: Course) => {
    requireAuth(
      () => setCurrentCourseId(course.id),
      'Faça login para acessar suas aulas e acompanhar seu progresso no banco de dados.'
    );
  };

  const handleOpenAddModal = () => {
    requireAuth(
      () => setIsAddModalOpen(true),
      'Faça login para importar novas playlists e salvá-las na sua conta.'
    );
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
        console.error('Falha ao atualizar curso na nuvem:', err)
      );
    }
  };

  const handleUpdateLessonProgress = (
    courseId: string,
    lessonId: string,
    partialProgress: Partial<import('./types').Lesson>
  ) => {
    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== courseId) return c;
        const updatedLessons = c.lessons.map((l) =>
          l.id === lessonId ? { ...l, ...partialProgress } : l
        );
        const updatedCourse = {
          ...c,
          lessons: updatedLessons,
          lastAccessedAt: new Date().toISOString(),
        };

        if (user) {
          saveCourseToCloud(updatedCourse, user.id).catch(console.error);
        }

        return updatedCourse;
      })
    );

    // Se completou a aula, avança o streak diário
    if (partialProgress.completed) {
      setStreak((prev) => {
        const next = calculateNextStreak(prev);
        if (user) {
          saveUserStreakToCloud(user.id, next);
        }
        return next;
      });
    }
  };

  const handleRecordStudyTime = (seconds: number) => {
    setStreak((prev) => {
      const updated = recordStudyTime(seconds, prev);
      if (user) {
        saveUserStreakToCloud(user.id, updated);
      }
      return updated;
    });
  };

  const handleUpdateCourseCategory = (courseId: string, newCategory: string) => {
    if (!user) {
      toast.warning('Acesso Restrito', 'Faça login para alterar categorias.');
      setIsAuthModalOpen(true);
      return;
    }

    setCourses((prev) =>
      prev.map((c) => {
        if (c.id === courseId) {
          const updated = { ...c, category: newCategory };
          saveCourseToCloud(updated, user.id).catch(console.error);
          return updated;
        }
        return c;
      })
    );
  };

  const handleDeleteCourse = (courseId: string) => {
    if (!user) {
      toast.warning('Acesso Restrito', 'Faça login para excluir cursos.');
      setIsAuthModalOpen(true);
      return;
    }

    setCourses((prev) => prev.filter((c) => c.id !== courseId));
    if (currentCourseId === courseId) {
      setCurrentCourseId(null);
    }
    deleteCourseFromCloud(courseId, user.id).catch(console.error);
  };

  const handleResetCourseProgress = (courseId: string) => {
    if (!user) {
      toast.warning('Acesso Restrito', 'Faça login para reiniciar progresso.');
      setIsAuthModalOpen(true);
      return;
    }

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
          saveCourseToCloud(updated, user.id).catch(console.error);
          return updated;
        }
        return c;
      })
    );
  };

  const handleAddCourse = (newCourse: Course) => {
    if (!user) {
      toast.error('Erro de Autenticação', 'Você precisa estar logado para salvar cursos.');
      setIsAuthModalOpen(true);
      return;
    }

    setCourses((prev) => [newCourse, ...prev]);
    setCurrentCourseId(newCourse.id);
    toast.success('Curso Adicionado!', `"${newCourse.title}" foi importado com sucesso.`);

    saveCourseToCloud(newCourse, user.id).catch((err) =>
      console.error('Falha ao salvar na nuvem:', err)
    );
  };

  const handleResetAllData = () => {
    if (!user) {
      toast.warning('Acesso Restrito', 'Faça login para gerenciar dados.');
      setIsAuthModalOpen(true);
      return;
    }

    setCourses([]);
    setSettings(DEFAULT_SETTINGS);
    saveCourses([]);
    saveSettings(DEFAULT_SETTINGS);
    setCurrentCourseId(null);
    saveUserSettingsToCloud(user.id, DEFAULT_SETTINGS);
    toast.info('Dados Restaurados', 'As configurações e cursos voltaram aos padrões.');
  };

  const handleImportCourses = (imported: Course[]) => {
    if (!user) {
      toast.warning('Acesso Restrito', 'Faça login para importar cursos.');
      setIsAuthModalOpen(true);
      return;
    }

    setCourses(imported);
    saveCourses(imported);
    toast.success('Backup Restaurado', `${imported.length} cursos foram importados.`);
    imported.forEach((c) => saveCourseToCloud(c, user.id).catch(console.error));
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
    if (!user) {
      toast.warning('Acesso Restrito', 'Faça login para buscar novidades na playlist.');
      setIsAuthModalOpen(true);
      return;
    }

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

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 animate-pulse">
          <Database className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">TubeCourse Cloud</h2>
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          Conectando ao banco de dados...
        </p>
      </div>
    );
  }

  return (
    <div className="study-shell min-h-screen text-slate-100 flex flex-col font-sans">
      <OfflineBanner onReconnected={() => user && handleCloudSync(user, false)} />

      {/* Banner de Aviso quando o usuário NÃO está conectado */}
      {!user && (
        <aside
          aria-label="Aviso de sincronização"
          className="bg-amber-500/10 border-b border-amber-500/20 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-200"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">
              <strong>Modo Desconectado:</strong> Faça login para que seu progresso fique salvo no banco de dados e sincronizado entre casa e trabalho.
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
        onOpenAddModal={handleOpenAddModal}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenStreakModal={() => setIsStreakModalOpen(true)}
        onManualSync={user ? () => handleCloudSync(user, true) : undefined}
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
            onRecordStudyTime={handleRecordStudyTime}
          />
        ) : (
          <CourseList
            courses={courses}
            user={user}
            onSelectCourse={handleSelectCourse}
            onDeleteCourse={handleDeleteCourse}
            onResetCourseProgress={handleResetCourseProgress}
            onUpdateCourseCategory={handleUpdateCourseCategory}
            onOpenAddModal={handleOpenAddModal}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
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
            handleCloudSync(loggedUser, true);
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
