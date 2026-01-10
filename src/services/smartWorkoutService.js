import { supabase } from '../supabaseClient';
import { calculateTarget } from '../utils/progressionEngine';
import { db } from '../db';

/**
 * Holt alle verfügbaren Routinen aus der Datenbank
 */
export const getAvailableRoutines = async () => {
  try {
    // Versuche zuerst aus Dexie (offline-fähig)
    let routines = await db.ref_routines.orderBy('sort_order').toArray();
    
    // Falls lokal leer, hole von Supabase
    if (routines.length === 0) {
      const { data, error } = await supabase
        .from('ref_routines')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      routines = data || [];
    }
    
    return routines;
  } catch (error) {
    console.error("❌ Fehler beim Laden der Routinen:", error);
    throw error;
  }
};

/**
 * Berechnet nur die Empfehlung (ohne kompletten Plan zu generieren)
 * Gibt den Namen der empfohlenen Routine zurück
 */
export const getRecommendedRoutine = async () => {
  try {
    // A. LOKALER CHECK - Hole die letzten Workouts
    const recentLogs = await db.workout_logs.orderBy('date').reverse().limit(10).toArray();
    
    const uniqueWorkouts = [];
    for (const log of recentLogs) {
      const workoutName = log.workoutName || log.workout_name;
      if (workoutName && !uniqueWorkouts.includes(workoutName)) {
        uniqueWorkouts.push(workoutName);
      }
      if (uniqueWorkouts.length === 2) break;
    }

    // B. Alle Routinen holen
    const routines = await getAvailableRoutines();
    if (!routines || routines.length === 0) {
      return null;
    }

    let nextRoutineName;

    if (uniqueWorkouts.length === 0) {
      // Keine History → erste Routine
      nextRoutineName = routines[0].name;
    } else if (uniqueWorkouts.length === 1) {
      // Nur 1 Workout → nächstes im Zyklus
      const lastIndex = routines.findIndex(r => r.name === uniqueWorkouts[0]);
      if (lastIndex >= 0 && lastIndex < routines.length - 1) {
        nextRoutineName = routines[lastIndex + 1].name;
      } else {
        nextRoutineName = routines[0].name; // Wrap around
      }
    } else {
      // 2+ verschiedene Workouts → finde den fehlenden dritten
      const routineNames = routines.map(r => r.name);
      const missing = routineNames.find(name => !uniqueWorkouts.includes(name));
      nextRoutineName = missing || routines[0].name;
    }

    return nextRoutineName;
  } catch (error) {
    console.error("❌ Fehler bei Empfehlungsberechnung:", error);
    return null;
  }
};

/**
 * Holt das nächste "Smart Workout" basierend auf der Historie.
 * Strategie: "Local First" Read
 * 1. Prüfe lokale DB (Dexie) auf letztes Training (das ist immer aktuell, auch offline).
 * 2. Fallback: Supabase (nur wenn lokal leer).
 */
export const generateNextWorkout = async () => {
  try {
    let lastRoutineName = null;

    // A. LOKALER CHECK (Priorität 1)
    // Hole die letzten Workouts und finde die letzten 2 verschiedenen Typen
    const recentLogs = await db.workout_logs.orderBy('date').reverse().limit(10).toArray();
    
    const uniqueWorkouts = [];
    for (const log of recentLogs) {
      const workoutName = log.workoutName || log.workout_name;
      if (!uniqueWorkouts.includes(workoutName)) {
        uniqueWorkouts.push(workoutName);
      }
      if (uniqueWorkouts.length === 2) break; // Wir haben die letzten 2 verschiedenen gefunden
    }
    
    console.log(`🧠 Smart Engine: Letzte 2 verschiedene Workouts:`, uniqueWorkouts);

    // B. CLOUD FALLBACK (nur wenn lokal keine Daten)
    if (uniqueWorkouts.length === 0) {
      const { data: remoteLogs } = await supabase
        .from('workout_logs')
        .select('workout_name, date')
        .order('date', { ascending: false })
        .limit(10);

      if (remoteLogs && remoteLogs.length > 0) {
        for (const log of remoteLogs) {
          if (!uniqueWorkouts.includes(log.workout_name)) {
            uniqueWorkouts.push(log.workout_name);
          }
          if (uniqueWorkouts.length === 2) break;
        }
        console.log(`🧠 Smart Engine (Cloud Fallback):`, uniqueWorkouts);
      }
    }

    // C. NÄCHSTE ROUTINE BESTIMMEN
    // Alle Routinen holen (sortiert nach Reihenfolge)
    const { data: routines, error: routineError } = await supabase
      .from('ref_routines')
      .select('*')
      .order('sort_order', { ascending: true });

    if (routineError) throw routineError;
    if (!routines || routines.length === 0) throw new Error("Keine Routinen (Templates) in der DB gefunden!");

    let nextRoutineName;

    if (uniqueWorkouts.length === 0) {
      // Keine History → starte mit erster Routine
      nextRoutineName = routines[0].name;
      console.log(`🆕 Kein Training in History → Start mit '${nextRoutineName}'`);
    } else if (uniqueWorkouts.length === 1) {
      // Nur 1 Workout → nächstes im Zyklus
      const lastIndex = routines.findIndex(r => r.name === uniqueWorkouts[0]);
      if (lastIndex >= 0 && lastIndex < routines.length - 1) {
        nextRoutineName = routines[lastIndex + 1].name;
      } else {
        nextRoutineName = routines[0].name; // Wrap around
      }
      console.log(`🔄 Nur 1 Typ in History → Nächstes: '${nextRoutineName}'`);
    } else {
      // 2+ verschiedene Workouts → finde den fehlenden dritten
      const routineNames = routines.map(r => r.name);
      const missing = routineNames.find(name => !uniqueWorkouts.includes(name));
      nextRoutineName = missing || routines[0].name; // Fallback falls alle vorhanden
      console.log(`🎯 Letzte 2 waren ${uniqueWorkouts.join(', ')} → Empfehlung: '${nextRoutineName}'`);
    }

    if (!nextRoutineName) {
      // Final Fallback (sollte nie passieren)
      nextRoutineName = routines[0].name;

    }

    console.log(`🧠 Smart Engine: Plan '${nextRoutineName}' wird generiert.`);
    return await generateSpecificWorkout(nextRoutineName);

  } catch (error) {
    console.error("❌ Fehler bei der Workout-Generierung:", error);
    throw error;
  }
};

