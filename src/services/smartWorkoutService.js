import { supabase } from '../supabaseClient';
import { calculateTarget } from '../utils/progressionEngine';
import { db } from '../db'; // Für lokalen Fallback oder falls wir Hybrid fahren wollen

/**
 * Holt das nächste "Smart Workout" basierend auf der Historie.
 * * Strategie:
 * 1. Wir gehen davon aus, dass der User ONLINE ist (wie besprochen).
 * 2. Wir laden die neuesten Configs & Logs direkt von Supabase für maximale Aktualität.
 */
export const generateNextWorkout = async () => {
  try {
    // 1. Letztes Training finden (um den Split-Tag zu bestimmen)
    const { data: lastLogs, error: logError } = await supabase
      .from('workout_logs')
      .select('workout_name, date')
      .order('date', { ascending: false })
      .limit(1);

    if (logError) throw logError;

    // Default: Wenn noch nie trainiert wurde, starte mit dem ersten Split (meist "Push" oder Order 1)
    let nextRoutineName = null;
    
    // Alle Routinen holen (sortiert nach Reihenfolge)
    const { data: routines, error: routineError } = await supabase
      .from('ref_routines')
      .select('*')
      .order('sort_order', { ascending: true });

    if (routineError) throw routineError;
    if (!routines || routines.length === 0) throw new Error("Keine Routinen (Templates) in der DB gefunden!");

    if (lastLogs && lastLogs.length > 0) {
      const lastRoutineName = lastLogs[0].workout_name;
      const lastIndex = routines.findIndex(r => r.name === lastRoutineName);
      
      // Zyklischer Wechsel: Wenn letztes Training gefunden, nimm das nächste in der Liste
      // Wenn letztes Training nicht in der Liste (z.B. alter Name), starte vorne.
      if (lastIndex >= 0 && lastIndex < routines.length - 1) {
        nextRoutineName = routines[lastIndex + 1].name;
      } else {
        nextRoutineName = routines[0].name; // Reset auf Start (z.B. nach Leg Day wieder Push)
      }
    } else {
      nextRoutineName = routines[0].name; // Erstes Training überhaupt
    }

    console.log(`🧠 Smart Engine: Letztes Training war '${lastLogs?.[0]?.workout_name}'. Nächstes ist '${nextRoutineName}'`);

    return await generateSpecificWorkout(nextRoutineName);

  } catch (error) {
    console.error("❌ Fehler bei der Workout-Generierung:", error);
    throw error;
  }
};

/**
 * Generiert einen Plan für eine spezifische Routine (z.B. "Push")
 */
export const generateSpecificWorkout = async (routineName) => {
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