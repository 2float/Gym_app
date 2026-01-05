import { useState, useEffect } from 'react'
import { db } from '../db'
import { supabase } from '../supabaseClient'
import { useLiveQuery } from 'dexie-react-hooks'

export function ActiveWorkout({ isOnline }) { 
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  
  // Eingabe-States
  const [weight, setWeight] = useState(60)
  const [reps, setReps] = useState(8)
  const [rpe, setRpe] = useState(8)
  
  // Prozess-States
  const [isSyncing, setIsSyncing] = useState(false)
  const [finishedSummary, setFinishedSummary] = useState(null)

  // --- DB ABFRAGEN ---
  const exercises = useLiveQuery(() => db.exercises.toArray())
  
  const logs = useLiveQuery(
    () => activeSessionId ? db.exercise_logs.where('session_id').equals(activeSessionId).toArray() : [],
    [activeSessionId]
  )

  const getExerciseName = (id) => exercises?.find(e => e.id === id)?.name || 'Unbekannt'

  // --- HISTORY LOGIC (Wiederhergestellt) ---
  // Zeigt die letzten 2 Sessions dieser Übung an
  const history = useLiveQuery(async () => {
    if (!selectedExerciseId) return []
    
    // 1. Alle Logs dieser Übung holen
    const allLogs = await db.exercise_logs
      .where('exercise_id').equals(selectedExerciseId)
      .toArray()
    
    // 2. Filtern: Nur Logs, die NICHT zur aktuellen Session gehören
    const oldLogs = allLogs.filter(l => l.session_id !== activeSessionId)
    
    // 3. Gruppieren nach Session
    const sessionsMap = new Map()
    for (const log of oldLogs) {
      if (!sessionsMap.has(log.session_id)) {
        // Wir brauchen das Datum der Session
        const session = await db.workout_sessions.get(log.session_id)
        // Nur hinzufügen, wenn Session existiert
        if (session) {
            sessionsMap.set(log.session_id, {
            date: session.date,
            sets: [] // Array für Sets initialisieren
            })
        }
      }
      // Set zur Session hinzufügen (falls Session gefunden wurde)
      if (sessionsMap.has(log.session_id)) {
        sessionsMap.get(log.session_id).sets.push(log)
      }
    }
    
    // 4. Sortieren: Neueste Sessions zuerst und auf 2 begrenzen
    const sortedSessions = Array.from(sessionsMap.values())
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 2)
      
    // Sets innerhalb der Session sortieren (nach set_index oder created_at)
    sortedSessions.forEach(s => {
        s.sets.sort((a,b) => a.set_index - b.set_index)
    })

    return sortedSessions
  }, [selectedExerciseId, activeSessionId])


  // --- AUTO-RETRY IN SUMMARY VIEW ---
  // Wenn wir im Summary Screen sind, offline waren, und jetzt online kommen -> Sync nachholen
  useEffect(() => {
    if (finishedSummary && !finishedSummary.synced && isOnline && finishedSummary.sessionId) {
      console.log("📡 Online erkannt! Versuche Summary-Sync...");
      retrySync(finishedSummary.sessionId);
    }
  }, [isOnline, finishedSummary])

  async function retrySync(sessionId) {
    try {
      const session = await db.workout_sessions.get(sessionId)
      if (!session) return

      // Prüfen ob schon da (Idempotenz)
      const { data: existing } = await supabase.from('workout_sessions').select('id').eq('id', sessionId).maybeSingle()
      
      if (!existing) {
        const { error: sessError } = await supabase.from('workout_sessions').insert({
          id: session.id,
          date: session.date,
          status: 'completed'
        })
        if (sessError) throw sessError

        const logs = await db.exercise_logs.where('session_id').equals(sessionId).toArray()
        const cleanLogs = logs.map(log => ({
          id: log.id,
          session_id: log.session_id,
          exercise_id: log.exercise_id,
          weight: log.weight,
          reps: log.reps,
          rpe: log.rpe,
          set_index: log.set_index
        }))

        if (cleanLogs.length > 0) {
          const { error: logError } = await supabase.from('exercise_logs').insert(cleanLogs)
          if (logError) throw logError
        }
      }

      // UI Update auf Success
      setFinishedSummary(prev => ({ ...prev, synced: true }))

    } catch (err) {
      console.error("Retry Sync failed:", err)
    }
  }

  // --- ACTIONS ---
  async function startWorkout() {
    setFinishedSummary(null)
    const id = crypto.randomUUID()
    await db.workout_sessions.add({
      id,
      date: new Date(),
      status: 'active'
    })
    setActiveSessionId(id)
  }

  async function logSet() {
    if (reps <= 0 || weight <= 0) {
        alert("Bitte valide Werte eingeben.")
        return
    }
    if (!selectedExerciseId || !activeSessionId) return

    await db.exercise_logs.add({
      id: crypto.randomUUID(),
      session_id: activeSessionId,
      exercise_id: selectedExerciseId,
      weight: parseFloat(weight),
      reps: parseInt(reps),
      rpe: parseFloat(rpe),
      set_index: (logs?.length || 0) + 1,
      created_at: new Date()
    })
    if (navigator.vibrate) navigator.vibrate(50)
  }

  async function finishWorkout() {
    if (!activeSessionId) return
    setIsSyncing(true)

    // 1. Lokal abschließen
    await db.workout_sessions.update(activeSessionId, { status: 'completed' })
    const sessionLogs = await db.exercise_logs.where('session_id').equals(activeSessionId).toArray()

    // 2. Summary Daten vorbereiten
    const summaryData = {
      sessionId: activeSessionId,
      setCount: sessionLogs.length,
      volume: sessionLogs.reduce((acc, l) => acc + (l.weight * l.reps), 0),
      synced: false
    }

    // 3. Sofortiger Upload Versuch (Race mit Timeout)
    const performUpload = async () => {
        if (!isOnline) throw new Error("Offline forced")
        
        const session = await db.workout_sessions.get(activeSessionId)
        
        const { error: sessError } = await supabase.from('workout_sessions').insert({
          id: session.id,
          date: session.date,
          status: 'completed'
        })
        if (sessError) throw sessError

        const cleanLogs = sessionLogs.map(log => ({
          id: log.id,
          session_id: log.session_id,
          exercise_id: log.exercise_id,
          weight: log.weight,
          reps: log.reps,
          rpe: log.rpe,
          set_index: log.set_index
        }))

        if (cleanLogs.length > 0) {
          const { error: logError } = await supabase.from('exercise_logs').insert(cleanLogs)
          if (logError) throw logError
        }
        return true
    }

    // Max 3 Sekunden warten, sonst Offline-Mode
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000))

    try {
      await Promise.race([performUpload(), timeoutPromise])
      summaryData.synced = true
    } catch (err) {
      console.warn("Upload skipped (Offline/Timeout):", err)
      summaryData.synced = false
    }

    setFinishedSummary(summaryData)
    setIsSyncing(false)
    setActiveSessionId(null)
    setSelectedExerciseId('')
  }

  const Stepper = ({ label, value, setter, step = 1 }) => (
    <div className="flex flex-col items-center">
      <label className="text-xs text-gray-500 mb-1">{label}</label>
      <div className="flex items-center space-x-2">
        <button onClick={() => setter(v => Math.max(0, Number(v) - step))} className="w-10 h-10 bg-gray-200 rounded-full font-bold text-xl active:bg-gray-300">-</button>
        <span className="text-xl font-bold w-12 text-center">{value}</span>
        <button onClick={() => setter(v => Number(v) + step)} className="w-10 h-10 bg-gray-200 rounded-full font-bold text-xl active:bg-gray-300">+</button>
      </div>
    </div>
  )

  // --- RENDER: SUMMARY VIEW ---
  if (finishedSummary) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 text-center space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="text-6xl mb-2 transition-transform duration-500">
            {finishedSummary.synced ? '☁️' : '💾'}
        </div>
        <h2 className="text-2xl font-black text-gray-800">Training beendet!</h2>
        
        <div className="space-y-2 text-gray-600">
          <p>Sätze: <span className="font-bold text-black">{finishedSummary.setCount}</span></p>
          <p>Volumen: <span className="font-bold text-black">{finishedSummary.volume.toLocaleString()} kg</span></p>
        </div>

        <div className={`p-3 rounded-lg text-sm font-bold transition-colors duration-500 ${finishedSummary.synced ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
          {finishedSummary.synced 
            ? "Erfolgreich synchronisiert ✅" 
            : "Lokal gespeichert. Warte auf Netz... 📡"}
        </div>

        <button 
          onClick={() => setFinishedSummary(null)}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg active:scale-95 transition-transform"
        >
          Zurück zur Startseite
        </button>
      </div>
    )
  }

  // --- RENDER: START BUTTON ---
  if (!activeSessionId) {
    return (
      <button 
        onClick={startWorkout}
        className="w-full py-6 bg-blue-600 text-white rounded-xl text-2xl font-bold shadow-lg active:scale-95 transition-transform flex justify-center items-center gap-2"
      >
        <span>Training Starten</span> 🚀
      </button>
    )
  }

  // --- RENDER: ACTIVE WORKOUT ---
  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-xl font-bold text-gray-800">Training läuft...</h2>
        <button 
          onClick={finishWorkout} 
          disabled={isSyncing}
          className={`px-4 py-2 rounded-lg font-bold text-white transition-colors ${isSyncing ? 'bg-gray-400' : 'bg-red-500 active:bg-red-600'}`}
        >
          {isSyncing ? 'Speichere...' : 'Beenden'}
        </button>
      </div>

      <select 
        className="w-full p-4 bg-white border-2 border-blue-100 rounded-xl text-lg font-medium shadow-sm focus:border-blue-500 outline-none"
        value={selectedExerciseId}
        onChange={e => setSelectedExerciseId(e.target.value)}
      >
        <option value="">-- Übung wählen --</option>
        {exercises?.map(ex => (
          <option key={ex.id} value={ex.id}>{ex.name}</option>
        ))}
      </select>

      {selectedExerciseId && (
        <div className="space-y-6">
            {/* HISTORY SECTION (Wieder da!) */}
            {history?.length > 0 && (
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 overflow-x-auto">
                    <div className="flex gap-4">
                        {history.map((h, i) => (
                            <div key={i} className="min-w-[100px] text-xs">
                                <div className="font-bold text-blue-700 mb-1">
                                    {new Date(h.date).toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit'})}
                                </div>
                                <div className="space-y-0.5 text-blue-900/70">
                                    {h.sets.map((s, j) => (
                                        <div key={j}>{s.weight}kg x {s.reps}</div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* INPUT MASK */}
            <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100 space-y-6">
                <div className="flex justify-between px-2">
                    <Stepper label="Gewicht (kg)" value={weight} setter={setWeight} step={2.5} />
                    <Stepper label="Wdh." value={reps} setter={setReps} step={1} />
                    <Stepper label="RPE" value={rpe} setter={setRpe} step={0.5} />
                </div>
                
                <button 
                    onClick={logSet}
                    className="w-full py-4 bg-green-500 text-white rounded-xl font-bold text-xl shadow active:bg-green-600 active:translate-y-1 transition-all"
                >
                    Satz speichern ✅
                </button>
            </div>
        </div>
      )}

      {/* LOG LIST */}
      <div className="space-y-2">
        {logs?.slice().reverse().map(log => (
          <div key={log.id} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center border-l-4 border-green-400">
            <div>
              <span className="block font-bold text-gray-700">{getExerciseName(log.exercise_id)}</span>
              <span className="text-xs text-gray-400">Satz {log.set_index}</span>
            </div>
            <div className="text-right">
              <span className="block text-lg font-mono font-medium">{log.weight}kg x {log.reps}</span>
              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">RPE {log.rpe}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}