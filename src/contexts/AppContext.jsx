import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db';
import { supabase } from '../supabaseClient';
import useOnlineStatus from '../hooks/useOnlineStatus';
import { useAuth } from './AuthContext';

const AppContext = createContext();

let _syncInProgress = false;

async function pushUnsyncedLogs(userId) {
  if (_syncInProgress) {
    console.log('📤 Sync bereits aktiv, übersprungen.');
    return 0;
  }
  _syncInProgress = true;
  try {
    const allLogs = await db.workout_logs.toArray();
    const logsToSync = allLogs.filter(log => !log.synced);

    if (logsToSync.length === 0) return 0;

    console.log(`📤 ${logsToSync.length} unsynced Workout(s) gefunden, pushe nach Supabase...`);

    let syncedCount = 0;
    for (const log of logsToSync) {
      const localTime = new Date(log.date);
      const year = localTime.getFullYear();
      const month = String(localTime.getMonth() + 1).padStart(2, '0');
      const day = String(localTime.getDate()).padStart(2, '0');
      const hours = String(localTime.getHours()).padStart(2, '0');
      const minutes = String(localTime.getMinutes()).padStart(2, '0');
      const seconds = String(localTime.getSeconds()).padStart(2, '0');
      const naiveTimestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;

      const supabasePayload = {
        date: naiveTimestamp,
        workout_name: log.workoutName || log.workout_name,
        duration_ms: log.duration_ms,
        exercises: log.exercises,
        user_id: userId
      };

      const dateMinute = naiveTimestamp.substring(0, 16);
      const { data: existing } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('workout_name', supabasePayload.workout_name)
        .gte('date', `${dateMinute}:00Z`)
        .lt('date', `${dateMinute}:59Z`)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`  ⏭️ Workout "${supabasePayload.workout_name}" bereits in Supabase (skip duplicate)`);
        await db.workout_logs.update(log.id, { synced: true });
        syncedCount++;
        continue;
      }

      const { error } = await supabase.from('workout_logs').insert([supabasePayload]);

      if (!error) {
        await db.workout_logs.update(log.id, { synced: true });
        syncedCount++;
        console.log(`  ☁️ Workout "${supabasePayload.workout_name}" (${log.date}) nachträglich synchronisiert`);
      } else {
        console.error(`  ❌ Fehler beim Nachsync von "${supabasePayload.workout_name}":`, error);
      }
    }

    console.log(`📤 ${syncedCount}/${logsToSync.length} Workouts erfolgreich nachsynchronisiert`);
    return syncedCount;
  } catch (err) {
    console.error('❌ pushUnsyncedLogs fehlgeschlagen:', err);
    return 0;
  } finally {
    _syncInProgress = false;
  }
}

let _activitySyncInProgress = false;

async function pushUnsyncedActivities(userId) {
  if (_activitySyncInProgress) {
    console.log('📤 Activity-Sync bereits aktiv, übersprungen.');
    return 0;
  }
  _activitySyncInProgress = true;
  try {
    const allActivities = await db.activity_logs.toArray();
    const activitiesToSync = allActivities.filter(a => !a.synced);

    if (activitiesToSync.length === 0) return 0;

    console.log(`📤 ${activitiesToSync.length} unsynced Activity-Log(s) gefunden, pushe nach Supabase...`);

    let syncedCount = 0;
    for (const activity of activitiesToSync) {
      const localTime = new Date(activity.date);
      const year = localTime.getFullYear();
      const month = String(localTime.getMonth() + 1).padStart(2, '0');
      const day = String(localTime.getDate()).padStart(2, '0');
      const hours = String(localTime.getHours()).padStart(2, '0');
      const minutes = String(localTime.getMinutes()).padStart(2, '0');
      const seconds = String(localTime.getSeconds()).padStart(2, '0');
      const naiveTimestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;

      const supabasePayload = {
        date: naiveTimestamp,
        sport_type: activity.sport_type,
        label: activity.label,
        note: activity.note || null,
        user_id: userId
      };

      const dateMinute = naiveTimestamp.substring(0, 16);
      const { data: existing } = await supabase
        .from('activity_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('sport_type', supabasePayload.sport_type)
        .gte('date', `${dateMinute}:00Z`)
        .lt('date', `${dateMinute}:59Z`)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`  ⏭️ Activity "${supabasePayload.label}" bereits in Supabase (skip duplicate)`);
        await db.activity_logs.update(activity.id, { synced: true });
        syncedCount++;
        continue;
      }

      const { error } = await supabase.from('activity_logs').insert([supabasePayload]);

      if (!error) {
        await db.activity_logs.update(activity.id, { synced: true });
        syncedCount++;
        console.log(`  ☁️ Activity "${supabasePayload.label}" (${activity.date}) nachträglich synchronisiert`);
      } else {
        console.error(`  ❌ Fehler beim Nachsync von "${supabasePayload.label}":`, error);
      }
    }

    console.log(`📤 ${syncedCount}/${activitiesToSync.length} Activity-Logs erfolgreich nachsynchronisiert`);
    return syncedCount;
  } catch (err) {
    console.error('❌ pushUnsyncedActivities fehlgeschlagen:', err);
    return 0;
  } finally {
    _activitySyncInProgress = false;
  }
}

