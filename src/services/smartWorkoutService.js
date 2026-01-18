import { workoutRepository } from './workoutRepository';
import { workoutLogic } from './workoutLogic';

/**
 * Smart Workout Service (Orchestrator Layer)
 * * Verdrahtet Daten (Repository) mit Entscheidungen (Logic).
 * Hält die öffentliche API stabil, damit UI-Komponenten (Home, ActiveWorkout)
 * nicht geändert werden müssen.
 */

/**
 * Gibt alle verfügbaren Routinen zurück.
 * Berücksichtigt jetzt das aktive Trainingsprogramm (falls vorhanden),
 * sonst Fallback auf Legacy-Routinen.
 */
export const getAvailableRoutines = async () => {
  try {
    // 1. Versuche, das Standard-Programm zu laden
    const program = await workoutRepository.getDefaultProgram();
    
    if (program) {
      // 2a. Lade Routinen des Programms (sortiert)
      const programRoutines = await workoutRepository.getRoutinesForProgram(program.id);
      // Falls das Programm (noch) keine Routinen enthält, fallback auf Legacy
      if (!programRoutines || programRoutines.length === 0) {
        console.warn('SmartEngine: Program has no routines. Falling back to legacy ref_routines.');
        return await workoutRepository.getAllRoutinesLegacy();
      }
      return programRoutines;
    } else {
      // 2b. Fallback: Lade alle Routinen wie früher
      console.warn('SmartEngine: No default program found. Using legacy mode.');
      return await workoutRepository.getAllRoutinesLegacy();
    }
  } catch (error) {
    console.error('SmartEngine: Failed to load routines', error);
    return [];
  }
};

/**
 * Ermittelt, welche Routine als nächstes dran ist.
 * Basiert auf der Historie der letzten Workouts.
 */
export const getRecommendedRoutine = async () => {
  try {
    const [routines, logs] = await Promise.all([
      getAvailableRoutines(),
      workoutRepository.getRecentLogs(10)
    ]);

    return workoutLogic.determineNextRoutine(logs, routines);
  } catch (error) {
    console.error('SmartEngine: Failed to recommend routine', error);
    return null;
  }
};

/**
 * Generiert einen vollständigen Trainingsplan für eine spezifische Routine.
 * Berechnet Gewichte, Sets und Wiederholungen (Progression).
 */
export const generateSpecificWorkout = async (routineName) => {
  try {
    // 1. Nötige Daten parallel laden
    const [routines, refData, logs] = await Promise.all([
      getAvailableRoutines(),
      workoutRepository.getReferenceData(),
      workoutRepository.getRecentLogs(50) // Mehr Logs für genauere Übungshistorie
    ]);

    // 2. Gewünschte Routine finden
    const routine = routines.find(r => r.name === routineName);
    if (!routine) {
      throw new Error(`Routine '${routineName}' not found`);
    }

    // 3. Plan berechnen (Logic Layer)
    return workoutLogic.buildWorkoutPlan(
      routine,
      refData.exercises,
      refData.equipment,
      refData.config,
      logs
    );

  } catch (error) {
    console.error(`SmartEngine: Failed to generate workout '${routineName}'`, error);
    throw error;
  }
};

/**
 * Generiert automatisch den Plan für das nächste empfohlene Workout.
 */
export const generateNextWorkout = async () => {
  const nextRoutineName = await getRecommendedRoutine();
  if (!nextRoutineName) {
    throw new Error('No routine could be recommended (Check data/connection)');
  }
  return generateSpecificWorkout(nextRoutineName);
};

// Default Export für Abwärtskompatibilität, falls nötig
export default {
  getAvailableRoutines,
  getRecommendedRoutine,
  generateSpecificWorkout,
  generateNextWorkout
};