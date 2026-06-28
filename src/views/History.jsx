import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';

const ROUTINE_PALETTE = [
  ['bg-blue-400 dark:bg-blue-500',   'bg-blue-400/20 dark:bg-blue-500/20',   'text-blue-700 dark:text-blue-300'],
  ['bg-green-400 dark:bg-green-500', 'bg-green-400/20 dark:bg-green-500/20', 'text-green-700 dark:text-green-300'],
  ['bg-orange-400 dark:bg-orange-500','bg-orange-400/20 dark:bg-orange-500/20','text-orange-700 dark:text-orange-300'],
  ['bg-purple-400 dark:bg-purple-500','bg-purple-400/20 dark:bg-purple-500/20','text-purple-700 dark:text-purple-300'],
  ['bg-pink-400 dark:bg-pink-500',   'bg-pink-400/20 dark:bg-pink-500/20',   'text-pink-700 dark:text-pink-300'],
  ['bg-teal-400 dark:bg-teal-500',   'bg-teal-400/20 dark:bg-teal-500/20',   'text-teal-700 dark:text-teal-300'],
];

const toUTCDateStr = (d) => {
  const date = new Date(d);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};

const daysSince = (dateStr) => {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'heute';
  if (diff === 1) return 'gestern';
  return `vor ${diff}d`;
};

