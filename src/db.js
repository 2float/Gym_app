import Dexie from 'dexie';

export const db = new Dexie('GymAppDatabase');

db.version(2).stores({
  // Bisherige Stores (Phase 1 & 2)
  workout_logs: '++id, date, workoutName', 
  
  // NEU: Phase 3 - Smart Features (Reference Data)
  // Wir nutzen die UUIDs aus Supabase als primäre Keys
  app_config: 'key',
  ref_equipment: 'id, name',
  ref_exercises: 'id, name, category',
  ref_routines: 'id, name, sort_order',
  ref_routine_exercises: 'id, routine_id, exercise_id'
});

// v3: Index auf synced, damit wir unsynced Logs effizient finden
db.version(3).stores({
  workout_logs: '++id, date, workoutName, synced',
  app_config: 'key',
  ref_equipment: 'id, name',
  ref_exercises: 'id, name, category',
  ref_routines: 'id, name, sort_order',
  ref_routine_exercises: 'id, routine_id, exercise_id'
});

// Helper Log
console.log("Database initialized (v3)");