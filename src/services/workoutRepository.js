import { supabase } from '../supabaseClient';

/**
 * Repository für den Datenzugriff (Supabase).
 * Kapselt alle DB-Abfragen für die Workout-Engine.
 */
export const workoutRepository = {
  
  /**
   * Holt das Standard-Trainingsprogramm (Global Default).
   */
  async getDefaultProgram() {
    const { data, error } = await supabase
      .from('ref_training_programs')
      .select('*')
      .eq('is_default', true)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = 0 rows
      console.error('Error fetching default program:', error);
      return null;
    }
    return data;
  },

  /**
   * Holt die Routinen für ein spezifisches Programm, sortiert nach Reihenfolge.
   * Joint ref_program_routines mit ref_routines.
   */
  async getRoutinesForProgram(programId) {
    const { data, error } = await supabase
      .from('ref_program_routines')
      .select(`
        sort_order,
        ref_routines (
          id,
          name,
          ref_routine_exercises (
            sort_order,
            exercise_id
          )
        )
      `)
      .eq('program_id', programId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    
    // Flatten structure: Wir wollen direkt ein Array von Routine-Objekten zurückgeben
    return data.map(item => ({
      ...item.ref_routines,
      sort_order: item.sort_order // Nimm die Sortierung aus dem Programm, nicht der Routine
    }));
  },

  /**
   * Fallback: Holt alle Routinen (Legacy Mode), falls kein Programm aktiv ist.
   */
  async getAllRoutinesLegacy() {
    const { data, error } = await supabase
      .from('ref_routines')
      .select('*, ref_routine_exercises(sort_order, exercise_id)')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Holt alle Referenzdaten, die für die Berechnung eines Workouts nötig sind.
   * (Exercises, Equipment, App Config)
   */
  async getReferenceData() {
    const [exercisesRes, equipmentRes, configRes] = await Promise.all([
      supabase.from('ref_exercises').select('*'),
      supabase.from('ref_equipment').select('*'),
      supabase.from('app_config').select('*')
    ]);

    if (exercisesRes.error) throw exercisesRes.error;
    if (equipmentRes.error) throw equipmentRes.error;
    if (configRes.error) throw configRes.error;

    // Config Array zu Objekt umwandeln
    const config = {};
    configRes.data?.forEach(c => config[c.key] = c.value);

    return {
      exercises: exercisesRes.data,
      equipment: equipmentRes.data,
      config: config
    };
  },

  /**
   * Holt die letzten Workout-Logs für die Historien-Analyse.
   */
  async getRecentLogs(limit = 50) {
    const { data, error } = await supabase
      .from('workout_logs')
      .select('workout_name, date, exercises') // Supabase snake_case Felder auswählen
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }
};