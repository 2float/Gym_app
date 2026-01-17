import { useState, useEffect } from 'react';
import { db } from '../db';

export default function ExerciseSelector({ onSelect, onCancel }) {
  const [exercises, setExercises] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Lädt Übungen aus Dexie (Offline-Ready!)
  useEffect(() => {
    const loadExercises = async () => {
      try {
        setLoading(true);
        const data = await db.ref_exercises.toArray();
        setExercises(data);
        if (data.length === 0) {
          setError('Keine Übungen verfügbar. Bitte erst synchronisieren.');
        }
      } catch (err) {
        console.error('Fehler beim Laden der Übungen:', err);
        setError('Fehler beim Laden der Übungen.');
      } finally {
        setLoading(false);
      }
    };
    loadExercises();
  }, []);

  // Filter-Logik
  const filtered = exercises.filter(ex => 
    ex.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ex.category && ex.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-4">Übung hinzufügen</h3>
        
        <input 
          type="text" 
          placeholder="Suchen..." 
          className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded mb-4 text-gray-900 dark:text-white"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
          disabled={loading}
        />

        <div className="max-h-60 overflow-y-auto mb-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : error ? (
            <p className="text-red-500 text-center py-4">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-center py-4">Keine Übung gefunden.</p>
          ) : (
            filtered.map(ex => (
              <button 
                key={ex.id}
                onClick={() => onSelect(ex)}
                className="w-full text-left p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded flex justify-between items-start text-gray-900 dark:text-white"
              >
                <span className="font-medium">{ex.name}</span>
                <div className="flex flex-col items-end gap-1">
                  {ex.category && (
                    <span className="text-xs text-blue-600 dark:text-blue-400">{ex.category}</span>
                  )}
                  {ex.equipment_names && ex.equipment_names.length > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{ex.equipment_names.join(', ')}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        <button 
          onClick={onCancel}
          className="w-full py-3 bg-gray-200 dark:bg-gray-600 rounded text-gray-900 dark:text-white font-bold hover:bg-gray-300 dark:hover:bg-gray-500"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}