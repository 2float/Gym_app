import { useState } from 'react';
import { useApp } from '../contexts/AppContext';

export default function History() {
  const { history } = useApp();
  const [selectedWorkout, setSelectedWorkout] = useState(null);

  // Calculate stats for visualizations
  const getLast30DaysActivity = () => {
    const today = new Date();
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const dateStr = date.toISOString().split('T')[0];
      const workoutsOnDay = history.filter(log => {
        const logDate = new Date(log.date);
        logDate.setHours(0, 0, 0, 0);
        return logDate.toISOString().split('T')[0] === dateStr;
      }).length;
      
      days.push({ date, workouts: workoutsOnDay });
    }
    return days;
  };

  const getRoutineDistribution = () => {
    const distribution = {};
    history.forEach(log => {
      const name = log.workoutName || log.workout_name || 'Unbekannt';
      distribution[name] = (distribution[name] || 0) + 1;
    });
    return Object.entries(distribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  };

  const activityData = getLast30DaysActivity();
  const routineDistribution = getRoutineDistribution();
  const maxWorkouts = Math.max(...activityData.map(d => d.workouts), 1);
  const currentStreak = (() => {
    let streak = 0;
    const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const hasWorkout = sortedHistory.some(log => {
        const logDate = new Date(log.date);
        logDate.setHours(0, 0, 0, 0);
        return logDate.getTime() === checkDate.getTime();
      });
      
      if (hasWorkout) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  })();

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
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

        {/* Activity Stats */}
        {history.length > 0 && (
          <div className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{currentStreak}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Tage Streak</div>
              </div>
              <div className="bg-white dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{history.length}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Workouts</div>
              </div>
              <div className="bg-white dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {activityData.filter(d => d.workouts > 0).length}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Aktive Tage (30d)</div>
              </div>
            </div>

            {/* Activity Heatmap */}
            <div className="bg-white dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">Letzte 30 Tage</div>
              <div className="grid grid-cols-10 gap-1">
                {activityData.map((day, idx) => {
                  const intensity = day.workouts === 0 ? 0 : Math.min((day.workouts / maxWorkouts) * 4, 4);
                  const colors = [
                    'bg-gray-100 dark:bg-gray-700',
                    'bg-orange-200 dark:bg-orange-900/40',
                    'bg-orange-300 dark:bg-orange-800/60',
                    'bg-orange-400 dark:bg-orange-700/80',
                    'bg-orange-500 dark:bg-orange-600'
                  ];
                  
                  return (
                    <div
                      key={idx}
                      className={`aspect-square rounded-sm ${colors[Math.floor(intensity)]} relative group cursor-pointer transition-transform hover:scale-125`}
                      title={`${day.date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}: ${day.workouts} Workout${day.workouts !== 1 ? 's' : ''}`}
                    >
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                        {day.date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}: {day.workouts}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-3 text-xs text-gray-500 dark:text-gray-400">
                <span>Weniger</span>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map(level => (
                    <div
                      key={level}
                      className={`w-3 h-3 rounded-sm ${
                        level === 0 ? 'bg-gray-100 dark:bg-gray-700' :
                        level === 1 ? 'bg-orange-200 dark:bg-orange-900/40' :
                        level === 2 ? 'bg-orange-300 dark:bg-orange-800/60' :
                        level === 3 ? 'bg-orange-400 dark:bg-orange-700/80' :
                        'bg-orange-500 dark:bg-orange-600'
                      }`}
                    />
                  ))}
                </div>
                <span>Mehr</span>
              </div>
            </div>

            {/* Routine Distribution */}
            {routineDistribution.length > 0 && (
              <div className="bg-white dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">Top Routinen</div>
                <div className="space-y-2">
                  {routineDistribution.map(([name, count]) => {
                    const percentage = (count / history.length) * 100;
                    return (
                      <div key={name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{name}</span>
                          <span className="text-gray-500 dark:text-gray-400">{count}× ({percentage.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
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
                      {!log.synced && (
                        <span className="text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded-full font-medium">
                          offline
                        </span>
                      )}
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
