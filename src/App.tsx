import React, { useState, useEffect } from 'react';
import { Course, UserSettings } from './types';
import {
  loadCourses,
  saveCourses,
  loadSettings,
  saveSettings,
  INITIAL_DEMO_COURSES,
  DEFAULT_SETTINGS,
} from './utils/storage';
import {
  getSupabaseClient,
  syncAllCoursesWithCloud,
  saveCourseToCloud,
  deleteCourseFromCloud,
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
import { getStudyStreak, StudyStreakData } from './utils/streak';
import { syncCoursePlaylist } from './services/youtube';
import { ToastProvider, useToast } from './context/ToastContext';
import { Smartphone } from 'lucide-react';

const AppContent: React.FC = () => {
  const toast = useToast();
  const [courses, setCourses] = useState<Course[]>(() => loadCourses());
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [streak, setStreak] = useState<StudyStreakData>(() => getStudyStreak());
  const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);


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

  // Sync handler with cloud
  const handleCloudSync = async (userId: string, showToast = false) => {
    setIsSyncing(true);
    try {
      const mergedCourses = await syncAllCoursesWithCloud(courses, userId);
      if (mergedCourses && mergedCourses.length > 0) {
        setCourses(mergedCourses);
        saveCourses(mergedCourses);
      }
      if (showToast) {
        toast.success('Sincronizado!', 'Seus cursos estão 100% atualizados na nuvem.');
      }
    } catch (err: any) {
      console.error('Falha na sincronização:', err);
      if (showToast) {
        toast.error('Erro na sincronização', 'Verifique sua conexão ou tente novamente.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Listen to Supabase Auth changes
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        handleCloudSync(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        handleCloudSync(session.user.id, true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sync courses to localStorage on update
  useEffect(() => {
    saveCourses(courses);
  }, [courses]);

  // Sync settings to localStorage on update
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

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

    // If logged in, sync to Supabase
    if (user) {
      saveCourseToCloud(updatedCourse, user.id).catch((err) =>
        console.error('Falha ao atualizar curso na nuvem:', err)
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
        .then(() => toast.info('Salvo na Nuvem', 'Curso sincronizado com o Supabase.'))
        .catch((err) => console.error('Falha ao salvar na nuvem:', err));
    }
  };

  const handleLoadDemoCourses = () => {
    setCourses(INITIAL_DEMO_COURSES);
    saveCourses(INITIAL_DEMO_COURSES);
    toast.success('Cursos Carregados', 'Cursos de demonstração restaurados.');
    if (user) {
      INITIAL_DEMO_COURSES.forEach((c) => saveCourseToCloud(c, user.id).catch(console.error));
    }
  };

  const handleResetAllData = () => {
    setCourses(INITIAL_DEMO_COURSES);
    setSettings(DEFAULT_SETTINGS);
    saveCourses(INITIAL_DEMO_COURSES);
    saveSettings(DEFAULT_SETTINGS);
    setCurrentCourseId(null);
    toast.info('Dados Restaurados', 'As configurações e cursos voltaram aos padrões.');
  };

  const handleImportCourses = (imported: Course[]) => {
    setCourses(imported);
    saveCourses(imported);
    toast.success('Backup Restaurado', `${imported.length} cursos foram importados.`);
    if (user) {
      imported.forEach((c) => saveCourseToCloud(c, user.id).catch(console.error));
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <OfflineBanner onReconnected={() => user && handleCloudSync(user.id, false)} />

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
        onManualSync={user ? () => handleCloudSync(user.id, true) : undefined}
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
        onSaveSettings={setSettings}
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
            handleCloudSync(loggedUser.id, true);
          }
        }}
      />

      <StreakModal
        isOpen={isStreakModalOpen}
        onClose={() => setIsStreakModalOpen(false)}
        streak={streak}
        onUpdateStreak={setStreak}
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
