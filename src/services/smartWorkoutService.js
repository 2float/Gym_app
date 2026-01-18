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
    // 1. Versuche, das aktive Programm zu laden (app_config oder Default)
    const program = await workoutRepository.getActiveProgram();
    
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

/**
 * Programme verwalten (UI-Unterstützung):
 */
export const getAvailablePrograms = async () => {
  try {
    return await workoutRepository.getPrograms();
  } catch (error) {
    console.error('SmartEngine: Failed to load programs', error);
    return [];
  }
};

export const setActiveProgram = async (programId) => {
  try {
    await workoutRepository.setActiveProgram(programId);
    return true;
  } catch (error) {
    console.error('SmartEngine: Failed to set active program', error);
    throw error;
  }
};

export const getActiveProgram = async () => {
  try {
    return await workoutRepository.getActiveProgram();
  } catch (error) {
    console.error('SmartEngine: Failed to get active program', error);
    return null;
  }
};

/** Program Mapping Helpers **/
export const getProgramRoutines = async (programId) => {
  try {
    return await workoutRepository.getRoutinesForProgram(programId);
  } catch (error) {
    console.error('SmartEngine: Failed to get program routines', error);
    return [];
  }
};

export const addRoutineToProgram = async (programId, routineId, sortOrder) => {
  try {
    let order = sortOrder;
    
    // Business Rule: Auto-Increment Order if missing
    if (order == null) {
      const currentRoutines = await workoutRepository.getRoutinesForProgram(programId);
      // Safety check if array is null/undefined
      const count = Array.isArray(currentRoutines) ? currentRoutines.length : 0;
      order = count + 1;
    }

    await workoutRepository.addRoutineToProgram(programId, routineId, order);
    return true;
  } catch (error) {
    console.error('SmartEngine: Failed to add routine to program', error);
    throw error;
  }
};

export const removeRoutineFromProgram = async (programId, routineId) => {
  try {
    await workoutRepository.removeRoutineFromProgram(programId, routineId);
    return true;
  } catch (error) {
    console.error('SmartEngine: Failed to remove routine from program', error);
    throw error;
  }
};

export const reorderProgramRoutines = async (programId, routineIdsInOrder) => {
  try {
    await workoutRepository.reorderProgramRoutines(programId, routineIdsInOrder);
    return true;
  } catch (error) {
    console.error('SmartEngine: Failed to reorder program routines', error);
    throw error;
  }
};

export const getAllTemplates = async () => {
  try {
    return await workoutRepository.getAllTemplates();
  } catch (error) {
    console.error('SmartEngine: Failed to load all templates', error);
    return [];
  }
};

/** Program CRUD **/
export const createProgram = async (name, description = '', isDefault = false) => {
  try {
    const created = await workoutRepository.createProgram({ name, description, is_default: isDefault });
    return created;
  } catch (error) {
    console.error('SmartEngine: Failed to create program', error);
    throw error;
  }
};

export const updateProgram = async (programId, fields) => {
  try {
    return await workoutRepository.updateProgram(programId, fields);
  } catch (error) {
    console.error('SmartEngine: Failed to update program', error);
    throw error;
  }
};

export const deleteProgram = async (programId) => {
  try {
    return await workoutRepository.deleteProgram(programId);
  } catch (error) {
    console.error('SmartEngine: Failed to delete program', error);
    throw error;
  }
};

// Default Export für Abwärtskompatibilität, falls nötig
export default {
  getAvailableRoutines,
  getRecommendedRoutine,
  generateSpecificWorkout,
  generateNextWorkout,
  getAvailablePrograms,
  setActiveProgram,
  getActiveProgram,
  getProgramRoutines,
  addRoutineToProgram,
  removeRoutineFromProgram,
  reorderProgramRoutines,
  getAllTemplates,
  createProgram,
  updateProgram,
  deleteProgram
};