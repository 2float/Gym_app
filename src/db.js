import Dexie from 'dexie';

export const db = new Dexie('GymDatabase');

db.version(1).stores({
  // Primärschlüssel ist 'id'
  exercises: 'id, name, category', 
  
  // Für Templates speichern wir auch die exercise_order
  workout_templates: 'id, name',
  
  // Trainingseinheiten
  workout_sessions: 'id, status, date', 
  
  // Die Logs: 'session_id' wird indexiert für schnelle Abfragen
  exercise_logs: 'id, session_id, exercise_id' 
});