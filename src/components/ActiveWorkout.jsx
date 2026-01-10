import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { supabase } from '../supabaseClient';
import useOnlineStatus from '../hooks/useOnlineStatus';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import ExerciseCard from './ExerciseCard';
import ExerciseSelector from './ExerciseSelector';
import ErrorBoundary from './ErrorBoundary';

const ActiveWorkout = ({ onFinish, initialData }) => {
  const { user } = useAuth();
  const [workoutName, setWorkoutName] = useState(initialData?.routineName || "Freies Training");
  const [startTime] = useState(new Date());
  
  // Haupt-State: Die Liste der Übungen
  const [exercises, setExercises] = useState(initialData?.exercises || []);
  
  // UI State
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [expandedExerciseIndex, setExpandedExerciseIndex] = useState(0); // Erste Übung ist standardmäßig offen
  
  const isOnline = useOnlineStatus();
  const { refreshHistory } = useApp();

  // Scroll to top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Auto-Collapse: Wenn eine Übung fertig ist (alle Sets + RPE), klappt sie zu und nächste öffnet sich
  useEffect(() => {
    if (expandedExerciseIndex === null || exercises.length === 0) return;

    const currentExercise = exercises[expandedExerciseIndex];
    if (!currentExercise) return;

    // Prüfe ob Übung "fertig" ist
    const allSetsCompleted = currentExercise.sets.every(set => set.completed);
    const hasRPE = currentExercise.rpe && currentExercise.rpe.trim() !== '';
    
    if (allSetsCompleted && hasRPE) {
      // Übung ist fertig → öffne nächste
      const nextIndex = expandedExerciseIndex + 1;
      if (nextIndex < exercises.length) {
        setTimeout(() => setExpandedExerciseIndex(nextIndex), 300); // Kurze Verzögerung für UX
      } else {
        // Alle Übungen fertig → schließe alles
        setTimeout(() => setExpandedExerciseIndex(null), 300);
      }
    }
  }, [exercises, expandedExerciseIndex]);

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

  // Neue Übung aus Katalog hinzufügen
  const handleExerciseSelect = async (selectedExercise) => {
    // History laden, um Default-Werte zu finden
    const allLogs = await db.workout_logs.orderBy('date').reverse().toArray();
    
    let lastWeight = "";
    let lastReps = "";
    let targetDetails = null;

    // Suche nach der letzten Verwendung dieser Übung
    for (const log of allLogs) {
      const foundExercise = log.exercises?.find(ex => ex.name === selectedExercise.name);
      if (foundExercise) {
        // Nimm die letzten Werte (erste im neuesten Log)
        const weights = foundExercise.weight?.split(';').filter(w => w);
        const reps = foundExercise.reps?.split(';').filter(r => r);
        
        if (weights?.length > 0 && reps?.length > 0) {
          lastWeight = weights[weights.length - 1]; // Letzter Satz
          lastReps = reps[reps.length - 1];
          
          targetDetails = {
            lastWeight,
            lastReps,
            lastDate: log.date
          };
        }
        break; // Stoppe bei erstem Fund (neuestes Log)
      }
    }

    // Füge Übung mit Defaults hinzu
    setExercises([...exercises, { 
      name: selectedExercise.name,
      muscle_group: selectedExercise.muscle_group,
      sets: [{ 
        weight: lastWeight, // Pre-fill mit letztem Gewicht
        reps: lastReps,     // Pre-fill mit letzten Reps
        completed: false 
      }],
      targetDetails // Zeigt "Last: X kg x Y" an
    }]);
    setShowExerciseSelector(false);
  };

  // Workout speichern
  const finishWorkout = async () => {
    // 1. VALIDIERUNG: Check auf fehlende RPE bei erledigten Sätzen
    const missingRpe = exercises.some(ex => 
        ex.sets.some(s => s.completed) && (!ex.rpe || ex.rpe.trim() === "")
    );

    if (missingRpe) {
        alert("⚠️ Bitte trage für alle Übungen mit erledigten Sätzen eine RPE ein (1-10)!");
        return; // Abbruch
    }

    setIsFinishing(true);
    const endTime = new Date();
    const durationMs = endTime - startTime;

    // 2. DATEN AUFBEREITEN
    // Filtere Übungen: Nur solche, wo mindestens 1 Satz completed ist
    const validExercises = exercises
        .map(ex => ({
            ...ex,
            sets: ex.sets.filter(s => s.completed) // Nur erledigte Sätze
        }))
        .filter(ex => ex.sets.length > 0); // Nur Übungen mit Sätzen

    if (validExercises.length === 0) {
        alert("Keine Sätze abgeschlossen. Training wird nicht gespeichert.");
        setIsFinishing(false);
        return;
    }

    // Basis-Objekt für Dexie (verwendet camelCase wie im Frontend gewohnt)
    const logEntryLocal = {
      date: endTime.toISOString(), // Vollständiger Timestamp statt nur Datum
      workoutName, 
      duration_ms: durationMs,
      exercises: validExercises.map(ex => ({
        name: ex.name,
        sets: ex.sets.length,
        reps: ex.sets.map(s => s.reps).join(';'), 
        weight: ex.sets.map(s => s.weight).join(';'),
        rpe: ex.rpe || "", 
        note: ex.note || "" 
      })),
      synced: false
    };

    try {
      // 3. DEXIE SAVE (Lokal)
      const id = await db.workout_logs.add(logEntryLocal);
      console.log("✅ Locally saved ID:", id);

      // 4. CLOUD SYNC (Best Effort)
      if (isOnline) {
        // Lokale Zeit als "naive UTC" speichern (wie beim Import)
        const localTime = new Date(endTime);
        const year = localTime.getFullYear();
        const month = String(localTime.getMonth() + 1).padStart(2, '0');
        const day = String(localTime.getDate()).padStart(2, '0');
        const hours = String(localTime.getHours()).padStart(2, '0');
        const minutes = String(localTime.getMinutes()).padStart(2, '0');
        const seconds = String(localTime.getSeconds()).padStart(2, '0');
        const naiveTimestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
        
        // MAPPING FÜR SUPABASE: camelCase -> snake_case
        const supabasePayload = {
            date: naiveTimestamp, // Lokale Zeit als UTC (naive timestamp)
            workout_name: logEntryLocal.workoutName,
            duration_ms: logEntryLocal.duration_ms,
            exercises: logEntryLocal.exercises,
            user_id: user.id // Wichtig: User ID für RLS
            // created_at wird weiterhin automatisch gesetzt
            // KEIN 'synced' Feld an Supabase senden
            // KEIN 'id' senden (Supabase generiert eigene UUID/Int)
        };

        const { error } = await supabase.from('workout_logs').insert([supabasePayload]);
        
        if (!error) {
          await db.workout_logs.update(id, { synced: true });
          console.log("☁️ Synced to Supabase!");
        } else {
            console.error("❌ Supabase Upload Error:", error);
            // Kein Throw, damit User im UI fertig wird -> Sync retry beim nächsten Start
        }
      }
    } catch (err) {
      console.error("Save failed:", err);
      alert("Fehler beim Speichern! Bitte Screenshot machen.");
    }

    // Refresh history in context so dashboard shows new workout
    await refreshHistory();

    setTimeout(() => {
      onFinish();
    }, 1000);
  };

  // Workout abbrechen
  const handleCancel = () => {
    if (confirm('⚠️ Training wirklich abbrechen? Alle Daten gehen verloren!')) {
      onFinish();
    }
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
        <button 
          onClick={handleCancel}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Zurück zum Hauptmenü"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 mx-4">
          <h2 className="text-2xl font-bold text-blue-900">{workoutName}</h2>
          <p className="text-gray-500 text-xs uppercase tracking-wide">
             {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </div>
      </div>

      {/* EXERCISE LIST */}
      {exercises.map((exercise, index) => (
        <ErrorBoundary key={exercise.id || index} title="Fehler beim Laden der Übung">
          <ExerciseCard 
              exercise={exercise}
              onUpdate={(updatedEx) => handleExerciseUpdate(index, updatedEx)}
              onDelete={() => handleDeleteExercise(index)}
              isExpanded={expandedExerciseIndex === index}
              onToggleExpand={() => setExpandedExerciseIndex(expandedExerciseIndex === index ? null : index)}
          />
        </ErrorBoundary>
      ))}

      {/* ADD EXERCISE BUTTON */}
      <button 
        onClick={() => setShowExerciseSelector(true)}
        className="w-full bg-white p-4 rounded-xl shadow-sm text-gray-600 font-semibold hover:bg-gray-50 border-2 border-dashed border-gray-300 hover:border-blue-400 transition-all"
      >
        + Übung hinzufügen
      </button>

      {/* EXERCISE SELECTOR MODAL */}
      {showExerciseSelector && (
        <ExerciseSelector 
          onSelect={handleExerciseSelect}
          onCancel={() => setShowExerciseSelector(false)}
        />
      )}

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