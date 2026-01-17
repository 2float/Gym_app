import { useState, useEffect } from 'react';
import { db } from '../db';
import { supabase } from '../supabaseClient';
import { useApp } from '../contexts/AppContext';
import ExerciseEditor from '../components/ExerciseEditor';

export default function Exercises() {
  const { isOnline } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedExercise, setSelectedExercise] = useState(null); // Für Details-Modal
  const [editingExercise, setEditingExercise] = useState(null);
  const [showExerciseEditor, setShowExerciseEditor] = useState(false);

  // Übungen laden (Local First)
  useEffect(() => {
    const loadExercises = async () => {
      setLoading(true);
      try {
        // Zuerst lokal laden
        let data = await db.ref_exercises.toArray();
        
        // Falls leer und online, von Supabase laden
        if (data.length === 0 && isOnline) {
          const { data: remoteData, error } = await supabase
            .from('ref_exercises')
            .select('*')
            .order('name', { ascending: true });
          
          if (error) throw error;
          
          // In lokale DB speichern
          if (remoteData && remoteData.length > 0) {
            await db.ref_exercises.bulkPut(remoteData);
            data = remoteData;
          }
        }
        
        setExercises(data);
      } catch (error) {
        console.error("Fehler beim Laden der Übungen:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadExercises();
  }, [isOnline]);

  // Kategorien extrahieren
  const categories = ['all', ...new Set(exercises.map(ex => ex.category).filter(Boolean))];

  // Filtern
  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (ex.category && ex.category.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || ex.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Übungen</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {exercises.length} Übungen verfügbar
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Übung oder Muskelgruppe suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 pl-10 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 text-gray-900 dark:text-gray-100"
          />
          <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                selectedCategory === category
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {category === 'all' ? 'Alle' : category}
            </button>
          ))}
        </div>

        {/* Create Button */}
        <button
          onClick={() => {
            setEditingExercise(null);
            setShowExerciseEditor(true);
          }}
          disabled={!isOnline}
          className={`mt-4 w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
            isOnline
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-400 text-gray-200 cursor-not-allowed'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neue Übung erstellen {!isOnline && '(Offline)'}
        </button>
      </div>

      {/* Exercise List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-xl shadow-sm text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
          <div className="inline-block p-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
            <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">Keine Übungen gefunden</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
            {searchQuery ? 'Versuche eine andere Suche' : 'Noch keine Übungen vorhanden'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredExercises.map((exercise) => (
            <div 
              key={exercise.id}
              onClick={() => setSelectedExercise(exercise)}
              className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 hover:border-green-200 dark:hover:border-green-500 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                    {exercise.name}
                  </h3>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {exercise.category && (
                      <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-md font-medium">
                        {exercise.category}
                      </span>
                    )}
                    {exercise.equipment_names && exercise.equipment_names.length > 0 && (
                      <span className="text-xs bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-md font-medium">
                        {exercise.equipment_names.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedExercise && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={() => setSelectedExercise(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedExercise.name}</h3>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {selectedExercise.category && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-md font-semibold">
                        {selectedExercise.category}
                      </span>
                    )}
                    {selectedExercise.equipment_names && selectedExercise.equipment_names.length > 0 && (
                      <span className="text-xs bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-md font-semibold">
                        {selectedExercise.equipment_names.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedExercise(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {selectedExercise.default_sets && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Standard Sätze</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedExercise.default_sets}</p>
                  </div>
                )}
                {selectedExercise.min_reps && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Min Reps</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedExercise.min_reps}</p>
                  </div>
                )}
                {selectedExercise.max_reps && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Max Reps</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedExercise.max_reps}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => setSelectedExercise(null)}
                className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-semibold transition-colors"
              >
                Schließen
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Übung "${selectedExercise.name}" wirklich löschen?`)) return;
                  
                  try {
                    // Lösche aus Supabase
                    const { error } = await supabase
                      .from('ref_exercises')
                      .delete()
                      .eq('id', selectedExercise.id);
                    
                    if (error) throw error;
                    
                    // Lösche lokal
                    await db.ref_exercises.delete(selectedExercise.id);
                    
                    // UI aktualisieren
                    setExercises(exercises.filter(ex => ex.id !== selectedExercise.id));
                    setSelectedExercise(null);
                  } catch (err) {
                    console.error('Fehler beim Löschen:', err);
                    alert('Fehler beim Löschen: ' + err.message);
                  }
                }}
                disabled={!isOnline}
                className={`py-3 px-4 rounded-lg font-semibold transition-colors ${
                  isOnline
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                }`}
              >
                Löschen
              </button>
              <button
                onClick={() => {
                  setEditingExercise(selectedExercise);
                  setShowExerciseEditor(true);
                }}
                disabled={!isOnline}
                className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                  isOnline
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                }`}
              >
                Bearbeiten {!isOnline && '(Offline)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Editor Modal */}
      {showExerciseEditor && (
        <ExerciseEditor
          exercise={editingExercise}
          onSave={async () => {
            setShowExerciseEditor(false);
            setEditingExercise(null);
            setSelectedExercise(null);
            // Übungen neu laden
            setLoading(true);
            let data = await db.ref_exercises.toArray();
            if (isOnline) {
              const { data: supabaseData } = await supabase.from('ref_exercises').select('*');
              if (supabaseData) {
                await db.ref_exercises.clear();
                await db.ref_exercises.bulkAdd(supabaseData);
                data = supabaseData;
              }
            }
            setExercises(data);
            setLoading(false);
          }}
          onCancel={() => {
            setShowExerciseEditor(false);
            setEditingExercise(null);
          }}
        />
      )}
    </div>
  );
}
