import { useState } from 'react';
import { useApp } from '../contexts/AppContext';

export default function History() {
  const { history } = useApp();
  const [selectedWorkout, setSelectedWorkout] = useState(null);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
              <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Workout History</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Alle deine Trainings</p>
            </div>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-full font-semibold">
            {history.length} gesamt
          </span>
        </div>
      </div>

      {/* History List */}
      {history.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-xl shadow-sm text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
          <div className="inline-block p-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
            <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">Noch keine Trainings aufgezeichnet</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">Starte dein erstes Workout!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map(log => {
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
              <div 
                key={log.id || log.date} 
                onClick={() => setSelectedWorkout(log)}
                className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-100 dark:border-gray-700 hover:border-orange-200 dark:hover:border-orange-500 group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{log.workoutName || log.workout_name || "Training"}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {dateStr} • {timeStr}
                      </span>
                    </div>
                    
                    {/* Statistiken */}
                    <div className="flex gap-3 mt-2 flex-wrap">
                      <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span className="font-semibold">{log.exercises?.length || 0}</span> Übungen
                      </div>
                      {durationMin && (
                        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-semibold">{durationMin}</span> min
                        </div>
                      )}
                      {topLift && (
                        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          <span className="font-semibold">{topLift.weight}kg</span> {topLift.name}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* RPE Badge */}
                  {avgRpe && (
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                      avgRpe >= 9 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      avgRpe >= 7 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      RPE {avgRpe}
                    </div>
                  )}
                </div>

                {/* Übungsliste mit Sets */}
                {log.exercises && log.exercises.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex flex-wrap gap-2">
                      {log.exercises.map((ex, i) => (
                        <span key={i} className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-md font-medium">
                          {ex.name} ({ex.sets}×)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedWorkout && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={() => setSelectedWorkout(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const workoutDate = new Date(selectedWorkout.date);
              const dateStr = workoutDate.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
              const timeStr = workoutDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
              const durationMin = selectedWorkout.duration_ms ? Math.round(selectedWorkout.duration_ms / 60000) : null;
              
              const rpeValues = selectedWorkout.exercises
                ?.map(ex => parseFloat(ex.rpe))
                .filter(rpe => !isNaN(rpe) && rpe > 0) || [];
              const avgRpe = rpeValues.length > 0 
                ? (rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length).toFixed(1)
                : null;

              return (
                <>
                  {/* Header */}
                  <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 z-10">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {selectedWorkout.workoutName || selectedWorkout.workout_name || "Training"}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {dateStr} um {timeStr}
                        </p>
                        <div className="flex gap-4 mt-3">
                          {durationMin && (
                            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="font-semibold">{durationMin}</span> Minuten
                            </div>
                          )}
                          {avgRpe && (
                            <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                              avgRpe >= 9 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                              avgRpe >= 7 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                              'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            }`}>
                              Ø RPE {avgRpe}
                            </div>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedWorkout(null)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Exercises */}
                  <div className="p-6 space-y-4">
                    {selectedWorkout.exercises && selectedWorkout.exercises.length > 0 ? (
                      selectedWorkout.exercises.map((exercise, index) => {
                        const weights = exercise.weight?.split(';') || [];
                        const reps = exercise.reps?.split(';') || [];
                        const numSets = parseInt(exercise.sets) || 0;

                        return (
                          <div key={index} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                            {/* Exercise Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center">
                                  <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{index + 1}</span>
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-bold text-gray-900 dark:text-gray-100">{exercise.name}</h4>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{numSets} Sätze</p>
                                </div>
                              </div>
                              {exercise.rpe && (
                                <div className={`px-2 py-1 rounded-md text-xs font-bold ${
                                  exercise.rpe >= 9 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                  exercise.rpe >= 7 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                                  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                }`}>
                                  RPE {exercise.rpe}
                                </div>
                              )}
                            </div>

                            {/* Sets Details */}
                            <div className="space-y-2 ml-11">
                              {Array.from({ length: numSets }).map((_, setIndex) => (
                                <div key={setIndex} className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-500 dark:text-gray-400 w-16">Satz {setIndex + 1}:</span>
                                  <div className="flex gap-3 font-semibold text-gray-900 dark:text-gray-100">
                                    {weights[setIndex] && (
                                      <span className="flex items-center gap-1">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                                        </svg>
                                        {weights[setIndex]} kg
                                      </span>
                                    )}
                                    {reps[setIndex] && (
                                      <span className="flex items-center gap-1">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        {reps[setIndex]} Wdh
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Notes */}
                            {exercise.notes && (
                              <div className="mt-3 ml-11 p-2 bg-gray-100 dark:bg-gray-600/50 rounded text-xs text-gray-700 dark:text-gray-300">
                                <span className="font-semibold">Notiz:</span> {exercise.notes}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <p>Keine Übungen aufgezeichnet</p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="sticky bottom-0 bg-white dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setSelectedWorkout(null)}
                      className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      Schließen
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
