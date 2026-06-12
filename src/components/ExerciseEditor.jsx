import { useState, useEffect } from 'react';
import { db } from '../db';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export default function ExerciseEditor({ exercise, onSave, onCancel }) {
  const { user } = useAuth();
  const [name, setName] = useState(exercise?.name || '');
  const [category, setCategory] = useState(exercise?.category || 'compound');
  const [defaultSets, setDefaultSets] = useState(exercise?.default_sets || 3);
  const [minReps, setMinReps] = useState(exercise?.min_reps || 8);
  const [maxReps, setMaxReps] = useState(exercise?.max_reps || 12);
  const [equipmentNames, setEquipmentNames] = useState(exercise?.equipment_names || []);
  const [equipmentOptions, setEquipmentOptions] = useState([]);
  const [saving, setSaving] = useState(false);

  // WICHTIG: Nur diese beiden Kategorien sind in der DB erlaubt!
  const categories = ['compound', 'isolation'];

  // Equipment-Optionen aus der DB laden
  useEffect(() => {
    const loadEquipment = async () => {
      const equipment = await db.ref_equipment.toArray();
      setEquipmentOptions(equipment.map(eq => eq.name).sort());
    };
    loadEquipment();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Bitte gib einen Namen ein');
      return;
    }

    setSaving(true);
    try {
      const exerciseData = {
        name: name.trim(),
        category: category || 'compound',
        default_sets: parseInt(defaultSets) || 3,
        min_reps: parseInt(minReps) || 8,
        max_reps: parseInt(maxReps) || 12,
        equipment_names: equipmentNames
      };

      if (exercise?.id) {
        // UPDATE
        const { error: updateError } = await supabase
          .from('ref_exercises')
          .update(exerciseData)
          .eq('id', exercise.id);

        if (updateError) throw updateError;

        // Lokal aktualisieren
        await db.ref_exercises.update(exercise.id, exerciseData);
      } else {
        // CREATE — immer user-owned
        const { data, error } = await supabase
          .from('ref_exercises')
          .insert({ ...exerciseData, user_id: user.id })
          .select()
          .single();

        if (error) throw error;

        // Lokal speichern
        await db.ref_exercises.add({ ...exerciseData, id: data.id });
      }

      onSave();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 z-10">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {exercise ? 'Übung bearbeiten' : 'Neue Übung erstellen'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Definiere deine Übung
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
        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Übungsname *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Bankdrücken"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Kategorie *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
              required
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Default Sets */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Standard-Anzahl Sätze
            </label>
            <input
              type="number"
              value={defaultSets}
              onChange={(e) => setDefaultSets(e.target.value)}
              min="1"
              max="10"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Equipment (Multi-Select) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Equipment (mehrfach wählbar)
            </label>
            <div className="flex flex-wrap gap-2">
              {equipmentOptions.map(eq => (
                <button
                  key={eq}
                  type="button"
                  onClick={() => {
                    if (equipmentNames.includes(eq)) {
                      setEquipmentNames(equipmentNames.filter(e => e !== eq));
                    } else {
                      setEquipmentNames([...equipmentNames, eq]);
                    }
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    equipmentNames.includes(eq)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {eq}
                </button>
              ))}
            </div>
          </div>

          {/* Rep Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Min. Wiederholungen
              </label>
              <input
                type="number"
                value={minReps}
                onChange={(e) => setMinReps(e.target.value)}
                min="1"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Max. Wiederholungen
              </label>
              <input
                type="number"
                value={maxReps}
                onChange={(e) => setMaxReps(e.target.value)}
                min="1"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
              />
            </div>
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
      </div>
    </div>
  );
}
