import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { supabase } from '../supabaseClient';
import useOnlineStatus from '../hooks/useOnlineStatus';

const ActiveWorkout = ({ onFinish, initialData }) => {
  // initialData enthält jetzt unseren Smart Plan!
  const [workoutName, setWorkoutName] = useState(initialData?.routineName || "Freies Training");
  const [startTime] = useState(new Date());
  
  // Initialisiere Übungen mit den Daten aus dem Smart Plan (oder leer)
  const [exercises, setExercises] = useState(initialData?.exercises || []);
  
  // UI State für das Hinzufügen neuer (manueller) Übungen
  const [newExerciseName, setNewExerciseName] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  
  const isOnline = useOnlineStatus();

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleAddExercise = () => {
    if (!newExerciseName.trim()) return;
    setExercises([...exercises, { 
      name: newExerciseName, 
      sets: [{ weight: '', reps: '', completed: false }] 
    }]);
    setNewExerciseName("");
  };

  const handleUpdateSet = (exerciseIndex, setIndex, field, value) => {
    const updatedExercises = [...exercises];
    updatedExercises[exerciseIndex].sets[setIndex][field] = value;
    setExercises(updatedExercises);
  };

  const toggleSetComplete = (exerciseIndex, setIndex) => {
    const updatedExercises = [...exercises];
    updatedExercises[exerciseIndex].sets[setIndex].completed = !updatedExercises[exerciseIndex].sets[setIndex].completed;
    setExercises(updatedExercises);
  };

  const addSet = (exerciseIndex) => {
    const updatedExercises = [...exercises];
    // Smart Feature: Kopiere Werte vom vorherigen Satz als Vorschlag
    const previousSet = updatedExercises[exerciseIndex].sets[updatedExercises[exerciseIndex].sets.length - 1];
    updatedExercises[exerciseIndex].sets.push({ 
        weight: previousSet?.weight || '', 
        reps: previousSet?.reps || '', 
        completed: false 
    });
    setExercises(updatedExercises);
  };

  const finishWorkout = async () => {
    setIsFinishing(true);
    const endTime = new Date();
    const durationMs = endTime - startTime;

    const logEntry = {
      date: endTime.toISOString().split('T')[0], // YYYY-MM-DD
      workoutName,
      duration_ms: durationMs,
      exercises: exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets.length,
        // Wir speichern hier die RAW Daten für die Analyse später
        reps: ex.sets.map(s => s.reps).join(';'), 
        weight: ex.sets.map(s => s.weight).join(';'),
        rpe: ex.rpe || "", // Falls wir RPE Input hinzufügen wollen (aktuell optional)
        note: ex.note || "" 
      })),
      synced: false
    };

    try {
      // 1. Save to Dexie (Offline First)
      const id = await db.workout_logs.add(logEntry);
      console.log("Locally saved with ID:", id);

      // 2. Try Sync to Supabase if Online
      if (isOnline) {
        // Wir entfernen das 'synced' Feld vor dem Upload zu Supabase, da es dort nicht existiert
        const { synced, ...supabasePayload } = logEntry;
        const { error } = await supabase.from('workout_logs').insert([supabasePayload]);
        
        if (!error) {
          await db.workout_logs.update(id, { synced: true });
          console.log("Directly synced to Cloud!");
        } else {
          console.warn("Cloud sync failed, will retry later:", error);
        }
      }
    } catch (err) {
      console.error("Save failed:", err);
    }

    // Kurzer Delay für UX Feedback
    setTimeout(() => {
      onFinish();
    }, 1500);
  };

  if (isFinishing) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <h2 className="text-xl font-bold text-gray-700">Training wird gespeichert...</h2>
        <p className="text-gray-500">Starke Leistung! 💪</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER */}
      <div className="flex justify-between items-end border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold text-blue-900">{workoutName}</h2>
          <p className="text-gray-500 text-sm">
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </div>
        <div className="text-right">
             {/* Timer könnte hier hin */}
        </div>
      </div>

      {/* EXERCISE LIST */}
      {exercises.map((exercise, exIndex) => (
        <div key={exIndex} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Exercise Header */}
          <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-lg text-gray-800">{exercise.name}</h3>
                {/* SMART HINT */}
                {exercise.targetDetails && (
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            exercise.targetDetails.hint.includes("Steigerung") ? "bg-green-100 text-green-700" :
                            exercise.targetDetails.hint.includes("Halten") ? "bg-yellow-100 text-yellow-700" :
                            "bg-blue-100 text-blue-700"
                        }`}>
                            {exercise.targetDetails.hint}
                        </span>
                        {exercise.targetDetails.lastWeight !== "-" && (
                             <span className="text-xs text-gray-400">
                                Last: {exercise.targetDetails.lastWeight}kg x {exercise.targetDetails.lastReps}
                             </span>
                        )}
                    </div>
                )}
            </div>
            {/* Optional: Menu Icon for delete/edit */}
          </div>

          {/* Sets */}
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-10 gap-2 text-xs text-gray-400 uppercase font-semibold text-center mb-1">
              <div className="col-span-1">#</div>
              <div className="col-span-3">kg</div>
              <div className="col-span-3">Reps</div>
              <div className="col-span-3">Check</div>
            </div>

            {exercise.sets.map((set, setIndex) => (
              <div key={setIndex} className={`grid grid-cols-10 gap-2 items-center transition-colors ${set.completed ? 'opacity-50' : ''}`}>
                <div className="col-span-1 text-center font-bold text-gray-400">
                  {setIndex + 1}
                </div>
                <div className="col-span-3">
                  <input 
                    type="number" 
                    placeholder="kg"
                    value={set.weight}
                    onChange={(e) => handleUpdateSet(exIndex, setIndex, 'weight', e.target.value)}
                    className={`w-full p-2 text-center border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold
                        ${exercise.targetDetails ? 'bg-green-50 border-green-200 text-green-900' : 'bg-gray-50'}
                    `}
                  />
                </div>
                <div className="col-span-3">
                  <input 
                    type="number" 
                    placeholder="Reps"
                    value={set.reps}
                    onChange={(e) => handleUpdateSet(exIndex, setIndex, 'reps', e.target.value)}
                    className={`w-full p-2 text-center border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold
                         ${exercise.targetDetails ? 'bg-green-50 border-green-200 text-green-900' : 'bg-gray-50'}
                    `}
                  />
                </div>
                <div className="col-span-3 flex justify-center">
                  <button 
                    onClick={() => toggleSetComplete(exIndex, setIndex)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      set.completed 
                        ? 'bg-green-500 text-white shadow-md transform scale-105' 
                        : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                    }`}
                  >
                    {set.completed && (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                    )}
                  </button>
                </div>
              </div>
            ))}

            {/* Add Set Button */}
            <button 
                onClick={() => addSet(exIndex)}
                className="w-full py-2 mt-2 text-xs font-bold text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded dashed border border-transparent hover:border-blue-200 transition-all"
            >
                + SATZ HINZUFÜGEN
            </button>
          </div>
        </div>
      ))}

      {/* Manual Exercise Add */}
      <div className="bg-white p-4 rounded-xl shadow-sm">
         <div className="flex gap-2">
            <input 
                type="text" 
                placeholder="Übung hinzufügen..." 
                className="flex-1 p-3 border rounded-lg bg-gray-50 focus:bg-white transition-colors outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* FINISH BUTTON */}
      <button 
        onClick={finishWorkout}
        className="w-full bg-green-500 text-white py-4 rounded-xl text-xl font-bold shadow-lg hover:bg-green-600 active:scale-95 transition-all mb-8"
      >
        WORKOUT BEENDEN ✅
      </button>
    </div>
  );
};

export default ActiveWorkout;