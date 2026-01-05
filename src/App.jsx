import { useState, useEffect } from 'react'
import { ActiveWorkout } from './components/ActiveWorkout'
import { db } from './db'
import { supabase } from './supabaseClient'
import { useOnlineStatus } from './hooks/useOnlineStatus'

function App() {
  const isOnline = useOnlineStatus()
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  // --- AUTO-SYNC BEIM START & WENN ONLINE KOMMT ---
  useEffect(() => {
    if (isOnline) {
      syncOfflineSessions()
    }
  }, [isOnline]) 

  async function syncOfflineSessions() {
    try {
      // 1. Suche nach Sessions, die lokal 'completed' sind
      const offlineSessions = await db.workout_sessions
        .where('status').equals('completed')
        .toArray()

      if (offlineSessions.length === 0) return

      setIsSyncing(true)
      setSyncMessage(`Synchronisiere ${offlineSessions.length} Trainings...`)

      let uploadCount = 0

      for (const session of offlineSessions) {
        // Check, ob Session schon in Supabase ist
        const { data: existing } = await supabase
          .from('workout_sessions')
          .select('id')
          .eq('id', session.id)
          .single()

        if (!existing) {
          // A. Session hochladen
          const { error: sessErr } = await supabase
            .from('workout_sessions')
            .insert({
              id: session.id,
              date: session.date,
              status: 'completed'
            })
          
          if (sessErr) {
            console.error("Sync Fehler Session:", sessErr)
            continue 
          }

          // B. Logs (Sätze) dazu holen und hochladen
          const logs = await db.exercise_logs
            .where('session_id').equals(session.id)
            .toArray()

          const cleanLogs = logs.map(l => ({
            id: l.id,
            session_id: l.session_id,
            exercise_id: l.exercise_id,
            weight: l.weight,
            reps: l.reps,
            rpe: l.rpe,
            set_index: l.set_index
          }))

          if (cleanLogs.length > 0) {
             const { error: logErr } = await supabase.from('exercise_logs').insert(cleanLogs)
             if (logErr) console.error("Sync Fehler Logs:", logErr)
          }
          uploadCount++
        }
      }

      if (uploadCount > 0) {
        setSyncMessage(`${uploadCount} Trainings nachsynchronisiert ✅`)
        setTimeout(() => setSyncMessage(''), 3000)
      } else {
        setSyncMessage('')
      }

    } catch (err) {
      console.error("Auto-Sync Error:", err)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 px-4">
      <h1 className="text-4xl font-black text-blue-600 mb-8 tracking-tighter">
        GYM APP <span className="text-gray-400 text-lg font-normal">v0.2</span>
      </h1>

      {/* --- STATUS BANNER --- */}
      {!isOnline && (
         <div className="w-full max-w-md bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-2 mb-4 text-sm font-bold text-center shadow-sm">
           📡 Offline Modus - Speichere lokal
         </div>
      )}
      {isSyncing && (
        <div className="w-full max-w-md bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-2 mb-4 text-sm font-bold text-center animate-pulse shadow-sm">
           🔄 {syncMessage || 'Synchronisiere...'}
        </div>
      )}

      <div className="w-full max-w-md">
        {/* Wir geben isOnline weiter, damit ActiveWorkout Bescheid weiß */}
        <ActiveWorkout isOnline={isOnline} />
      </div>
    </div>
  )
}

export default App