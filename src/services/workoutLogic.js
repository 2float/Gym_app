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
    if (!availableRoutines || availableRoutines.length === 0) return null;

    // Letzten Log finden der zu einer bekannten Routine gehört → nächste in der Sequenz
    for (const log of recentLogs) {
      const name = log.workoutName || log.workout_name;
      const idx = availableRoutines.findIndex(r => r.name === name);
      if (idx >= 0) {
        return availableRoutines[(idx + 1) % availableRoutines.length].name;
      }
    }

    // Keine passende History → von vorne beginnen
    return availableRoutines[0].name;
  },

  /**
   * Baut den vollständigen Workout-Plan zusammen.
   * Verbindet Routine-Struktur mit Übungsdaten, Equipment und Progression.
   */
  buildWorkoutPlan(routine, allExercises, allEquipment, config, recentLogs) {
    // Routine-Kontext: progression_type + RPE-Ziele aus Routine (Fallback auf globale Config)
    const routineConfig = {
      ...config,
      progressionType: routine.progression_type || 'hypertrophy',
      rpeTargetMin: routine.rpe_target_min ?? parseFloat(config?.rpe_ziel_min ?? 8),
      rpeTargetMax: routine.rpe_target_max ?? parseFloat(config?.rpe_ziel_max ?? 9),
      weightOffsetPct: routine.weight_offset_pct ?? 0,
    };

    // 1. Übungen filtern und sortieren — Link-Daten behalten
    const routineLinks = (routine.ref_routine_exercises || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(link => ({ link, exercise: allExercises.find(e => e.id === link.exercise_id) }))
      .filter(({ exercise }) => !!exercise);

    // 2. Smart Targets berechnen
    const smartExercises = routineLinks.map(({ link, exercise }) => {
      // Per-Übung progression_type überschreibt Routine-Default (NULL = erben)
      const exerciseProgressionType = link.progression_type || routineConfig.progressionType;
      const exerciseConfig = {
        ...routineConfig,
        progressionType: exerciseProgressionType,
        // weightOffset nur für explosive Übungen anwenden
        weightOffsetPct: exerciseProgressionType === 'explosive' ? routineConfig.weightOffsetPct : 0,
      };

      // A. Letzte 5 Logs für diese Übung sammeln (über alle Sessions)
      const recentEntries = [];
      for (const log of recentLogs) {
        if (recentEntries.length >= 5) break;
        if (log.exercises && Array.isArray(log.exercises)) {
          const found = log.exercises.find(e => e.name === exercise.name);
          if (found) recentEntries.push({ ...found, date: log.date || log.created_at });
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

      // C. Sets/Reps Overrides aus ref_routine_exercises anwenden
      const exerciseDef = {
        ...exercise,
        default_sets: link.sets_override ?? exercise.default_sets,
        min_reps: link.reps_min_override ?? exercise.min_reps,
        max_reps: link.reps_max_override ?? exercise.max_reps,
      };

      // D. Progression berechnen
      const calculation = calculateTarget(exerciseDef, recentEntries, availableWeights, exerciseConfig);

      return {
        id: exercise.id,
        name: exercise.name,
        equipment_names: exercise.equipment_names,
        availableWeights,
        progressionType: exerciseProgressionType,
        execution: exerciseProgressionType === 'explosive' ? 'explosive' : 'normal',
        sets: Array(calculation.sets).fill({
          weight: calculation.weight,
          reps: calculation.reps,
          completed: false
        }),
        targetDetails: {
          ...calculation,
          lastWeight: recentEntries[0]?.weight ?? "-",
          lastReps: recentEntries[0]?.reps ?? "-"
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