export default function History() {
  const { history } = useApp();
  const [selectedWorkout, setSelectedWorkout] = useState(null);

  // ── 30-DAY CALENDAR ───────────────────────────────────────────────────────
  const calendarData = useMemo(() => {
    const trainedDates = new Set(history.map(log => toUTCDateStr(log.date)));
    const todayStr = toUTCDateStr(new Date());
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const str = toUTCDateStr(d);
      return { day: d.getDate(), str, trained: trainedDates.has(str), isToday: str === todayStr };
    });
  }, [history]);

  const activeDays = calendarData.filter(d => d.trained).length;

  // ── STREAK ────────────────────────────────────────────────────────────────
  const currentStreak = useMemo(() => {
    const trainedDates = new Set(history.map(log => toUTCDateStr(log.date)));
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (trainedDates.has(toUTCDateStr(d))) streak++;
      else if (i > 0) break;
    }
    return streak;
  }, [history]);

  // ── LETZTE RUNDE ──────────────────────────────────────────────────────────
  const lastRound = useMemo(() => {
    const seen = new Map();
    for (const log of history) {
      const name = log.workoutName || log.workout_name;
      if (name && !seen.has(name)) seen.set(name, log.date);
    }
    return [...seen.entries()]
      .sort((a, b) => new Date(b[1]) - new Date(a[1]))
      .slice(0, 5);
  }, [history]);

  // ── WEEKLY FREQUENCY ─────────────────────────────────────────────────────
  const weeklyFrequencyData = useMemo(() => {
    const getWeekStart = (d) => {
      const date = new Date(d);
      const day = date.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day;
      date.setUTCDate(date.getUTCDate() + diff);
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
    };
    const weekMap = new Map();
    for (const log of history) {
      const ws = getWeekStart(new Date(log.date));
      const ds = toUTCDateStr(log.date);
      if (!weekMap.has(ws)) weekMap.set(ws, new Set());
      weekMap.get(ws).add(ds);
    }
    const now = new Date();
    return Array.from({ length: 24 }, (_, i) => {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - (23 - i) * 7);
      const ws = getWeekStart(d);
      return { weekStart: ws, count: weekMap.get(ws)?.size ?? 0 };
    });
  }, [history]);

  const avgDaysPerWeek = useMemo(() => {
    const total = weeklyFrequencyData.reduce((s, w) => s + w.count, 0);
    return (total / weeklyFrequencyData.length).toFixed(1);
  }, [weeklyFrequencyData]);

  // ── SESSION VOLUME ────────────────────────────────────────────────────────
  const sessionVolumeData = useMemo(() => {
    return [...history].reverse().slice(-25).map(log => {
      const name = log.workoutName || log.workout_name || 'Training';
      let volume = 0;
      log.exercises?.forEach(ex => {
        const weights = (ex.weight || '').split(';').map(Number).filter(n => n > 0);
        const reps    = (ex.reps    || '').split(';').map(Number).filter(n => n > 0);
        const len = Math.min(weights.length, reps.length);
        for (let i = 0; i < len; i++) volume += weights[i] * reps[i];
      });
      return { date: log.date, name, volume };
    });
  }, [history]);

  const { routineColorMap, uniqueRoutines } = useMemo(() => {
    const seen = [];
    sessionVolumeData.forEach(s => { if (!seen.includes(s.name)) seen.push(s.name); });
    const colorMap = Object.fromEntries(seen.map((name, i) => [name, ROUTINE_PALETTE[i % ROUTINE_PALETTE.length]]));
    return { routineColorMap: colorMap, uniqueRoutines: seen };
  }, [sessionVolumeData]);

  const maxSessionVolume = useMemo(
    () => Math.max(...sessionVolumeData.map(s => s.volume), 1),
    [sessionVolumeData]
  );

  return (
    <div className="space-y-4 pb-20">

      {/* HEADER + QUICK STATS */}
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-5 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
              <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Workout History</h2>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-full font-semibold">
            {history.length} gesamt
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{currentStreak}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Streak</div>
          </div>
          <div className="bg-white dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{history.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Workouts</div>
          </div>
          <div className="bg-white dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{activeDays}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Aktive Tage (30d)</div>
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <>
          {/* 30-DAY CALENDAR */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Letzte 30 Tage</div>
            <div className="grid grid-cols-10 gap-1.5">
              {calendarData.map((day, i) => (
                <div
                  key={i}
                  title={day.str}
                  className={`aspect-square rounded flex items-center justify-center text-xs font-semibold
                    ${day.trained
                      ? 'bg-green-400 dark:bg-green-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}
                    ${day.isToday ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-800' : ''}
                  `}
                >
                  {day.day}
                </div>
              ))}
            </div>
          </div>

          {/* WEEKLY FREQUENCY CHART */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Frequenz (6 Monate)</div>
              <div className="text-sm font-bold text-purple-600 dark:text-purple-400">Ø {avgDaysPerWeek} ×/Woche</div>
            </div>
            {(() => {
              const W = 240, H = 52, padT = 4, padB = 4;
              const chartH = H - padT - padB;
              const n = weeklyFrequencyData.length;
              const pts = weeklyFrequencyData.map((w, i) => ({
                x: n > 1 ? (i / (n - 1)) * W : W / 2,
                y: padT + chartH - (w.count / 7) * chartH,
              }));
              const linePoints = pts.map(p => `${p.x},${p.y}`).join(' ');
              const areaPoints = `0,${H - padB} ${linePoints} ${W},${H - padB}`;
              return (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
                  {[0, 3, 6].map(v => {
                    const y = padT + chartH - (v / 7) * chartH;
                    return <line key={v} x1="0" y1={y} x2={W} y2={y} stroke="currentColor" strokeWidth="0.4" className="text-gray-200 dark:text-gray-700" />;
                  })}
                  <polygon points={areaPoints} fill="rgba(168,85,247,0.12)" />
                  <polyline points={linePoints} fill="none" stroke="rgb(168,85,247)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                  {pts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y}
                      r={i === n - 1 ? 2.5 : 1.5}
                      fill={i === n - 1 ? 'rgb(168,85,247)' : 'rgba(168,85,247,0.7)'}
                    />
                  ))}
                </svg>
              );
            })()}
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(weeklyFrequencyData[0]?.weekStart + 'T12:00:00Z').toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">heute</span>
            </div>
          </div>

          {/* LETZTE RUNDE */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Letzte Runde</div>
            <div className="space-y-2">
              {lastRound.map(([name, date]) => {
                const diff = Math.floor((Date.now() - new Date(date)) / 86400000);
                const badge =
                  diff === 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                  diff <= 3  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' :
                  diff <= 6  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' :
                               'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
                return (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate mr-3">{name}</span>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${badge}`}>
                      {daysSince(date)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SESSION VOLUME CHART */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wide">Trainingsvolumen</div>

            {/* Bars */}
            <div className="flex items-end gap-0.5 h-16 mb-1">
              {sessionVolumeData.map((s, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-t min-w-0 transition-all ${routineColorMap[s.name]?.[0] ?? 'bg-gray-300 dark:bg-gray-600'}`}
                  style={{ height: `${Math.max(3, (s.volume / maxSessionVolume) * 60)}px` }}
                  title={`${new Date(s.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', timeZone: 'UTC' })}: ${s.name} · ${Math.round(s.volume)} kg`}
                />
              ))}
            </div>

            {/* Date axis */}
            {sessionVolumeData.length > 1 && (
              <div className="flex justify-between mb-3">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {new Date(sessionVolumeData[0].date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', timeZone: 'UTC' })}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {new Date(sessionVolumeData[sessionVolumeData.length - 1].date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', timeZone: 'UTC' })}
                </span>
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1 border-t border-gray-100 dark:border-gray-700">
              {uniqueRoutines.map(name => (
                <div key={name} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${routineColorMap[name]?.[0] ?? 'bg-gray-300'}`} />
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[120px]">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* WORKOUT LOG */}
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
            const rpeValues = log.exercises
              ?.map(ex => parseFloat(ex.rpe))
              .filter(rpe => !isNaN(rpe) && rpe > 0) || [];
            const avgRpe = rpeValues.length > 0
              ? (rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length).toFixed(1)
              : null;

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

            const durationMin = log.duration_ms ? Math.round(log.duration_ms / 60000) : null;
            const workoutDate = new Date(log.date);
            const dateStr = workoutDate.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' });
            const timeStr = workoutDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

            return (
              <div
                key={log.id || log.date}
                onClick={() => setSelectedWorkout(log)}
                className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-100 dark:border-gray-700 hover:border-orange-200 dark:hover:border-orange-500 cursor-pointer"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{log.workoutName || log.workout_name || "Training"}</span>
                      {!log.synced && (
                        <span className="text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded-full font-medium">
                          offline
                        </span>
                      )}
                      <span className="text-xs text-gray-400 dark:text-gray-500">{dateStr} • {timeStr}</span>
                    </div>
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

      {/* DETAIL MODAL */}
      {selectedWorkout && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={() => setSelectedWorkout(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
            {(() => {
              const workoutDate = new Date(selectedWorkout.date);
              const dateStr = workoutDate.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
              const timeStr = workoutDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
              const durationMin = selectedWorkout.duration_ms ? Math.round(selectedWorkout.duration_ms / 60000) : null;
              const rpeValues = selectedWorkout.exercises?.map(ex => parseFloat(ex.rpe)).filter(r => !isNaN(r) && r > 0) || [];
              const avgRpe = rpeValues.length > 0 ? (rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length).toFixed(1) : null;

              return (
                <>
                  <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 z-10">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {selectedWorkout.workoutName || selectedWorkout.workout_name || "Training"}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{dateStr} um {timeStr}</p>
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
                      <button onClick={() => setSelectedWorkout(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    {selectedWorkout.exercises && selectedWorkout.exercises.length > 0 ? (
                      selectedWorkout.exercises.map((exercise, index) => {
                        const weights = exercise.weight?.split(';') || [];
                        const reps = exercise.reps?.split(';') || [];
                        const numSets = parseInt(exercise.sets) || 0;
                        return (
                          <div key={index} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center">
                                  <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{index + 1}</span>
                                </div>
                                <div>
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
