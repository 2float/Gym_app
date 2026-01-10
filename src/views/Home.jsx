import { useState, useEffect } from 'react';
import { generateNextWorkout, generateSpecificWorkout, getAvailableRoutines, getRecommendedRoutine } from '../services/smartWorkoutService';
import { useApp } from '../contexts/AppContext';

export default function Home({ onStartWorkout }) {
  const { isOnline, isSyncingManually, triggerManualSync, history } = useApp();
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [routines, setRoutines] = useState([]);
  const [recommendedRoutine, setRecommendedRoutine] = useState(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(true);

  // Routines laden
  useEffect(() => {
    const loadRoutines = async () => {
      try {
        const data = await getAvailableRoutines();
        setRoutines(data);
      } catch (error) {
        console.error("Fehler beim Laden der Routinen:", error);
        // Fallback auf Standard-Routines
        setRoutines([
          { id: 1, name: 'Push' },
          { id: 2, name: 'Pull' },
          { id: 3, name: 'Legs' },
          { id: 4, name: 'Upper' }
        ]);
      }
    };
    loadRoutines();
  }, []);

  // Empfehlung laden
  useEffect(() => {
    const loadRecommendation = async () => {
      setLoadingRecommendation(true);
      try {
        const recommended = await getRecommendedRoutine();
        setRecommendedRoutine(recommended);
      } catch (error) {
        console.error("Fehler beim Laden der Empfehlung:", error);
      } finally {
        setLoadingRecommendation(false);
      }
    };
    loadRecommendation();
  }, [history]); // Neu berechnen wenn sich history ändert

  // Smart Workout Start
  const handleStartSmartWorkout = async () => {
    setIsLoadingPlan(true);
    setErrorMsg("");
    try {
      if (!isOnline) {
        throw new Error("Für den Smart-Start benötigst du Internet!");
      }
      
      await triggerManualSync();
      const plan = await generateNextWorkout();
      console.log("Plan geladen:", plan);
      
      onStartWorkout(plan);
    } catch (err) {
      console.error(err);
      setErrorMsg("Fehler beim Laden des Plans: " + err.message);
    } finally {
      setIsLoadingPlan(false);
    }
  };

  // Spezifische Routine starten
  const handleStartSpecificRoutine = async (routineName) => {
    setIsLoadingPlan(true);
    setErrorMsg("");
    try {
      if (!isOnline) {
        throw new Error("Für den Start benötigst du Internet!");
      }

      await triggerManualSync();
      const plan = await generateSpecificWorkout(routineName);
      console.log("Spezifische Routine geladen:", plan);
      
      onStartWorkout(plan);
    } catch (err) {
      console.error(err);
      setErrorMsg("Fehler beim Laden der Routine: " + err.message);
    } finally {
      setIsLoadingPlan(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ERROR MESSAGE */}
      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-800 dark:text-red-200 p-4 rounded-r-lg shadow-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="font-medium">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* WELCOME SECTION */}
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="text-center mb-6">
          <div className="inline-block p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full mb-3">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent">
            Bereit für Gains?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Wähle dein Workout für heute.</p>
        </div>

        {/* EMPFOHLENES WORKOUT */}
        {loadingRecommendation ? (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm font-medium">Berechne Empfehlung...</span>
            </div>
          </div>
        ) : recommendedRoutine ? (
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="text-lg">🧠</span>
              <span className="font-semibold">Empfohlen für dich:</span>
            </div>
            <button 
              onClick={handleStartSmartWorkout}
              disabled={isLoadingPlan || isSyncingManually || !isOnline}
              className={`w-full py-5 rounded-xl text-lg font-bold shadow-xl transition-all transform hover:scale-105 active:scale-95 flex justify-center items-center
                ${(isLoadingPlan || isSyncingManually || !isOnline)
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
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🚀</span>
                  <div className="text-left">
                    <div>{recommendedRoutine}</div>
                    <div className="text-xs text-blue-100 font-normal">Jetzt starten</div>
                  </div>
                </div>
              )}
            </button>
          </div>
        ) : null}

        {/* MANUAL ROUTINE SELECTION */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 text-center">Oder wähle manuell:</p>
          <div className="grid grid-cols-2 gap-2">
            {routines.map(routine => (
              <button
                key={routine.id || routine.name}
                onClick={() => handleStartSpecificRoutine(routine.name)}
                disabled={isLoadingPlan || isSyncingManually || !isOnline}
                className="py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {routine.name}
              </button>
            ))}
          </div>
        </div>

        {!isOnline && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
            <p className="text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2 justify-center">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Internet erforderlich für Plan-Generierung
            </p>
          </div>
        )}
      </div>

      {/* LETZTE 5 WORKOUTS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Letzte Workouts
          </h3>
          {history.length > 5 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {history.length} gesamt
            </span>
          )}
        </div>
        {history.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
            <div className="inline-block p-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
              <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Noch keine Trainings aufgezeichnet</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Starte dein erstes Workout!</p>
          </div>
        ) : (
          history.slice(0, 5).map(log => {
            // Durchschnitts-RPE berechnen
            const rpeValues = log.exercises
              ?.map(ex => parseFloat(ex.rpe))
              .filter(rpe => !isNaN(rpe) && rpe > 0) || [];
            const avgRpe = rpeValues.length > 0 
              ? (rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length).toFixed(1)
              : null;

            // Top Lift finden (höchstes Gewicht)
            let topLift = null;
            let maxWeight = 0;
            log.exercises?.forEach(ex => {
              const weights = ex.weight?.split(';').map(Number).filter(n => !isNaN(n)) || [];
              const heaviest = Math.max(...weights);
              if (heaviest > maxWeight) {
                maxWeight = heaviest;
                topLift = { name: ex.name, weight: heaviest };
              }
            });

            // Formatiere Dauer
            const durationMin = log.duration_ms ? Math.round(log.duration_ms / 60000) : null;
            
            // Formatiere Datum + Uhrzeit (UTC forcieren, um Timezone-Shift zu vermeiden)
            const workoutDate = new Date(log.date);
            const dateStr = workoutDate.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' });
            const timeStr = workoutDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

            return (
              <div key={log.id || log.date} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-500 group">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-base text-gray-900 dark:text-gray-100">{log.workoutName || log.workout_name || "Training"}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {dateStr} • {timeStr}
                      </span>
                    </div>
                    
                    {/* Statistiken */}
                    <div className="flex gap-3 flex-wrap">
                      <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span className="font-semibold">{log.exercises?.length || 0}</span> Übungen
                      </div>
                      {durationMin && (
                        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-semibold">{durationMin}</span> min
                        </div>
                      )}
                      {topLift && (
                        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          <span className="font-semibold">{topLift.weight}kg</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* RPE Badge */}
                  {avgRpe && (
                    <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                      avgRpe >= 9 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      avgRpe >= 7 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      RPE {avgRpe}
                    </div>
                  )}
                </div>

                {/* Übungsliste mit Sets - kompakter */}
                {log.exercises && log.exercises.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex flex-wrap gap-1.5">
                      {log.exercises.slice(0, 4).map((ex, i) => (
                        <span key={i} className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md font-medium">
                          {ex.name}
                        </span>
                      ))}
                      {log.exercises.length > 4 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-0.5">
                          +{log.exercises.length - 4} mehr
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
  );
}