// ... generateSpecificWorkout bleibt unverändert ...
// (Bitte den restlichen Code der Datei beibehalten, er ist hier nicht betroffen)
export const generateSpecificWorkout = async (routineName) => {
    // ... (unveränderter Code aus deiner Datei)
    // A. Alle notwendigen Referenzdaten parallel laden
  const [
    routineRes,
    exercisesRes,
    equipmentRes,
    configRes
  ] = await Promise.all([
    supabase.from('ref_routines').select('*, ref_routine_exercises(sort_order, exercise_id)').eq('name', routineName).single(),
    supabase.from('ref_exercises').select('*'),
    supabase.from('ref_equipment').select('*'),
    supabase.from('app_config').select('*')
  ]);

  if (routineRes.error) throw routineRes.error;
  
  const routine = routineRes.data;
  const allExercises = exercisesRes.data;
  const allEquipment = equipmentRes.data;
  
  // Config Array zu Object konvertieren für einfacheren Zugriff
  const config = {};
  configRes.data?.forEach(c => config[c.key] = c.value);

  // B. Übungen für diese Routine filtern und sortieren
  const routineExercises = routine.ref_routine_exercises
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(link => allExercises.find(e => e.id === link.exercise_id))
    .filter(e => !!e); // Falls eine Übung gelöscht wurde

  // C. Historie für diese spezifischen Übungen holen (Optimierung: Nur relevante Logs holen)
  // Wir holen die letzten 5 Logs jeder Übung, um sicherzugehen.
  // Einfacher: Wir holen die letzten 50 Logs global und filtern im Code (bei 1 User okay)
  const { data: recentLogs } = await supabase
    .from('workout_logs')
    .select('*')
    .order('date', { ascending: false })
    .limit(50); // Sollte reichen, um für jede Übung den letzten Eintrag zu finden

  // D. Das "ActiveWorkout" Objekt zusammenbauen
  const smartExercises = routineExercises.map(exercise => {
    // 1. Letzten Log dieser Übung finden
    // Wir suchen im JSONB Feld 'exercises' der Logs
    let lastLogEntry = null;
    
    // Suche chronologisch rückwärts
    for (const log of recentLogs || []) {
        // Log.exercises ist ein JSON Array
        const found = log.exercises.find(e => e.name === exercise.name);
        if (found) {
            lastLogEntry = found;
            break; // Gefunden! Abbruch.
        }
    }

    // 2. Verfügbare Gewichte finden
    // exercise.equipment_names ist ein Array von Namen (z.B. ["KH"]) oder null
    let availableWeights = [];
    if (exercise.equipment_names && exercise.equipment_names.length > 0) {
        // Wir nehmen an, das erste Gerät definiert die Gewichte (meistens korrekt bei Alternativen)
        const eqName = exercise.equipment_names[0]; 
        const eq = allEquipment.find(e => e.name === eqName);
        if (eq && eq.weights) {
            availableWeights = eq.weights;
        }
    }

    // 3. Calculation Engine aufrufen
    const calculation = calculateTarget(exercise, lastLogEntry, availableWeights, config);

    return {
      id: exercise.id, // Wichtig für Keys
      name: exercise.name,
      sets: Array(calculation.sets).fill({
        weight: calculation.weight,
        reps: calculation.reps,
        completed: false
      }),
      targetDetails: {
          ...calculation, // hint, isCalculated, etc.
          lastWeight: lastLogEntry ? lastLogEntry.weight : "-",
          lastReps: lastLogEntry ? lastLogEntry.reps : "-"
      }
    };
  });

  return {
    routineName: routine.name,
    startedAt: new Date(),
    exercises: smartExercises
  };
};