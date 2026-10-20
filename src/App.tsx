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
  syncCoursesFromCloud,
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
import { DownloadCloud, Smartphone } from 'lucide-react';

export const App: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>(() => loadCourses());
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

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

  // Listen to Supabase Auth changes
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Sync courses from cloud on initial session
        syncCoursesFromCloud(session.user.id)
          .then((cloudCourses) => {
            if (cloudCourses && cloudCourses.length > 0) {
              setCourses(cloudCourses);
            }
          })
          .catch((err) => console.warn('Falha na sincronização inicial:', err));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        syncCoursesFromCloud(session.user.id)
          .then((cloudCourses) => {
            if (cloudCourses && cloudCourses.length > 0) {
              setCourses(cloudCourses);
            }
          })
          .catch((err) => console.warn('Erro ao carregar cursos:', err));
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

    if (user) {
      saveCourseToCloud(newCourse, user.id).catch((err) =>
        console.error('Falha ao salvar novo curso na nuvem:', err)
      );
    }
  };

  const handleLoadDemoCourses = () => {
    setCourses(INITIAL_DEMO_COURSES);
    saveCourses(INITIAL_DEMO_COURSES);
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
  };

  const handleImportCourses = (imported: Course[]) => {
    setCourses(imported);
    saveCourses(imported);
    if (user) {
      imported.forEach((c) => saveCourseToCloud(c, user.id).catch(console.error));
    }
  };

  const handleInstallPWA = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        setDeferredPrompt(null);
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        courses={courses}
        currentCourse={currentCourse}
        user={user}
        onBackToDashboard={handleBackToDashboard}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* PWA Install Notice on mobile / desktop */}
      {deferredPrompt && (
        <div className="bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2 flex items-center justify-between text-xs text-white">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 shrink-0" />
            <span>Instale o TubeCourse como aplicativo no seu celular ou computador!</span>
          </div>
          <button
            onClick={handleInstallPWA}
            className="px-3 py-1 bg-white text-red-600 font-bold rounded-lg shadow hover:bg-slate-100 transition"
          >
            Instalar App
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
        onAuthSuccess={(loggedUser) => setUser(loggedUser)}
      />
    </div>
  );
};
