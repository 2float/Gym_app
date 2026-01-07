import { useState, useEffect } from 'react';
import { getAvailableRoutines } from '../services/smartWorkoutService';

export default function RoutineSelector({ onSelectSmart, onSelectSpecific, onCancel, isLoading }) {
  const [routines, setRoutines] = useState([]);
  const [loadingRoutines, setLoadingRoutines] = useState(true);

  useEffect(() => {
    const loadRoutines = async () => {
      try {
        const data = await getAvailableRoutines();
        setRoutines(data);
      } catch (error) {
        console.error("Fehler beim Laden der Routinen:", error);
      } finally {
        setLoadingRoutines(false);
      }
    };
    loadRoutines();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-2xl font-bold text-gray-900">Workout wählen</h3>
          <p className="text-sm text-gray-600 mt-1">Lass die App entscheiden oder wähle selbst</p>
        </div>

        {/* Smart Option */}
        <div className="p-4 border-b border-gray-100">
          <button 
            onClick={onSelectSmart}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white p-4 rounded-xl font-bold text-lg shadow-lg hover:from-blue-700 hover:to-blue-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧠</span>
              <div className="text-left">
                <div>Smart Recommendation</div>
                <div className="text-xs text-blue-100 font-normal">KI wählt basierend auf Historie</div>
              </div>
            </div>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Manual Options */}
        <div className="p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Oder manuell wählen</p>
          
          {loadingRoutines ? (
            <div className="text-center py-8 text-gray-400">Lade Routinen...</div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {routines.map(routine => (
                <button
                  key={routine.id}
                  onClick={() => onSelectSpecific(routine.name)}
                  disabled={isLoading}
                  className="w-full text-left p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="font-semibold text-gray-900">{routine.name}</div>
                  {routine.description && (
                    <div className="text-xs text-gray-500 mt-1">{routine.description}</div>
                  )}
                </button>
              ))}
              {routines.length === 0 && (
                <p className="text-center text-gray-500 py-4 text-sm">Keine Routinen verfügbar</p>
              )}
            </div>
          )}
        </div>

        {/* Cancel Button */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="w-full py-3 text-gray-600 font-semibold hover:bg-gray-50 rounded-lg transition-all disabled:opacity-50"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
