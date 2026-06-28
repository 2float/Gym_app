import React, { useState, useEffect, useRef } from 'react';
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
  const [savingPhase, setSavingPhase] = useState(null); // 'local' | 'cloud'
  const skipSyncRef = useRef(false);
  const mountedRef = useRef(true);
  const [expandedExerciseIndex, setExpandedExerciseIndex] = useState(0); // Erste Übung ist standardmäßig offen

  const isOnline = useOnlineStatus();
  const { refreshHistory } = useApp();

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Scroll to top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // --- ACTIONS ---

  // Update einer einzelnen Übung in der Liste (wird von ExerciseCard aufgerufen)
  const handleExerciseUpdate = (index, updatedExercise) => {
    const oldExercise = exercises[index];
    const newExercises = [...exercises];
    newExercises[index] = updatedExercise;
    setExercises(newExercises);

    // Auto-Collapse nur wenn Übung GERADE JETZT fertig wurde
    const wasComplete = oldExercise.sets.every(s => s.completed) && oldExercise.rpe;
    const isNowComplete = updatedExercise.sets.every(s => s.completed) && updatedExercise.rpe;
    
    if (!wasComplete && isNowComplete && expandedExerciseIndex === index) {
      // Übung wurde gerade fertiggestellt → Auto-Collapse
      const nextIndex = index + 1;
      if (nextIndex < exercises.length) {
        setTimeout(() => setExpandedExerciseIndex(nextIndex), 300);
      } else {
        setTimeout(() => setExpandedExerciseIndex(null), 300);
      }
    }
  };

  // Übung löschen
  const handleDeleteExercise = (index) => {
    if (confirm('Übung wirklich entfernen?')) {
        const newExercises = exercises.filter((_, i) => i !== index);
        setExercises(newExercises);
    }
  };

  // Übung verschieben
  const handleMoveExercise = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= exercises.length) return;
    const newExercises = [...exercises];
    [newExercises[index], newExercises[newIndex]] = [newExercises[newIndex], newExercises[index]];
    setExercises(newExercises);
    setExpandedExerciseIndex(newIndex);
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

    // Füge Übung mit Defaults hinzu (nur echte DB-Felder)
    setExercises([...exercises, { 
      name: selectedExercise.name,
      category: selectedExercise.category,
      equipment_names: selectedExercise.equipment_names,
      default_sets: selectedExercise.default_sets,
      min_reps: selectedExercise.min_reps,
      max_reps: selectedExercise.max_reps,
      sets: [{ 
        weight: lastWeight, // Pre-fill mit letztem Gewicht
        reps: lastReps,     // Pre-fill mit letzten Reps
        completed: false 
      }],
      targetDetails // Zeigt "Last: X kg x Y" an
    }]);
    setShowExerciseSelector(false);
    
    // Öffne die neu hinzugefügte Übung automatisch
    setExpandedExerciseIndex(exercises.length);
  };

  // Workout speichern
  const finishWorkout = async () => {
    // 0. BESTÄTIGUNG
    if (!confirm('✅ Training jetzt beenden und speichern?')) {
      return; // Abbruch wenn User "Nein" klickt
    }

    // 1. VALIDIERUNG: Check auf fehlende RPE bei erledigten Sätzen
    const missingRpe = exercises.some(ex => 
        ex.sets.some(s => s.completed) && (!ex.rpe || ex.rpe.trim() === "")
    );

    if (missingRpe) {
        alert("⚠️ Bitte trage für alle Übungen mit erledigten Sätzen eine RPE ein (1-10)!");
        return; // Abbruch
    }

    setIsFinishing(true);
    skipSyncRef.current = false;
    setSavingPhase('local');
    const endTime = new Date();
    const durationMs = endTime - startTime;

    // 2. DATEN AUFBEREITEN
    const validExercises = exercises
        .map(ex => ({
            ...ex,
            sets: ex.sets.filter(s => s.completed)
        }))
        .filter(ex => ex.sets.length > 0);

    if (validExercises.length === 0) {
        alert("Keine Sätze abgeschlossen. Training wird nicht gespeichert.");
        setIsFinishing(false);
        setSavingPhase(null);
        return;
    }

    const logEntryLocal = {
      date: endTime.toISOString(),
      workoutName,
      duration_ms: durationMs,
      exercises: validExercises.map(ex => ({
        name: ex.name,
        sets: ex.sets.length,
        reps: ex.sets.map(s => s.reps).join(';'),
        weight: ex.sets.map(s => s.weight).join(';'),
        rpe: ex.rpe || "",
        note: ex.note || "",
        execution: ex.execution || 'normal'
      })),
      synced: false
    };

    let localId;
    try {
      // 3. DEXIE SAVE (Lokal) — instant
      localId = await db.workout_logs.add(logEntryLocal);
      console.log("✅ Locally saved ID:", localId);
    } catch (err) {
      console.error("Local save failed:", err);
      alert("Fehler beim lokalen Speichern! Bitte Screenshot machen.");
      setIsFinishing(false);
      setSavingPhase(null);
      return;
    }

    // 4. CLOUD SYNC — User kann jederzeit überspringen
    setSavingPhase('cloud');

    if (isOnline && !skipSyncRef.current) {
      const localTime = new Date(endTime);
      const pad = n => String(n).padStart(2, '0');
      const naiveTimestamp = `${localTime.getFullYear()}-${pad(localTime.getMonth()+1)}-${pad(localTime.getDate())}T${pad(localTime.getHours())}:${pad(localTime.getMinutes())}:${pad(localTime.getSeconds())}Z`;

      const supabasePayload = {
        date: naiveTimestamp,
        workout_name: logEntryLocal.workoutName,
        duration_ms: logEntryLocal.duration_ms,
        exercises: logEntryLocal.exercises,
        user_id: user.id
      };

      try {
        const withTimeout = (promise, ms) => Promise.race([
          promise,
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
        ]);

        // Deduplizierung (max 5s)
        const dateMinute = naiveTimestamp.substring(0, 16);
        const { data: existing } = await withTimeout(
          supabase.from('workout_logs').select('id')
            .eq('user_id', user.id)
            .eq('workout_name', supabasePayload.workout_name)
            .gte('date', `${dateMinute}:00Z`)
            .lt('date', `${dateMinute}:59Z`)
            .limit(1),
          5000
        );

        if (existing && existing.length > 0) {
          console.log(`⏭️ Duplicate in Supabase, skip insert`);
          await db.workout_logs.update(localId, { synced: true });
        } else if (!skipSyncRef.current) {
          // Insert (max 5s)
          const { error } = await withTimeout(
            supabase.from('workout_logs').insert([supabasePayload]),
            5000
          );
          if (!error) {
            await db.workout_logs.update(localId, { synced: true });
            console.log("☁️ Synced to Supabase!");
          } else {
            console.error("❌ Supabase Upload Error:", error);
          }
        }
      } catch (syncErr) {
        console.warn("⚠️ Cloud sync übersprungen (offline/timeout):", syncErr.message);
      }
    }

    // Abgebrochen via "Sync überspringen" — onFinish wurde bereits aufgerufen
    if (!mountedRef.current) return;

    await refreshHistory();
    onFinish();
  };

  const handleSkipSync = () => {
    skipSyncRef.current = true;
    onFinish(); // sofort zurück, Sync läuft ggf. noch kurz im Hintergrund
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
      <div className="flex flex-col items-center justify-center h-64 space-y-4 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
        {savingPhase === 'local' && (
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Speichere Gains...</h2>
        )}
        {savingPhase === 'cloud' && (
          <>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Synchronisiere mit Cloud...</h2>
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">Training lokal gespeichert ✓</p>
            <button
              onClick={handleSkipSync}
              className="mt-2 px-5 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Sync überspringen →
            </button>
            <p className="text-xs text-gray-400 dark:text-gray-500">Wird beim nächsten Sync nachgeholt</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* HEADER */}
      <div className="flex justify-between items-end border-b border-gray-200 dark:border-gray-700 pb-4 bg-white/90 dark:bg-gray-900/90 sticky top-0 backdrop-blur-md z-10 p-2 -mx-2">
        <button 
          onClick={handleCancel}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-600 transition-colors"
          title="Zurück zum Hauptmenü"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 mx-4">
          <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-300">{workoutName}</h2>
          <p className="text-gray-600 dark:text-gray-500 text-xs uppercase tracking-wide">
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
              onMoveUp={index > 0 ? () => handleMoveExercise(index, -1) : null}
              onMoveDown={index < exercises.length - 1 ? () => handleMoveExercise(index, 1) : null}
              isExpanded={expandedExerciseIndex === index}
              onToggleExpand={() => setExpandedExerciseIndex(expandedExerciseIndex === index ? null : index)}
          />
        </ErrorBoundary>
      ))}

      {/* ADD EXERCISE BUTTON */}
      <button 
        onClick={() => setShowExerciseSelector(true)}
        className="w-full bg-gray-100 dark:bg-gray-800 p-4 rounded-xl shadow-sm text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 transition-all"
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
      <div className="mt-8 mb-4">
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