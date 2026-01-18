import { supabase } from '../supabaseClient';

/**
 * Repository für den Datenzugriff (Supabase).
 * Kapselt alle DB-Abfragen für die Workout-Engine.
 */
export const workoutRepository = {
  
  /**
   * Holt alle verfügbaren Trainingsprogramme.
   */
  async getPrograms() {
    const { data, error } = await supabase
      .from('ref_training_programs')
      .select('id, name, description, is_default')
      .order('id', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Erstellt ein neues Programm.
   */
  async createProgram({ name, description = '', is_default = false }) {
    const { data, error } = await supabase
      .from('ref_training_programs')
      .insert({ name, description, is_default })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Aktualisiert ein Programm (Name/Beschreibung/Default).
   */
  async updateProgram(programId, fields) {
    const { data, error } = await supabase
      .from('ref_training_programs')
      .update(fields)
      .eq('id', programId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Löscht ein Programm, wenn keine Zuordnungen existieren.
   */
  async deleteProgram(programId) {
    // Prüfe, ob Zuordnungen vorhanden sind
    const { data: mappings, error: mapErr } = await supabase
      .from('ref_program_routines')
      .select('routine_id')
      .eq('program_id', programId)
      .limit(1);
    if (mapErr) throw mapErr;
    if (Array.isArray(mappings) && mappings.length > 0) {
      throw new Error('Programm hat zugeordnete Templates. Bitte zuerst entfernen.');
    }

    const { error } = await supabase
      .from('ref_training_programs')
      .delete()
      .eq('id', programId);
    if (error) throw error;
    return true;
  },
  
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
   * Setzt das aktive Programm global über app_config.
   */
  async setActiveProgram(programId) {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'active_program_id', value: String(programId) }, { onConflict: 'key' });
    if (error) throw error;
    return true;
  },

  /**
   * Holt das aktive Programm: zuerst aus app_config, sonst Default.
   */
  async getActiveProgram() {
    // Versuche app_config zu lesen
    const { data: cfgData, error: cfgError } = await supabase
      .from('app_config')
      .select('*')
      .eq('key', 'active_program_id')
      .limit(1);

    if (cfgError) {
      console.warn('Error reading app_config active_program_id:', cfgError);
    }

    const entry = Array.isArray(cfgData) ? cfgData[0] : null;
    if (entry && entry.value) {
      const id = parseInt(entry.value, 10);
      if (!isNaN(id)) {
        const { data, error } = await supabase
          .from('ref_training_programs')
          .select('*')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      }
    }

    // Fallback: Default Programm
    return await workoutRepository.getDefaultProgram();
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
   * Fügt eine Routine zu einem Programm hinzu.
   * Wenn kein sort_order angegeben, hängt ans Ende an.
   */
  async addRoutineToProgram(programId, routineId, sortOrder = null) {
    // Falls sortOrder nicht gesetzt, ermittle max(sort_order)+1
    if (sortOrder == null) {
      const { data: existing } = await supabase
        .from('ref_program_routines')
        .select('sort_order')
        .eq('program_id', programId)
        .order('sort_order', { ascending: false })
        .limit(1);
      const nextOrder = (existing && existing[0]?.sort_order) ? (existing[0].sort_order + 1) : 1;
      sortOrder = nextOrder;
    }

    const { error } = await supabase
      .from('ref_program_routines')
      .insert({ program_id: programId, routine_id: routineId, sort_order: sortOrder });
    if (error) throw error;
    return true;
  },

  /**
   * Entfernt eine Routine-Zuordnung aus einem Programm.
   */
  async removeRoutineFromProgram(programId, routineId) {
    const { error } = await supabase
      .from('ref_program_routines')
      .delete()
      .eq('program_id', programId)
      .eq('routine_id', routineId);
    if (error) throw error;
    return true;
  },

  /**
   * Reordnet Routinen in einem Programm gemäß der gegebenen Reihenfolge.
   */
  async reorderProgramRoutines(programId, routineIdsInOrder) {
    // Update sort_order pro Eintrag
    for (let i = 0; i < routineIdsInOrder.length; i++) {
      const routineId = routineIdsInOrder[i];
      const { error } = await supabase
        .from('ref_program_routines')
        .update({ sort_order: i + 1 })
        .eq('program_id', programId)
        .eq('routine_id', routineId);
      if (error) throw error;
    }
    return true;
  },

  /**
   * Holt alle Templates (Routinen) unabhängig vom Programm.
   */
  async getAllTemplates() {
    const { data, error } = await supabase
      .from('ref_routines')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
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