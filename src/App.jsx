import React, { useState, lazy, Suspense, useRef, useEffect } from 'react';
import ActiveWorkout from './components/ActiveWorkout';
import Navigation from './components/Navigation';
import Login from './components/Login';
import { useApp } from './contexts/AppContext';
import { useAuth } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';

// Lazy-loaded Views
const Home = lazy(() => import('./views/Home'));
const Templates = lazy(() => import('./views/Templates'));
const Programs = lazy(() => import('./views/Programs'));
const Exercises = lazy(() => import('./views/Exercises'));
const History = lazy(() => import('./views/History'));

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { isOnline, isWorkoutActive, setIsWorkoutActive, lastSyncTime, isSyncingManually, triggerManualSync } = useApp();
  
  // View Management
  const [currentView, setCurrentView] = useState('home');
  const [smartPlan, setSmartPlan] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Workout Start Handler (von Views aufgerufen)
  const handleStartWorkout = (plan) => {
    setSmartPlan(plan);
    setIsWorkoutActive(true);
  };

  const handleFinishWorkout = () => {
    setIsWorkoutActive(false);
    setSmartPlan(null);
    setCurrentView('home'); // Zurück zur Startseite
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen]);

  // Show login screen if not authenticated
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Lädt...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 font-sans text-gray-900 dark:text-gray-100">
      {/* HEADER */}
      <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-600 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 text-white p-4 shadow-lg sticky top-0 z-10 flex justify-between items-center dark:border-b dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💪</span>
          <h1 className="text-xl font-bold tracking-tight">Gym App</h1>
        </div>
        
        {/* Hamburger Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-all active:scale-95"
            title="Menü"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* User Info Section */}
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Eingeloggt als</div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.email}</div>
              </div>

              {/* Menu Items */}
              <div className="py-2">
                {/* Theme Toggle */}
                <button
                  onClick={() => {
                    toggleTheme();
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200"
                >
                  {isDark ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                  <span className="text-sm">{isDark ? 'Helles Design' : 'Dunkles Design'}</span>
                </button>

                {/* Sync Section */}
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Letzte Synchronisation</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {lastSyncTime 
                          ? new Date(lastSyncTime).toLocaleString('de-DE', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })
                          : 'Nie'
                        }
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        triggerManualSync();
                        setIsMenuOpen(false);
                      }}
                      disabled={isSyncingManually || !isOnline}
                      className={`p-2 rounded-lg transition-all ${
                        isSyncingManually 
                          ? 'bg-blue-100 dark:bg-blue-900/50 cursor-wait' 
                          : isOnline
                            ? 'bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-900 active:scale-95'
                            : 'bg-gray-100 dark:bg-gray-700 opacity-50 cursor-not-allowed'
                      }`}
                      title={!isOnline ? 'Offline - Sync nicht möglich' : 'Jetzt synchronisieren'}
                    >
                      <svg 
                        className={`w-5 h-5 ${isSyncingManually ? 'animate-spin text-blue-600 dark:text-blue-400' : 'text-blue-600 dark:text-blue-400'}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Logout */}
                <button
                  onClick={() => {
                    signOut();
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400 border-t border-gray-200 dark:border-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="text-sm font-medium">Abmelden</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto pb-20">
        {isWorkoutActive ? (
          <ActiveWorkout 
            initialData={smartPlan}
            onFinish={handleFinishWorkout} 
          />
        ) : (
          <Suspense fallback={
            <div className="flex justify-center items-center py-20">
              <svg className="animate-spin h-10 w-10 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          }>
            {currentView === 'home' && <Home onStartWorkout={handleStartWorkout} />}
            {currentView === 'templates' && <Templates />}
            {currentView === 'programs' && <Programs />}
            {currentView === 'exercises' && <Exercises />}
            {currentView === 'history' && <History />}
          </Suspense>
        )}
      </main>

      {/* Navigation nur anzeigen wenn kein aktives Workout */}
      {!isWorkoutActive && (
        <Navigation currentView={currentView} onViewChange={setCurrentView} />
      )}
    </div>
  );
}

export default App;