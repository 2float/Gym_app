import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db';
import { supabase } from '../supabaseClient';
import useOnlineStatus from '../hooks/useOnlineStatus';
import { useDataSync } from '../hooks/useDataSync';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [history, setHistory] = useState([]);
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const isOnline = useOnlineStatus();
  const isSyncing = useDataSync(); // Background sync for reference data

  // Load workout history from Dexie + Cloud Sync
  useEffect(() => {
    const initData = async () => {
      let localLogs = await db.workout_logs.orderBy('date').reverse().toArray();
      
      // Down-Sync: If local is empty but online -> Fetch from cloud
      if (localLogs.length === 0 && isOnline) {
        console.log("🕳 Lokale DB leer. Starte Down-Sync aus der Cloud...");
        const { data: cloudLogs, error } = await supabase
          .from('workout_logs')
          .select('*')
          .order('date', { ascending: false });

        if (!error && cloudLogs.length > 0) {
          await db.workout_logs.bulkPut(cloudLogs);
          localLogs = await db.workout_logs.orderBy('date').reverse().toArray();
          console.log(`📥 ${localLogs.length} Logs synchronisiert!`);
        }
      }

      setHistory(localLogs);
    };

    initData();
  }, [isWorkoutActive, isOnline]);

  // Reload history after workout
  const refreshHistory = async () => {
    const logs = await db.workout_logs.orderBy('date').reverse().toArray();
    setHistory(logs);
  };

  const value = {
    history,
    isOnline,
    isSyncing,
    isWorkoutActive,
    setIsWorkoutActive,
    refreshHistory
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
