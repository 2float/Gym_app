import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { supabase } from '../supabaseClient';
import useOnlineStatus from '../hooks/useOnlineStatus';
import ExerciseCard from './ExerciseCard';

const ActiveWorkout = ({ onFinish, initialData }) => {
  const [workoutName, setWorkoutName] = useState(initialData?.routineName || "Freies Training");
  const [startTime] = useState(new Date());
  
  // Haupt-State: Die Liste der Übungen
  const [exercises, setExercises] = useState(initialData?.exercises || []);
  
  // UI State
  const [newExerciseName, setNewExerciseName] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  
  const isOnline = useOnlineStatus();

  // Scroll to top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // --- ACTIONS ---

  // Update einer einzelnen Übung in der Liste (wird von ExerciseCard aufgerufen)
  const handleExerciseUpdate = (index, updatedExercise) => {
    const newExercises = [...exercises];
    newExercises[index] = updatedExercise;
    setExercises(newExercises);
  };

  // Übung löschen
  const handleDeleteExercise = (index) => {
    if (confirm('Übung wirklich entfernen?')) {
        const newExercises = exercises.filter((_, i) => i !== index);
        setExercises(newExercises);
    }
  };

  // Neue Übung hinzufügen (Manuell) -> TODO: Später Dropdown
  const handleAddExercise = () => {
    if (!newExerciseName.trim()) return;
    setExercises([...exercises, { 
      name: newExerciseName, 
      sets: [{ weight: '', reps: '', completed: false }],
      // WICHTIG: Leeres targetDetails Objekt, damit UI nicht crasht
      targetDetails: null 
    }]);
    setNewExerciseName("");
  };

  // Workout speichern
  const finishWorkout = async () => {
    setIsFinishing(true);
    const endTime = new Date();
    const durationMs = endTime - startTime;

    const logEntry = {
      date: endTime.toISOString().split('T')[0],
      workoutName,
      duration_ms: durationMs,
      exercises: exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets.length,
        // Raw Data speichern
        reps: ex.sets.map(s => s.reps).join(';'), 
        weight: ex.sets.map(s => s.weight).join(';'),
        rpe: ex.rpe || "", 
        note: ex.note || "" 
      })),
      synced: false
    };

    try {
      // 1. Dexie Save
      const id = await db.workout_logs.add(logEntry);
      console.log("Locally saved ID:", id);

      // 2. Cloud Sync (Best Effort)
      if (isOnline) {
        const { synced, ...supabasePayload } = logEntry;
        const { error } = await supabase.from('workout_logs').insert([supabasePayload]);
        
        if (!error) {
          await db.workout_logs.update(id, { synced: true });
          console.log("Synced to Supabase!");
        }
      }
    } catch (err) {
      console.error("Save failed:", err);
    }

    setTimeout(() => {
      onFinish();
    }, 1000);
  };

  // --- RENDER ---

  if (isFinishing) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <h2 className="text-xl font-bold text-gray-700">Speichere Gains...</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* HEADER */}
      <div className="flex justify-between items-end border-b pb-4 bg-white/50 sticky top-0 backdrop-blur-md z-10 p-2 -mx-2">
        <div>
          <h2 className="text-2xl font-bold text-blue-900">{workoutName}</h2>
          <p className="text-gray-500 text-xs uppercase tracking-wide">
             {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </div>
        {/* Platzhalter für Timer später */}
        <div className="text-right text-gray-400 font-mono text-sm">
           ⏱️ --:--
        </div>
      </div>

      {/* EXERCISE LIST */}
      {exercises.map((exercise, index) => (
        <ExerciseCard 
            key={exercise.id || index} // Fallback Key, falls ID fehlt
            exercise={exercise}
            onUpdate={(updatedEx) => handleExerciseUpdate(index, updatedEx)}
            onDelete={() => handleDeleteExercise(index)}
        />
      ))}

      {/* MANUAL ADD (Provisorisch) */}
      <div className="bg-white p-4 rounded-xl shadow-sm">
         <div className="flex gap-2">
            <input 
                type="text" 
                placeholder="Übung hinzufügen..." 
                className="flex-1 p-3 border rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
                value={newExerciseName}
                onChange={(e) => setNewExerciseName(e.target.value)}
            />
            <button 
                onClick={handleAddExercise}
                className="bg-gray-800 text-white px-6 rounded-lg font-bold hover:bg-gray-900"
            >
                +
            </button>
         </div>
      </div>

      {/* FOOTER ACTION */}
      <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto">
          <button 
            onClick={finishWorkout}
            className="w-full bg-green-500 text-white py-4 rounded-xl text-xl font-bold shadow-lg hover:bg-green-600 active:scale-95 transition-all"
          >
            FINISH WORKOUT ✅
          </button>
      </div>
    </div>
  );
};

export default ActiveWorkout;