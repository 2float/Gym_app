import React, { useState } from 'react';
import ActiveWorkout from './components/ActiveWorkout';
import RoutineSelector from './components/RoutineSelector';
import { generateNextWorkout, generateSpecificWorkout } from './services/smartWorkoutService';
import { useApp } from './contexts/AppContext';


function App() {
  const { history, isOnline, isWorkoutActive, setIsWorkoutActive, lastSyncTime, isSyncingManually, triggerManualSync } = useApp();
  
  // NEU: Smart Features State
  const [smartPlan, setSmartPlan] = useState(null); // Speichert den generierten Plan
  const [isLoadingPlan, setIsLoadingPlan] = useState(false); // Lade-Spinner
  const [errorMsg, setErrorMsg] = useState("");
  const [showRoutineSelector, setShowRoutineSelector] = useState(false); // Routine-Auswahl Modal

  // Handler: Workout-Start-Button (mit Sync)
  const handleStartWorkout = async () => {
    if (!isOnline) {
      // Offline: Zeige trotzdem Selector (mit lokalen Daten)
      setShowRoutineSelector(true);
      return;
    }

    // Online: Sync zuerst, dann Selector öffnen
    setIsLoadingPlan(true);
    setErrorMsg("");
    try {
      console.log("🔄 Sync vor Workout-Start...");
      await triggerManualSync();
      setShowRoutineSelector(true);
    } catch (err) {
      console.error(err);
      setErrorMsg("Fehler beim Synchronisieren: " + err.message);
    } finally {
      setIsLoadingPlan(false);
    }
  };

  // NEU: Smart Workout Start
  const handleStartSmartWorkout = async () => {
    setIsLoadingPlan(true);
    setErrorMsg("");
    setShowRoutineSelector(false);
    try {
      // 1. Plan generieren lassen (Online-Check passiert im Service bzw. wird vorausgesetzt)
      if (!isOnline) {
        throw new Error("Für den Smart-Start benötigst du Internet!");
      }

      const plan = await generateNextWorkout();
      console.log("Plan geladen:", plan);
      
      setSmartPlan(plan);
      setIsWorkoutActive(true);
    } catch (err) {
      console.error(err);
      setErrorMsg("Fehler beim Laden des Plans: " + err.message);
      // Fallback: Leeres Training starten? Oder User zwingen zu retry?
      // Wir lassen ihn erstmal im Menu.
    } finally {
      setIsLoadingPlan(false);
    }
  };

  // NEU: Spezifische Routine starten
  const handleStartSpecificRoutine = async (routineName) => {
    setIsLoadingPlan(true);
    setErrorMsg("");
    setShowRoutineSelector(false);
    try {
      if (!isOnline) {
        throw new Error("Für den Start benötigst du Internet!");
      }

      const plan = await generateSpecificWorkout(routineName);
      console.log("Spezifische Routine geladen:", plan);
      
      setSmartPlan(plan);
      setIsWorkoutActive(true);
    } catch (err) {
      console.error(err);
      setErrorMsg("Fehler beim Laden der Routine: " + err.message);
    } finally {
      setIsLoadingPlan(false);
    }
  };

  const handleFinishWorkout = () => {
    setIsWorkoutActive(false);
    setSmartPlan(null); // Reset Plan
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans text-gray-900">
      {/* HEADER */}
      <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-600 text-white p-4 shadow-lg sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💪</span>
          <h1 className="text-xl font-bold tracking-tight">Gym App</h1>
        </div>
        {/* Sync Info & Button */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs opacity-75">Last Sync</div>
            <div className="text-xs font-medium">
              {lastSyncTime 
                ? new Date(lastSyncTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                : 'Nie'
              }
            </div>
          </div>
          <button
            onClick={triggerManualSync}
            disabled={isSyncingManually || !isOnline}
            className={`p-2 rounded-lg transition-all ${
              isSyncingManually 
                ? 'bg-white/20 cursor-wait' 
                : isOnline
                  ? 'bg-white/20 hover:bg-white/30 active:scale-95'
                  : 'bg-white/10 opacity-50 cursor-not-allowed'
            }`}
            title={!isOnline ? 'Offline - Sync nicht möglich' : 'Jetzt synchronisieren'}
          >
            <svg 
              className={`w-5 h-5 ${isSyncingManually ? 'animate-spin' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </header>

      {/* ERROR MESSAGE */}
      {errorMsg && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-4 m-4 rounded-r-lg shadow-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="font-medium">{errorMsg}</p>
          </div>
        </div>
      )}

      <main className="p-4 max-w-md mx-auto">
        {isWorkoutActive ? (
          <ActiveWorkout 
            initialData={smartPlan} // Wir geben den Plan weiter!
            onFinish={handleFinishWorkout} 
          />
        ) : (
          <div className="space-y-6">
            {/* WELCOME / DASHBOARD */}
            <div className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-2xl shadow-lg border border-gray-100 text-center">
              <div className="mb-4">
                <div className="inline-block p-3 bg-blue-100 rounded-full mb-3">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">Bereit für Gains?</h2>
              <p className="text-gray-600 mb-8">Wähle dein Workout für heute.</p>
              
              <button 
                onClick={handleStartWorkout}
                disabled={isLoadingPlan || isSyncingManually}
                className={`w-full py-5 rounded-xl text-lg font-bold shadow-xl transition-all transform hover:scale-105 active:scale-95 flex justify-center items-center
                  ${(isLoadingPlan || isSyncingManually)
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 via-blue-700 to-blue-600 text-white hover:shadow-2xl hover:from-blue-700 hover:via-blue-800 hover:to-blue-700'
                  }`}
              >
                {(isLoadingPlan || isSyncingManually) ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isSyncingManually ? 'Synchronisiere...' : 'Berechne Plan...'}
                  </>
                ) : (
                  "🚀 Workout Starten"
                )}
              </button>
              
              {!isOnline && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800 flex items-center gap-2 justify-center">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Internet erforderlich für Plan-Generierung
                  </p>
                </div>
              )}
            </div>

            {/* HISTORY LIST */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Letzte Workouts
                </h3>
                {history.length > 0 && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {history.length} gesamt
                  </span>
                )}
              </div>
              {history.length === 0 ? (
                <div className="bg-white p-8 rounded-xl shadow-sm text-center border-2 border-dashed border-gray-200">
                  <div className="inline-block p-3 bg-gray-100 rounded-full mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm font-medium">Noch keine Trainings aufgezeichnet</p>
                  <p className="text-gray-400 text-xs mt-1">Starte dein erstes Workout!</p>
                </div>
              ) : (
                history.slice(0, 5).map(log => {
                  // Berechne Gesamt-Volumen (kg * reps)
                  const totalVolume = log.exercises?.reduce((sum, ex) => {
                    const weights = ex.weight?.split(';').map(Number).filter(n => !isNaN(n)) || [];
                    const reps = ex.reps?.split(';').map(Number).filter(n => !isNaN(n)) || [];
                    const exVolume = weights.reduce((s, w, i) => s + (w * (reps[i] || 0)), 0);
                    return sum + exVolume;
                  }, 0) || 0;

                  // Formatiere Dauer
                  const durationMin = log.duration_ms ? Math.round(log.duration_ms / 60000) : null;

                  return (
                    <div key={log.id || log.date} className="bg-white p-5 rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-100 hover:border-blue-200 group">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-lg text-gray-900">{log.workoutName || log.workout_name || "Training"}</span>
                            <span className="text-xs text-gray-400">
                              {new Date(log.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                          
                          {/* Statistiken */}
                          <div className="flex gap-4 mt-2">
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              <span className="font-semibold">{log.exercises?.length || 0}</span> Übungen
                            </div>
                            {durationMin && (
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-semibold">{durationMin}</span> min
                              </div>
                            )}
                            {totalVolume > 0 && (
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                <span className="font-semibold">{totalVolume.toLocaleString()}</span> kg
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Status Badge */}
                        <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Erledigt
                        </div>
                      </div>

                      {/* Übungsliste */}
                      {log.exercises && log.exercises.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex flex-wrap gap-2">
                            {log.exercises.slice(0, 3).map((ex, i) => (
                              <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-medium">
                                {ex.name}
                              </span>
                            ))}
                            {log.exercises.length > 3 && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-medium">
                                +{log.exercises.length - 3} mehr
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ROUTINE SELECTOR MODAL */}
        {showRoutineSelector && (
          <RoutineSelector 
            onSelectSmart={handleStartSmartWorkout}
            onSelectSpecific={handleStartSpecificRoutine}
            onCancel={() => setShowRoutineSelector(false)}
            isLoading={isLoadingPlan}
          />
        )}
      </main>
    </div>
  );
}

export default App;