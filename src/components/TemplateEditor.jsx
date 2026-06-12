import { useState, useEffect } from 'react';
import { db } from '../db';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export default function TemplateEditor({ template, onSave, onCancel }) {
  const { user } = useAuth();
  const [name, setName] = useState(template?.name || '');
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [availableExercises, setAvailableExercises] = useState([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Template-Übungen laden (falls Bearbeitung)
  useEffect(() => {
    const loadData = async () => {
      // Verfügbare Übungen laden
      const exercises = await db.ref_exercises.toArray();
      setAvailableExercises(exercises);

      // Falls Template bearbeitet wird, Übungen laden
      if (template?.id) {
        const { data } = await supabase
          .from('ref_routines')
          .select('*, ref_routine_exercises(sort_order, exercise_id, ref_exercises(*))')
          .eq('id', template.id)
          .single();

        if (data?.ref_routine_exercises) {
          const exercises = data.ref_routine_exercises
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(link => link.ref_exercises)
            .filter(ex => ex !== null);
          setSelectedExercises(exercises);
        }
      }
    };
    loadData();
  }, [template]);

  const addExercise = (exercise) => {
    if (!selectedExercises.find(ex => ex.id === exercise.id)) {
      setSelectedExercises([...selectedExercises, exercise]);
    }
    setShowExercisePicker(false);
    setSearchQuery('');
  };

  const removeExercise = (exerciseId) => {
    setSelectedExercises(selectedExercises.filter(ex => ex.id !== exerciseId));
  };

  const moveExercise = (index, direction) => {
    const newList = [...selectedExercises];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < newList.length) {
      [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
      setSelectedExercises(newList);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Bitte gib einen Namen ein');
      return;
    }
    if (selectedExercises.length === 0) {
      alert('Bitte wähle mindestens eine Übung');
      return;
    }

    setSaving(true);
    try {
      let routineId;

      if (template?.id) {
        // UPDATE
        await supabase
          .from('ref_routines')
          .update({ name: name.trim() })
          .eq('id', template.id);
        
        // Lösche alte Übungen
        await supabase
          .from('ref_routine_exercises')
          .delete()
          .eq('routine_id', template.id);
        
        routineId = template.id;
      } else {
        // CREATE
        const { data, error } = await supabase
          .from('ref_routines')
          .insert({
            name: name.trim(),
            sort_order: 999,
            user_id: user.id
          })
          .select()
          .single();

        if (error) throw error;
        routineId = data.id;
      }

      // Füge Übungen hinzu
      const exerciseLinks = selectedExercises.map((ex, index) => ({
        routine_id: routineId,
        exercise_id: ex.id,
        sort_order: index
      }));

      await supabase
        .from('ref_routine_exercises')
        .insert(exerciseLinks);

      // Auch lokal speichern
      await db.ref_routines.put({
        id: routineId,
        name: name.trim(),
        sort_order: template?.sort_order || 999
      });

      await db.ref_routine_exercises.bulkPut(
        exerciseLinks.map((link, i) => ({ ...link, id: `${routineId}_${i}` }))
      );

      onSave();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredAvailableExercises = availableExercises.filter(ex =>
    !selectedExercises.find(sel => sel.id === ex.id) &&
    ex.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 z-10">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {template ? 'Template bearbeiten' : 'Neues Template erstellen'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Erstelle deine Workout-Vorlage
              </p>
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Template-Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Push Day"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Übungen */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Übungen ({selectedExercises.length})
              </label>
              <button
                onClick={() => setShowExercisePicker(true)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                + Übung hinzufügen
              </button>
            </div>

            {selectedExercises.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <p>Noch keine Übungen ausgewählt</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedExercises.map((exercise, index) => (
                  <div key={exercise.id} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveExercise(index, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveExercise(index, 'down')}
                        disabled={index === selectedExercises.length - 1}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">{exercise.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{exercise.muscle_group}</p>
                    </div>
                    <button
                      onClick={() => removeExercise(exercise.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-semibold transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
        </div>

        {/* Exercise Picker Modal */}
        {showExercisePicker && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 rounded-2xl" onClick={() => setShowExercisePicker(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Übung hinzufügen</h4>
              
              <input
                type="text"
                placeholder="Suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 mb-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                autoFocus
              />

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filteredAvailableExercises.map(exercise => (
                  <button
                    key={exercise.id}
                    onClick={() => addExercise(exercise)}
                    className="w-full text-left p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{exercise.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{exercise.muscle_group}</div>
                  </button>
                ))}
                {filteredAvailableExercises.length === 0 && (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-4">Keine Übungen gefunden</p>
                )}
              </div>

              <button
                onClick={() => setShowExercisePicker(false)}
                className="w-full mt-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-semibold transition-colors"
              >
                Schließen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