export function AppProvider({ children }) {
  const { user } = useAuth(); // Get current user
  const [history, setHistory] = useState([]);
  const [activityHistory, setActivityHistory] = useState([]);
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isSyncingManually, setIsSyncingManually] = useState(false);
  const isOnline = useOnlineStatus();

  // Load last sync time from localStorage
  useEffect(() => {
    const savedSyncTime = localStorage.getItem('lastSyncTime');
    if (savedSyncTime) {
      setLastSyncTime(new Date(savedSyncTime));
    }
  }, []);

  // Load workout history from Dexie + Cloud Sync
  useEffect(() => {
    let isCancelled = false; // Cleanup flag für React Strict Mode
    
    const initData = async () => {
      let localLogs = await db.workout_logs.orderBy('date').reverse().toArray();
      let localActivities = await db.activity_logs.orderBy('date').reverse().toArray();

      // Nur syncen wenn online UND authenticated
      if (isOnline && user && !isCancelled) {
        // WICHTIG: Zuerst unsynced Logs hochladen, bevor Cloud→Local überschreibt
        await pushUnsyncedLogs(user.id);
        await pushUnsyncedActivities(user.id);

        // Unsynced Logs sichern (falls Push fehlgeschlagen)
        const stillUnsynced = (await db.workout_logs.toArray()).filter(log => !log.synced);
        const stillUnsyncedActivities = (await db.activity_logs.toArray()).filter(a => !a.synced);

        console.log("🔄 Lade aktuelle Daten aus der Cloud...");
        const { data: cloudLogs, error } = await supabase
          .from('workout_logs')
          .select('id, workout_name, duration_ms, exercises, date')
          .order('date', { ascending: false });

        if (!error && cloudLogs && cloudLogs.length > 0 && !isCancelled) {
          // Map workout_name to workoutName for local storage
          const mappedLogs = cloudLogs.map(log => ({
            ...log,
            workoutName: log.workout_name,
            synced: true // WICHTIG: Cloud-Daten als synced markieren
          }));
          await db.workout_logs.clear();
          await db.workout_logs.bulkPut(mappedLogs);

          // Unsynced Logs wiederherstellen (waren noch nicht in der Cloud)
          if (stillUnsynced.length > 0) {
            console.log(`🔒 ${stillUnsynced.length} unsynced Workout(s) wiederherstellen...`);
            for (const log of stillUnsynced) {
              delete log.id; // Neue lokale ID generieren lassen
              await db.workout_logs.add(log);
            }
          }

          localLogs = await db.workout_logs.orderBy('date').reverse().toArray();
          console.log(`📥 ${localLogs.length} Workout Logs synchronisiert!`);
        } else if (error) {
          console.warn("⚠️ Cloud-Sync fehlgeschlagen, nutze lokale Daten:", error.message);
        }

        const { data: cloudActivities, error: activitiesError } = await supabase
          .from('activity_logs')
          .select('id, sport_type, label, note, date')
          .order('date', { ascending: false });

        if (!activitiesError && cloudActivities && cloudActivities.length > 0 && !isCancelled) {
          const mappedActivities = cloudActivities.map(a => ({ ...a, synced: true }));
          await db.activity_logs.clear();
          await db.activity_logs.bulkPut(mappedActivities);

          if (stillUnsyncedActivities.length > 0) {
            console.log(`🔒 ${stillUnsyncedActivities.length} unsynced Activity-Log(s) wiederherstellen...`);
            for (const a of stillUnsyncedActivities) {
              delete a.id;
              await db.activity_logs.add(a);
            }
          }

          localActivities = await db.activity_logs.orderBy('date').reverse().toArray();
          console.log(`📥 ${localActivities.length} Activity Logs synchronisiert!`);
        } else if (activitiesError) {
          console.warn("⚠️ Activity-Cloud-Sync fehlgeschlagen, nutze lokale Daten:", activitiesError.message);
        }

        // Sync auch Referenzdaten (wie beim Manual Sync)
        if (!isCancelled) {
          const [exercisesRes, routinesRes, equipmentRes] = await Promise.all([
            supabase.from('ref_exercises').select('*'),
            supabase.from('ref_routines').select('*'),
            supabase.from('ref_equipment').select('*')
          ]);

          if (exercisesRes.data && !isCancelled) {
            await db.ref_exercises.clear();
            await db.ref_exercises.bulkPut(exercisesRes.data);
            console.log(`📚 ${exercisesRes.data.length} Übungen synchronisiert`);
          }
          if (routinesRes.data && !isCancelled) {
            await db.ref_routines.clear();
            await db.ref_routines.bulkPut(routinesRes.data);
            console.log(`📋 ${routinesRes.data.length} Routinen synchronisiert`);
          }
          if (equipmentRes.data && !isCancelled) {
            await db.ref_equipment.clear();
            await db.ref_equipment.bulkPut(equipmentRes.data);
            console.log(`🏗️ ${equipmentRes.data.length} Equipment-Items synchronisiert`);
          }
        }

        // Update last sync time
        if (!isCancelled) {
          const now = new Date();
          setLastSyncTime(now);
          localStorage.setItem('lastSyncTime', now.toISOString());
        }
      } else if (!isOnline) {
        console.log(`📴 Offline - ${localLogs.length} Workout Logs aus lokalem Cache geladen`);
      } else if (!user) {
        console.log(`🔒 Nicht eingeloggt - Sync übersprungen`);
      }

      if (!isCancelled) {
        setHistory(localLogs);
        setActivityHistory(localActivities);
      }
    };

    initData();

    return () => {
      isCancelled = true; // Cleanup: Verhindere State-Updates nach Unmount
    };
  }, [isWorkoutActive, isOnline, user]); // user hinzugefügt als dependency

  // Reload history after workout
  const refreshHistory = async () => {
    const logs = await db.workout_logs.orderBy('date').reverse().toArray();
    setHistory(logs);
  };

  // Reload activity history after logging an activity
  const refreshActivityHistory = async () => {
    const activities = await db.activity_logs.orderBy('date').reverse().toArray();
    setActivityHistory(activities);
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

      // WICHTIG: Zuerst unsynced Logs hochladen, bevor Cloud→Local überschreibt
      if (user) {
        await pushUnsyncedLogs(user.id);
        await pushUnsyncedActivities(user.id);
      }

      // Unsynced Logs sichern (falls Push fehlgeschlagen)
      const stillUnsynced = (await db.workout_logs.toArray()).filter(log => !log.synced);
      const stillUnsyncedActivities = (await db.activity_logs.toArray()).filter(a => !a.synced);

      // 1. Workout Logs von Cloud holen
      const { data: cloudLogs, error: logsError } = await supabase
        .from('workout_logs')
        .select('id, workout_name, duration_ms, exercises, date')
        .order('date', { ascending: false });

      if (!logsError && cloudLogs?.length > 0) {
        await db.workout_logs.clear(); // Clear old data
        // Map workout_name to workoutName for local storage
        const mappedLogs = cloudLogs.map(log => ({
          ...log,
          workoutName: log.workout_name,
          synced: true // WICHTIG: Cloud-Daten als synced markieren
        }));
        await db.workout_logs.bulkPut(mappedLogs);

        // Unsynced Logs wiederherstellen (waren noch nicht in der Cloud)
        if (stillUnsynced.length > 0) {
          console.log(`🔐 ${stillUnsynced.length} unsynced Workout(s) wiederherstellen...`);
          for (const log of stillUnsynced) {
            delete log.id; // Neue lokale ID generieren lassen
            await db.workout_logs.add(log);
          }
        }

        console.log(`📥 ${cloudLogs.length} Workout Logs synchronisiert`);
      }

      // 1b. Activity Logs von Cloud holen
      const { data: cloudActivities, error: activitiesError } = await supabase
        .from('activity_logs')
        .select('id, sport_type, label, note, date')
        .order('date', { ascending: false });

      if (!activitiesError && cloudActivities?.length > 0) {
        await db.activity_logs.clear();
        const mappedActivities = cloudActivities.map(a => ({ ...a, synced: true }));
        await db.activity_logs.bulkPut(mappedActivities);

        if (stillUnsyncedActivities.length > 0) {
          console.log(`🔐 ${stillUnsyncedActivities.length} unsynced Activity-Log(s) wiederherstellen...`);
          for (const a of stillUnsyncedActivities) {
            delete a.id;
            await db.activity_logs.add(a);
          }
        }

        console.log(`📥 ${cloudActivities.length} Activity Logs synchronisiert`);
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
      await refreshActivityHistory();

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
    activityHistory,
    isOnline,
    isWorkoutActive,
    setIsWorkoutActive,
    refreshHistory,
    refreshActivityHistory,
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
