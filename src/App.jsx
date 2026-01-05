import { useState, useEffect, useRef } from 'react'
import { ActiveWorkout } from './components/ActiveWorkout'
import { db } from './db'
import { supabase } from './supabaseClient'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { useLiveQuery } from 'dexie-react-hooks'

function App() {
  const isOnline = useOnlineStatus()
  const syncTimeoutRef = useRef(null) // Referenz für den Timer
  
  // --- RECENT HISTORY ---
  const recentSessions = useLiveQuery(async () => {
    const sessions = await db.workout_sessions
      .where('status').equals('completed')
      .reverse()
      .limit(3)
      .toArray()
    
    const sessionsWithStats = await Promise.all(sessions.map(async s => {
      const logs = await db.exercise_logs.where('session_id').equals(s.id).count()
      return { ...s, set_count: logs }
    }))
    
    return sessionsWithStats
  })

  // --- GLOBAL AUTO-SYNC (Mit 2s Debounce) ---
  useEffect(() => {
    // 1. Wenn Offline: Sofort Timer abbrechen, nichts tun.
    if (!isOnline) {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      return;
    }

    // 2. Wenn Online erkannt: Alten Timer löschen (falls vorhanden) und neuen setzen
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    
    console.log("⏳ Online erkannt. Warte 2s auf Stabilität...");
    
    syncTimeoutRef.current = setTimeout(() => {
      console.log("🚀 2s stabil online. Starte Background-Sync!");
      syncOfflineSessions();
    }, 2000); // 2000ms Wartezeit

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [isOnline]) 

  async function syncOfflineSessions() {
    try {
      const offlineSessions = await db.workout_sessions
        .where('status').equals('completed')
        .toArray()

      if (offlineSessions.length === 0) return

      // Prüfen was schon da ist
      const localIds = offlineSessions.map(s => s.id)
      const { data: existingRemote, error } = await supabase
        .from('workout_sessions')
        .select('id')
        .in('id', localIds)

      if (error) throw error // Abbruch bei Netzwerkfehler

      const existingIds = new Set(existingRemote?.map(x => x.id) || [])
      const sessionsToSync = offlineSessions.filter(s => !existingIds.has(s.id))

      if (sessionsToSync.length === 0) return;

      console.log(`📡 Background Sync: ${sessionsToSync.length} Sessions...`)

      for (const session of sessionsToSync) {
        // Session
        const { error: sessError } = await supabase.from('workout_sessions').insert({
          id: session.id,
          date: session.date,
          status: 'completed'
        })
        if (sessError) throw sessError;
        
        // Logs
        const logs = await db.exercise_logs.where('session_id').equals(session.id).toArray()
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
          if (logError) throw logError;
        }
      }
      console.log("✅ Background Sync erfolgreich!")

    } catch (err) {
       console.error("Auto-Sync abgebrochen (Netzwerk instabil?):", err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 px-4">
      
      {/* HEADER ROW (Ohne Status Button) */}
      <div className="w-full max-w-md flex justify-center items-center mb-8">
        <h1 className="text-4xl font-black text-blue-600 tracking-tighter">
          GYM APP <span className="text-gray-400 text-lg font-normal">v0.3</span>
        </h1>
      </div>

      <div className="w-full max-w-md space-y-8">
        <ActiveWorkout isOnline={isOnline} />

        {/* --- RECENT HISTORY --- */}
        {recentSessions && recentSessions.length > 0 && (
          <div className="border-t pt-6 animate-in slide-in-from-bottom-4">
            <h3 className="text-gray-500 font-bold uppercase text-xs mb-3 tracking-wide">Letzte Trainings</h3>
            <div className="space-y-3">
              {recentSessions.map(session => (
                <div key={session.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-gray-800">
                      {new Date(session.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(session.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute:'2-digit' })} Uhr
                    </div>
                  </div>
                  <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm font-bold">
                    {session.set_count} Sätze
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App