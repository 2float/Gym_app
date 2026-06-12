import { calculateTarget } from '../utils/progressionEngine';

/**
 * Pure Business Logic für die Workout Engine.
 * Keine Datenbank-Calls, keine Side-Effects.
 */
export const workoutLogic = {

  /**
   * Bestimmt die nächste Routine basierend auf der Historie.
   * @param {Array} recentLogs - Liste der letzten Workout Logs
   * @param {Array} availableRoutines - Liste der verfügbaren Routinen (sortiert!)
   * @returns {String} Name der nächsten Routine
   */
  determineNextRoutine(recentLogs, availableRoutines) {
    if (!availableRoutines || availableRoutines.length === 0) {
      return null;
    }

    // 1. Extrahiere die Namen der letzten Workouts
    const uniqueWorkouts = [];
    for (const log of recentLogs) {
      // Compat: Supabase liefert snake_case, Dexie camelCase. Wir prüfen beides.
      const name = log.workoutName || log.workout_name;
      if (name && !uniqueWorkouts.includes(name)) {
        uniqueWorkouts.push(name);
      }
      if (uniqueWorkouts.length === 2) break; // Wir schauen nur die letzten 2 verschiedenen an
    }

    // 2. Entscheidungslogik
    if (uniqueWorkouts.length === 0) {
      // Case A: Keine History -> Erste Routine
      return availableRoutines[0].name;
    } 
    
    if (uniqueWorkouts.length === 1) {
      // Case B: Nur 1 Typ in History -> Nächstes in der Liste
      const lastRoutineName = uniqueWorkouts[0];
      const currentIndex = availableRoutines.findIndex(r => r.name === lastRoutineName);
      
      if (currentIndex >= 0 && currentIndex < availableRoutines.length - 1) {
        return availableRoutines[currentIndex + 1].name;
      } else {
        return availableRoutines[0].name; // Wrap around (Start von vorne)
      }
    }

    // Case C: 2+ verschiedene Workouts -> Finde die Lücke (Rotation)
    // Beispiel: Routinen A, B, C. History: B, A. -> Next: C.
    const routineNames = availableRoutines.map(r => r.name);
    const missing = routineNames.find(name => !uniqueWorkouts.includes(name));
    
    return missing || availableRoutines[0].name; // Fallback
  },

  /**
   * Baut den vollständigen Workout-Plan zusammen.
   * Verbindet Routine-Struktur mit Übungsdaten, Equipment und Progression.
   */
  buildWorkoutPlan(routine, allExercises, allEquipment, config, recentLogs) {
    // 1. Übungen filtern und sortieren
    // (ref_routine_exercises ist im Routine-Objekt genestet)
    const routineExercises = (routine.ref_routine_exercises || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(link => allExercises.find(e => e.id === link.exercise_id))
      .filter(e => !!e); // Filtere kaputte Links

    // 2. Smart Targets berechnen
    const smartExercises = routineExercises.map(exercise => {
      // A. Letzten Log für diese spezifische Übung finden
      let lastLogEntry = null;
      for (const log of recentLogs) {
        // Log.exercises ist ein JSON Array in der DB
        if (log.exercises && Array.isArray(log.exercises)) {
          const found = log.exercises.find(e => e.name === exercise.name);
          if (found) {
            lastLogEntry = found;
            break; 
          }
        }
      }

      // B. Verfügbare Gewichte ermitteln
      let availableWeights = [];
      if (exercise.equipment_names && exercise.equipment_names.length > 0) {
        const eqName = exercise.equipment_names[0];
        const eq = allEquipment.find(e => e.name === eqName);
        if (eq && eq.weights) {
          availableWeights = eq.weights;
        }
      }

      // C. Progression berechnen (ruft die Engine auf)
      const calculation = calculateTarget(exercise, lastLogEntry, availableWeights, config);

      return {
        id: exercise.id,
        name: exercise.name,
        equipment_names: exercise.equipment_names,
        availableWeights,
        sets: Array(calculation.sets).fill({
          weight: calculation.weight,
          reps: calculation.reps,
          completed: false
        }),
        targetDetails: {
          ...calculation,
          lastWeight: lastLogEntry ? lastLogEntry.weight : "-",
          lastReps: lastLogEntry ? lastLogEntry.reps : "-"
        }
      };
    });

    // 3. Ergebnis zurückgeben
    return {
      routineName: routine.name,
      startedAt: new Date(),
      exercises: smartExercises
    };
  }
};