import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db';
import { supabase } from '../supabaseClient';
import useOnlineStatus from '../hooks/useOnlineStatus';
import { useDataSync } from '../hooks/useDataSync';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [history, setHistory] = useState([]);
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isSyncingManually, setIsSyncingManually] = useState(false);
  const isOnline = useOnlineStatus();
  const isSyncing = useDataSync(); // Background sync for reference data

  // Load last sync time from localStorage
  useEffect(() => {
    const savedSyncTime = localStorage.getItem('lastSyncTime');
    if (savedSyncTime) {
      setLastSyncTime(new Date(savedSyncTime));
    }
  }, []);

  // Load workout history from Dexie + Cloud Sync
  useEffect(() => {
    const initData = async () => {
      let localLogs = await db.workout_logs.orderBy('date').reverse().toArray();
      
      // Down-Sync: If local is empty but online -> Fetch from cloud
      if (localLogs.length === 0 && isOnline) {
        console.log("🕳 Lokale DB leer. Starte Down-Sync aus der Cloud...");
        const { data: cloudLogs, error } = await supabase
          .from('workout_logs')
          .select('id, workout_name, duration_ms, exercises, created_at')
          .order('created_at', { ascending: false });

        if (!error && cloudLogs.length > 0) {
          // Map created_at to date for local storage
          const mappedLogs = cloudLogs.map(log => ({
            ...log,
            date: log.created_at,
            workoutName: log.workout_name
          }));
          await db.workout_logs.bulkPut(mappedLogs);
          localLogs = await db.workout_logs.orderBy('date').reverse().toArray();
          console.log(`📥 ${localLogs.length} Logs synchronisiert!`);
          
          // Update last sync time
          const now = new Date();
          setLastSyncTime(now);
          localStorage.setItem('lastSyncTime', now.toISOString());
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

  // Manual sync function
  const triggerManualSync = async () => {
    if (!isOnline) {
      alert('⚠️ Keine Internetverbindung! Sync nicht möglich.');
      return;
    }

    setIsSyncingManually(true);
    try {
      console.log('🔄 Manueller Sync gestartet...');
      
      // 1. Workout Logs von Cloud holen
      const { data: cloudLogs, error: logsError } = await supabase
        .from('workout_logs')
        .select('id, workout_name, duration_ms, exercises, created_at')
        .order('created_at', { ascending: false });

      if (!logsError && cloudLogs?.length > 0) {
        await db.workout_logs.clear(); // Clear old data
        // Map created_at to date for local storage
        const mappedLogs = cloudLogs.map(log => ({
          ...log,
          date: log.created_at,
          workoutName: log.workout_name
        }));
        await db.workout_logs.bulkPut(mappedLogs);
        console.log(`📥 ${cloudLogs.length} Workout Logs synchronisiert`);
      }

      // 2. Referenzdaten syncen
      const [exercisesRes, routinesRes, equipmentRes] = await Promise.all([
        supabase.from('ref_exercises').select('*'),
        supabase.from('ref_routines').select('*'),
        supabase.from('ref_equipment').select('*')
      ]);

      if (!exercisesRes.error && exercisesRes.data) {
        await db.ref_exercises.clear();
        await db.ref_exercises.bulkPut(exercisesRes.data);
        console.log(`📚 ${exercisesRes.data.length} Übungen synchronisiert`);
      }

      if (!routinesRes.error && routinesRes.data) {
        await db.ref_routines.clear();
        await db.ref_routines.bulkPut(routinesRes.data);
        console.log(`📋 ${routinesRes.data.length} Routinen synchronisiert`);
      }

      if (!equipmentRes.error && equipmentRes.data) {
        await db.ref_equipment.clear();
        await db.ref_equipment.bulkPut(equipmentRes.data);
        console.log(`🏗️ ${equipmentRes.data.length} Equipment-Items synchronisiert`);
      }

      // 3. Timestamp aktualisieren
      const now = new Date();
      setLastSyncTime(now);
      localStorage.setItem('lastSyncTime', now.toISOString());

      // 4. History neu laden
      await refreshHistory();

      console.log('✅ Sync erfolgreich abgeschlossen!');
    } catch (error) {
      console.error('❌ Sync-Fehler:', error);
      alert('Fehler beim Synchronisieren: ' + error.message);
    } finally {
      setIsSyncingManually(false);
    }
  };

  const value = {
    history,
    isOnline,
    isSyncing,
    isWorkoutActive,
    setIsWorkoutActive,
    refreshHistory,
    lastSyncTime,
    isSyncingManually,
    triggerManualSync
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
