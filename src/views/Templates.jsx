import { useState, useEffect } from 'react';
import { db } from '../db';
import { getAllTemplates, getRoutineDetails } from '../services/smartWorkoutService';
import { useApp } from '../contexts/AppContext';
import TemplateEditor from '../components/TemplateEditor';

export default function Templates() {
  const { isOnline, history } = useApp();
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoutine, setSelectedRoutine] = useState(null);
  const [routineDetails, setRoutineDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);

  // Routines laden
  useEffect(() => {
    const loadRoutines = async () => {
      try {
        const data = await getAllTemplates();
        setRoutines(data);
      } catch (error) {
        console.error("Fehler beim Laden der Routinen:", error);
      } finally {
        setLoading(false);
      }
    };
    loadRoutines();
  }, []);

  // Details für ein Template laden
  const loadRoutineDetails = async (routine) => {
    setSelectedRoutine(routine);
    setLoadingDetails(true);
    try {
      // Hole Routine mit allen Übungen vom Service
      const data = await getRoutineDetails(routine.id);

      // Zähle wie oft diese Routine gemacht wurde
      const workoutCount = history.filter(
        log => (log.workoutName || log.workout_name) === routine.name
      ).length;

      // Letztes Workout mit dieser Routine finden
      const lastWorkout = history.find(
        log => (log.workoutName || log.workout_name) === routine.name
      );

      setRoutineDetails({
        ...data,
        workoutCount,
        lastWorkout: lastWorkout ? new Date(lastWorkout.date) : null,
        exercises: data.ref_routine_exercises
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(link => link.ref_exercises)
          .filter(ex => ex !== null)
      });
    } catch (error) {
      console.error("Fehler beim Laden der Details:", error);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Berechne Stats für jede Routine
  const getRoutineStats = (routine) => {
    const workoutCount = history.filter(
      log => (log.workoutName || log.workout_name) === routine.name
    ).length;

    const lastWorkout = history.find(
      log => (log.workoutName || log.workout_name) === routine.name
    );

    return { workoutCount, lastWorkout };
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
            <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Templates</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{routines.length} Workout-Vorlagen</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingTemplate(null);
            setShowTemplateEditor(true);
          }}
          className="mt-4 w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neues Template erstellen
        </button>
      </div>

      {/* Routines List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : routines.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-xl shadow-sm text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
          <div className="inline-block p-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
            <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">Keine Templates gefunden</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
            {isOnline ? 'Synchronisiere, um Templates zu laden' : 'Online-Verbindung erforderlich'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {routines.map((routine) => {
            const stats = getRoutineStats(routine);
            const daysSinceLastWorkout = stats.lastWorkout 
              ? Math.floor((new Date() - new Date(stats.lastWorkout.date)) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <div 
                key={routine.id || routine.name}
                onClick={() => loadRoutineDetails(routine)}
                className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-500 transition-all group cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      {routine.name}
                    </h3>
                    
                    {/* Stats */}
                    <div className="flex gap-4 mt-2 flex-wrap">
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-semibold">{stats.workoutCount}</span> mal gemacht
                      </div>
                      
                      {daysSinceLastWorkout !== null && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          vor {daysSinceLastWorkout} Tagen
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedRoutine && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={() => setSelectedRoutine(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 z-10">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedRoutine.name}</h3>
                  {routineDetails && (
                    <div className="flex gap-4 mt-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-semibold">{routineDetails.workoutCount}</span> mal durchgeführt
                      </span>
                      {routineDetails.lastWorkout && (
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Zuletzt: {routineDetails.lastWorkout.toLocaleDateString('de-DE')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setSelectedRoutine(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {loadingDetails ? (
                <div className="flex justify-center py-12">
                  <svg className="animate-spin h-8 w-8 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : routineDetails ? (
                <div className="space-y-4">
                  {/* Übungen */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Übungen ({routineDetails.exercises.length})
                    </h4>
                    
                    {routineDetails.exercises.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <p>Keine Übungen in diesem Template</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {routineDetails.exercises.map((exercise, index) => (
                          <div 
                            key={exercise.id}
                            className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center">
                                <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{index + 1}</span>
                              </div>
                              <div className="flex-1">
                                <h5 className="font-semibold text-gray-900 dark:text-gray-100">{exercise.name}</h5>
                                <div className="flex gap-2 mt-1 flex-wrap">
                                  {exercise.category && (
                                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md">
                                      {exercise.category}
                                    </span>
                                  )}
                                  {exercise.muscle_group && (
                                    <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md">
                                      {exercise.muscle_group}
                                    </span>
                                  )}
                                  {exercise.min_reps && exercise.max_reps && (
                                    <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-md">
                                      {exercise.min_reps}-{exercise.max_reps} Reps
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>Fehler beim Laden der Details</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedRoutine(null)}
                  className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-semibold transition-colors"
                >
                  Schließen
                </button>
                <button
                  onClick={() => {
                    setEditingTemplate(selectedRoutine);
                    setShowTemplateEditor(true);
                  }}
                  disabled={!isOnline}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                    isOnline
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  }`}
                >
                  Bearbeiten {!isOnline && '(Offline)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {showTemplateEditor && (
        <TemplateEditor
          template={editingTemplate}
          onSave={async () => {
            setShowTemplateEditor(false);
            setEditingTemplate(null);
            setSelectedRoutine(null);
            // Routines neu laden
            setLoading(true);
            const data = await getAllTemplates();
            setRoutines(data);
            setLoading(false);
          }}
          onCancel={() => {
            setShowTemplateEditor(false);
            setEditingTemplate(null);
          }}
        />
      )}
    </div>
  );
}
