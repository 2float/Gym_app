import { useState } from 'react'
import { db } from '../db'
import { supabase } from '../supabaseClient'
import { useLiveQuery } from 'dexie-react-hooks'

export function ActiveWorkout() {
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  
  // States für Eingabe
  const [weight, setWeight] = useState(60)
  const [reps, setReps] = useState(8)
  const [rpe, setRpe] = useState(8)
  const [isSyncing, setIsSyncing] = useState(false)

  // DB Abfragen
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const logs = useLiveQuery(
    () => activeSessionId ? db.exercise_logs.where('session_id').equals(activeSessionId).toArray() : [],
    [activeSessionId]
  )

  const getExerciseName = (id) => exercises?.find(e => e.id === id)?.name || 'Unbekannt'

  // --- LOGIK: TRAINING STARTEN ---
  async function startWorkout() {
    const id = crypto.randomUUID()
    // Wir speichern den Startzeitpunkt lokal
    await db.workout_sessions.add({
      id,
      date: new Date(), // Wichtig: Dexie speichert JS Date Objekte
      status: 'active'
    })
    setActiveSessionId(id)
  }

  // --- LOGIK: SATZ SPEICHERN ---
  async function logSet() {
    if (reps <= 0 || weight <= 0) {
      alert("Gewicht und Wiederholungen müssen größer als 0 sein.")
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
      set_index: logs.length + 1, // Einfache Zählung
      created_at: new Date()
    })
    
    // Kleines haptisches Feedback (wenn Handy unterstützt)
    if (navigator.vibrate) navigator.vibrate(50)
  }

  // --- LOGIK: TRAINING BEENDEN & UPLOAD ---
  async function finishWorkout() {
    if (!activeSessionId) return
    setIsSyncing(true)

    try {
      // 1. Hole die Session Daten aus Dexie
      const session = await db.workout_sessions.get(activeSessionId)
      const sessionLogs = await db.exercise_logs.where('session_id').equals(activeSessionId).toArray()

      // 2. Prüfe Online-Status
      if (navigator.onLine) {
        console.log("Lade Training hoch...", session.id)

        // A) Session hochladen
        const { error: sessError } = await supabase.from('workout_sessions').insert({
          id: session.id,
          date: session.date, // Supabase konvertiert das Date-Objekt automatisch
          status: 'completed'
        })
        if (sessError) throw sessError

        // B) Sätze hochladen
        // Wir müssen sicherstellen, dass wir nur Daten senden, die die DB versteht
        const cleanLogs = sessionLogs.map(log => ({
          id: log.id,
          session_id: log.session_id,
          exercise_id: log.exercise_id,
          weight: log.weight,
          reps: log.reps,
          rpe: log.rpe,
          set_index: log.set_index
        }))

        const { error: logError } = await supabase.from('exercise_logs').insert(cleanLogs)
        if (logError) throw logError

        alert("Training erfolgreich synchronisiert! 🎉")
      } else {
        alert("Du bist offline. Training wurde lokal gespeichert und wird später synchronisiert.")
      }

      // 3. Lokal aufräumen / Status ändern
      await db.workout_sessions.update(activeSessionId, { status: 'completed' })
      setActiveSessionId(null)
      setSelectedExerciseId('')

    } catch (err) {
      console.error("Fehler beim Upload:", err)
      alert("Fehler beim Upload: " + err.message)
    } finally {
      setIsSyncing(false)
    }
  }

  // --- HELPER: STEPPER BUTTONS ---
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

  // --- ANSICHT: START ---
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

  // --- ANSICHT: AKTIV ---
  return (
    <div className="space-y-6 pb-20"> {/* pb-20 für Platz unten */}
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-xl font-bold text-gray-800">Training läuft...</h2>
        <button 
          onClick={finishWorkout} 
          disabled={isSyncing}
          className={`px-4 py-2 rounded-lg font-bold text-white ${isSyncing ? 'bg-gray-400' : 'bg-red-500 active:bg-red-600'}`}
        >
          {isSyncing ? 'Sync...' : 'Beenden'}
        </button>
      </div>

      {/* Übungswahl */}
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

      {/* Eingabemaske mit großen Buttons */}
      {selectedExerciseId && (
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
      )}

      {/* Log Liste */}
      <div className="space-y-2">
        {logs?.slice().reverse().map(log => ( // Neueste oben
          <div key={log.id} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center border-l-4 border-blue-400">
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