import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { db } from './db'
import { useLiveQuery } from 'dexie-react-hooks'
import { ActiveWorkout } from './components/ActiveWorkout'

function App() {
  // 1. Live-Daten aus der lokalen DB
  const exercises = useLiveQuery(() => db.exercises.toArray())
  
  // 2. Status für Internet-Verbindung
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    // Event-Listener: Hören, ob das Netz weggeht oder wiederkommt
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Sync-Logik: Nur ausführen, wenn wir wirklich online sind
    async function syncData() {
      if (!navigator.onLine) {
        console.log("Offline: Überspringe Download.")
        return
      }

      try {
        console.log("Online: Lade neue Daten von Supabase...")
        const { data: supabaseExercises, error } = await supabase.from('exercises').select('*')
        if (error) throw error
        
        await db.exercises.bulkPut(supabaseExercises)
        console.log("Sync erfolgreich.")
      } catch (err) {
        console.error("Sync Fehler:", err)
      }
    }

    syncData()

    // Aufräumen, wenn die App geschlossen wird
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, []) // Wird beim Start ausgeführt

  return (
    <div className="min-h-screen bg-gray-100">
      
      {/* Der Offline-Banner */}
      {!isOnline && (
        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 mb-4" role="alert">
          <p className="font-bold">Offline-Modus</p>
          <p className="text-sm">Du siehst Daten aus dem lokalen Speicher. Änderungen werden später synchronisiert.</p>
        </div>
      )}

      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Meine Übungen</h1>
          {/* Kleiner Indikator oben rechts */}
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
            {isOnline ? '● Online' : '○ Offline'}
          </span>
        </div>
        <div className="mb-8">
          <ActiveWorkout />
        </div>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <ul>
            {exercises?.map(ex => (
              <li key={ex.id} className="border-b last:border-b-0 px-6 py-4 flex justify-between items-center hover:bg-gray-50">
                <span className="font-medium text-gray-900">{ex.name}</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {ex.category}
                </span>
              </li>
            ))}
          </ul>
          {/* Fallback, wenn Liste leer ist */}
          {exercises?.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              Keine Übungen gefunden.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App