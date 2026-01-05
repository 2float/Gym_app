import React, { useState, useEffect } from 'react';
import { db } from './db';
import { supabase } from './supabaseClient'; // <--- DAS HAT GEFEHLT!
import ActiveWorkout from './components/ActiveWorkout';
import useOnlineStatus from './hooks/useOnlineStatus';
import { generateNextWorkout } from './services/smartWorkoutService';


function App() {
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [history, setHistory] = useState([]);
  
  // NEU: Smart Features State
  const [smartPlan, setSmartPlan] = useState(null); // Speichert den generierten Plan
  const [isLoadingPlan, setIsLoadingPlan] = useState(false); // Lade-Spinner
  const [errorMsg, setErrorMsg] = useState("");

  const isOnline = useOnlineStatus();

  // Load history from Dexie
  useEffect(() => {
    const loadHistory = async () => {
      const logs = await db.workout_logs.orderBy('date').reverse().toArray();
      setHistory(logs);
    };
    loadHistory();
  }, [isWorkoutActive]);

  // Sync Logic (Background)
  useEffect(() => {
    const initData = async () => {
      // 1. Lokale Daten laden
      let localLogs = await db.workout_logs.orderBy('date').reverse().toArray();
      
      // 2. Down-Sync Check: Wenn lokal leer, aber online -> Hol Daten aus der Cloud
      if (localLogs.length === 0 && isOnline) {
        console.log("🕳 Lokale DB leer. Starte Down-Sync aus der Cloud...");
        const { data: cloudLogs, error } = await supabase
          .from('workout_logs')
          .select('*')
          .order('date', { ascending: false });

        if (!error && cloudLogs.length > 0) {
          // Wichtig: IDs beibehalten oder neu vergeben? 
          // Da Dexie auto-increment hat, aber wir UUIDs aus Supabase haben,
          // speichern wir sie idealerweise so, wie sie kommen.
          // Wir müssen sicherstellen, dass Dexie die UUID akzeptiert oder wir mappen sie.
          // Fürs erste mappen wir die Cloud-Daten einfach rein:
          
          await db.workout_logs.bulkPut(cloudLogs);
          localLogs = await db.workout_logs.orderBy('date').reverse().toArray();
          console.log(`📥 ${localLogs.length} Logs synchronisiert!`);
        }
      }

      setHistory(localLogs);
    };

    initData();
  }, [isWorkoutActive, isOnline]); // Auch bei Online-Status-Wechsel prüfen

  // NEU: Smart Workout Start
  const handleStartSmartWorkout = async () => {
    setIsLoadingPlan(true);
    setErrorMsg("");
    try {
      // 1. Plan generieren lassen (Online-Check passiert im Service bzw. wird vorausgesetzt)
      if (!isOnline) {
        throw new Error("Für den Smart-Start benötigst du Internet!");
      }

      const plan = await generateNextWorkout();
      console.log("Plan geladen:", plan);
      
      setSmartPlan(plan);
      setIsWorkoutActive(true);
    } catch (err) {
      console.error(err);
      setErrorMsg("Fehler beim Laden des Plans: " + err.message);
      // Fallback: Leeres Training starten? Oder User zwingen zu retry?
      // Wir lassen ihn erstmal im Menu.
    } finally {
      setIsLoadingPlan(false);
    }
  };

  const handleFinishWorkout = () => {
    setIsWorkoutActive(false);
    setSmartPlan(null); // Reset Plan
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      {/* HEADER */}
      <header className="bg-blue-600 text-white p-4 shadow-md sticky top-0 z-10 flex justify-between items-center">
        <h1 className="text-xl font-bold tracking-tight">Gym App v0.3</h1>
        {/* Status Indikator (optional, aber hilfreich) */}
        <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-500'}`} title={isOnline ? "Online" : "Offline"}></div>
      </header>

      {/* ERROR MESSAGE */}
      {errorMsg && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 m-4">
          <p>{errorMsg}</p>
        </div>
      )}

      <main className="p-4 max-w-md mx-auto">
        {isWorkoutActive ? (
          <ActiveWorkout 
            initialData={smartPlan} // Wir geben den Plan weiter!
            onFinish={handleFinishWorkout} 
          />
        ) : (
          <div className="space-y-6">
            {/* WELCOME / DASHBOARD */}
            <div className="bg-white p-6 rounded-lg shadow-sm text-center">
              <h2 className="text-2xl font-bold mb-2">Bereit für Gains?</h2>
              <p className="text-gray-600 mb-6">Lass uns deinen perfekten Plan für heute berechnen.</p>
              
              <button 
                onClick={handleStartSmartWorkout}
                disabled={isLoadingPlan}
                className={`w-full py-4 rounded-xl text-lg font-bold shadow-lg transition-all transform active:scale-95 flex justify-center items-center
                  ${isLoadingPlan 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600'
                  }`}
              >
                {isLoadingPlan ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Berechne Plan...
                  </>
                ) : (
                  "🚀 Smart Workout Starten"
                )}
              </button>
              
              {!isOnline && (
                <p className="text-xs text-red-500 mt-2">
                  * Internet erforderlich für Plan-Generierung
                </p>
              )}
            </div>

            {/* HISTORY LIST */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700 uppercase text-sm tracking-wider">Letzte Workouts</h3>
              {history.length === 0 ? (
                <p className="text-gray-500 text-sm italic">Noch keine Einträge.</p>
              ) : (
                history.slice(0, 5).map(log => (
                  <div key={log.id || log.date} className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-400">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-gray-800">{log.workoutName || "Training"}</span>
                      <span className="text-xs text-gray-500">{new Date(log.date).toLocaleDateString()}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {log.exercises?.length || 0} Übungen
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;