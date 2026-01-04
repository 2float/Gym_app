import { useState, useEffect } from 'react'
import { db } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'

export function ActiveWorkout() {
  // 1. Zustand
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [weight, setWeight] = useState(0)
  const [reps, setReps] = useState(0)
  const [rpe, setRpe] = useState(8)

  // Datenbank-Abfragen
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const logs = useLiveQuery(
    () => activeSessionId ? db.exercise_logs.where('session_id').equals(activeSessionId).toArray() : [],
    [activeSessionId]
  )

  // HILFSFUNKTION: Namen der Übung finden
  const getExerciseName = (id) => exercises?.find(e => e.id === id)?.name || 'Unbekannt'

  // AKTION: Neues Training starten
  async function startWorkout() {
    // Wir erstellen eine neue Session in der lokalen DB
    const id = crypto.randomUUID() // Generiert eine einzigartige ID
    await db.workout_sessions.add({
      id,
      date: new Date(),
      status: 'active'
    })
    setActiveSessionId(id)
  }

  // AKTION: Satz speichern
  async function logSet() {
    if (!selectedExerciseId || !activeSessionId) return

    await db.exercise_logs.add({
      id: crypto.randomUUID(),
      session_id: activeSessionId,
      exercise_id: selectedExerciseId,
      weight: parseFloat(weight),
      reps: parseInt(reps),
      rpe: parseFloat(rpe),
      timestamp: new Date() // Damit wir später sortieren können
    })
    
    // Feedback (optional: Vibration)
    if (navigator.vibrate) navigator.vibrate(50)
  }

  // ANSICHT 1: Kein aktives Training
  if (!activeSessionId) {
    return (
      <button 
        onClick={startWorkout}
        className="w-full py-4 bg-blue-600 text-white rounded-xl text-xl font-bold shadow-lg active:scale-95 transition-transform"
      >
        Training Starten 🚀
      </button>
    )
  }

  // ANSICHT 2: Aktives Training
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-2">
        <h2 className="text-xl font-bold text-gray-800">Aktives Training</h2>
        <button onClick={() => setActiveSessionId(null)} className="text-red-500 text-sm">Beenden</button>
      </div>

      {/* Übungswähler */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Übung</label>
        <select 
          className="w-full p-3 bg-white border border-gray-300 rounded-lg"
          value={selectedExerciseId}
          onChange={e => setSelectedExerciseId(e.target.value)}
        >
          <option value="">-- Wähle eine Übung --</option>
          {exercises?.map(ex => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>
      </div>

      {/* Eingabemaske (Nur sichtbar wenn Übung gewählt) */}
      {selectedExerciseId && (
        <div className="bg-gray-50 p-4 rounded-xl space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500">kg</label>
              <input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="w-full p-2 border rounded text-center text-lg" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Reps</label>
              <input type="number" value={reps} onChange={e => setReps(e.target.value)} className="w-full p-2 border rounded text-center text-lg" />
            </div>
            <div>
              <label className="text-xs text-gray-500">RPE</label>
              <input type="number" value={rpe} onChange={e => setRpe(e.target.value)} className="w-full p-2 border rounded text-center text-lg" />
            </div>
          </div>
          
          <button 
            onClick={logSet}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-bold text-lg active:bg-green-700"
          >
            Satz speichern ✅
          </button>
        </div>
      )}

      {/* Logbuch Anzeige */}
      <div className="mt-6">
        <h3 className="font-bold text-gray-700 mb-2">Geloggte Sätze:</h3>
        <ul className="space-y-2">
          {logs?.map(log => (
            <li key={log.id} className="bg-white p-3 rounded shadow-sm flex justify-between border-l-4 border-blue-500">
              <span className="font-medium">{getExerciseName(log.exercise_id)}</span>
              <span className="text-gray-600">{log.weight}kg x {log.reps} @{log.rpe}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}