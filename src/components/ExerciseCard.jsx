import React from 'react';

const stepWeight = (current, availableWeights, direction) => {
  const sorted = availableWeights && availableWeights.length > 0
    ? [...availableWeights].map(Number).sort((a, b) => a - b)
    : null;
  if (!sorted) {
    const next = current + direction * 2.5;
    return next >= 0 ? next : 0;
  }
  if (direction > 0) {
    return sorted.find(w => w > current) ?? sorted[sorted.length - 1];
  } else {
    return [...sorted].reverse().find(w => w < current) ?? sorted[0];
  }
};

const ExerciseCard = ({ exercise, onUpdate, onDelete, onMoveUp, onMoveDown, isExpanded, onToggleExpand }) => {

  // Hilfsfunktion: Aktualisiert einen spezifischen Satz
  const handleSetUpdate = (setIndex, field, value) => {
    const updatedSets = exercise.sets.map((s, i) => 
      i === setIndex ? { ...s, [field]: value } : s
    );
    onUpdate({ ...exercise, sets: updatedSets });
  };

  // Hilfsfunktion: Satzstatus toggeln (Completed)
  const toggleSetComplete = (setIndex) => {
    const updatedSets = exercise.sets.map((s, i) => 
      i === setIndex ? { ...s, completed: !s.completed } : s
    );
    onUpdate({ ...exercise, sets: updatedSets });
  };

  // Hilfsfunktion: Neuen Satz hinzufügen
  const addSet = () => {
    const lastSet = exercise.sets[exercise.sets.length - 1];
    const newSet = {
      weight: lastSet ? lastSet.weight : '',
      reps: lastSet ? lastSet.reps : '',
      completed: false
    };
    onUpdate({ ...exercise, sets: [...exercise.sets, newSet] });
  };

  // Hilfsfunktion: Satz löschen
  const removeSet = (setIndex) => {
    const updatedSets = exercise.sets.filter((_, i) => i !== setIndex);
    onUpdate({ ...exercise, sets: updatedSets });
  };

  // RPE und Notizen Updates
  const handleMetaUpdate = (field, value) => {
    onUpdate({ ...exercise, [field]: value });
  };

  // Berechne Fortschritt
  const completedSets = exercise.sets.filter(s => s.completed).length;
  const totalSets = exercise.sets.length;
  const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  // Berechne Set-Info für collapsed view
  const getSetSummary = () => {
    const completed = exercise.sets.filter(s => s.completed);
    if (completed.length === 0) return null;

    // Prüfe ob alle Sätze identisch sind
    const first = completed[0];
    const allSame = completed.every(s => s.weight === first.weight && s.reps === first.reps);

    if (allSame) {
      return `all: ${first.weight}kg x ${first.reps}`;
    } else {
      // Finde schwersten Satz, bei Gleichstand den mit wenigsten Reps
      const heaviest = completed.reduce((max, set) => {
        const maxWeight = parseFloat(max.weight) || 0;
        const setWeight = parseFloat(set.weight) || 0;
        if (setWeight > maxWeight) return set;
        if (setWeight === maxWeight && (parseInt(set.reps) || 0) < (parseInt(max.reps) || 0)) return set;
        return max;
      });
      return `top: ${heaviest.weight}kg x ${heaviest.reps}`;
    }
  };

  const setSummary = getSetSummary();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
      <div 
        className={`p-4 border-b cursor-pointer transition-colors ${
          isExpanded ? 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
        }`}
        onClick={onToggleExpand}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{exercise.name}</h3>
              {!isExpanded && (
                <>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                    {completedSets}/{totalSets}
                  </span>
                  {/* Set Summary */}
                  {setSummary && (
                    <span className="text-xs text-gray-500 dark:text-gray-600 font-medium">
                      {setSummary}
                    </span>
                  )}
                  {/* RPE Badge im zusammengeklappten Zustand */}
                  {exercise.rpe && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      parseInt(exercise.rpe) >= 9 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                      parseInt(exercise.rpe) >= 7 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    }`}>
                      RPE {exercise.rpe}
                    </span>
                  )}
                </>
              )}
              <svg 
                className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            
            {!isExpanded && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {progress === 100 && <span className="text-green-500">✓</span>}
              </div>
            )}
            
            {isExpanded && exercise.targetDetails && (
              <div className="mt-1 flex flex-wrap gap-2">
                {exercise.targetDetails.hint && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      exercise.targetDetails.hint.includes("Steigerung") ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" :
                      exercise.targetDetails.hint.includes("Halten") ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" :
                      "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  }`}>
                      {exercise.targetDetails.hint}
                  </span>
                )}

                {exercise.equipment_names && (
                    <span className="text-xs text-gray-600 dark:text-gray-500 bg-gray-100 dark:bg-gray-200 px-2 py-0.5 rounded-full">
                        🏗️ {exercise.equipment_names.join(" oder ")}
                    </span>
                )}
              </div>
            )}
             
             {isExpanded && exercise.targetDetails?.lastWeight && exercise.targetDetails.lastWeight !== "-" && (
                 <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Last: {exercise.targetDetails.lastWeight}kg x {exercise.targetDetails.lastReps}
                 </div>
             )}
          </div>
          
          {isExpanded && (
            <div className="flex items-center gap-1">
              {onMoveUp && (
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                  className="text-gray-400 dark:text-gray-500 hover:text-blue-500 p-1"
                  title="Nach oben"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
              )}
              {onMoveDown && (
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                  className="text-gray-400 dark:text-gray-500 hover:text-blue-500 p-1"
                  title="Nach unten"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }} 
                  className="text-gray-600 dark:text-gray-300 hover:text-red-500 p-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-2 text-xs text-gray-600 dark:text-gray-400 uppercase font-semibold text-center mb-1">
          <div>#</div>
          <div>kg</div>
          <div>Reps</div>
          <div></div>
          <div></div>
        </div>

        {exercise.sets.map((set, i) => (
          <div key={i} className={`grid grid-cols-[auto_1fr_1fr_auto_auto] gap-2 items-center transition-opacity ${set.completed ? 'opacity-50' : ''}`}>
            <div className="text-center font-bold text-gray-600 dark:text-gray-400">{i + 1}</div>
            
            {/* Gewicht Gruppe */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 max-w-[140px]">
              <button
                type="button"
                onClick={() => {
                  const currentWeight = parseFloat(set.weight) || 0;
                  handleSetUpdate(i, 'weight', String(stepWeight(currentWeight, exercise.availableWeights, -1)));
                }}
                className="w-7 h-8 flex items-center justify-center bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded text-gray-700 dark:text-gray-200 font-bold text-lg transition-colors active:scale-95"
              >
                −
              </button>
              <input
                type="text"
                inputMode="decimal"
                placeholder="kg"
                value={set.weight}
                onChange={(e) => handleSetUpdate(i, 'weight', e.target.value)}
                className={`flex-1 min-w-0 p-1.5 text-center border rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm text-gray-900 dark:text-gray-100
                    ${exercise.targetDetails ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-500'}
                    `}
              />
              <button
                type="button"
                onClick={() => {
                  const currentWeight = parseFloat(set.weight) || 0;
                  handleSetUpdate(i, 'weight', String(stepWeight(currentWeight, exercise.availableWeights, 1)));
                }}
                className="w-7 h-8 flex items-center justify-center bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded text-gray-700 dark:text-gray-200 font-bold text-lg transition-colors active:scale-95"
              >
                +
              </button>
            </div>
            
            {/* Reps Gruppe */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 max-w-[120px]">
              <button
                type="button"
                onClick={() => {
                  const currentReps = parseInt(set.reps) || 0;
                  if (currentReps > 0) {
                    handleSetUpdate(i, 'reps', String(currentReps - 1));
                  }
                }}
                className="w-7 h-8 flex items-center justify-center bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded text-gray-700 dark:text-gray-200 font-bold text-lg transition-colors active:scale-95"
              >
                −
              </button>
              <input 
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Reps"
                value={set.reps}
                onChange={(e) => handleSetUpdate(i, 'reps', e.target.value)}
                className={`flex-1 min-w-0 p-1.5 text-center border rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm text-gray-900 dark:text-gray-100
                    ${exercise.targetDetails ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-500'}
                    `}
              />
              <button
                type="button"
                onClick={() => {
                  const currentReps = parseInt(set.reps) || 0;
                  handleSetUpdate(i, 'reps', String(currentReps + 1));
                }}
                className="w-7 h-8 flex items-center justify-center bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded text-gray-700 dark:text-gray-200 font-bold text-lg transition-colors active:scale-95"
              >
                +
              </button>
            </div>
            
            <div className="flex justify-center">
              <button 
                onClick={() => toggleSetComplete(i)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  set.completed 
                    ? 'bg-green-500 text-white shadow-md transform scale-105' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {set.completed && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                )}
              </button>
            </div>

            <div className="flex justify-center">
              <button onClick={() => removeSet(i)} className="text-gray-400 dark:text-gray-300 hover:text-red-400 text-xs">✕</button>
            </div>
          </div>
        ))}

        <button 
            onClick={addSet}
            className="w-full py-2 mt-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded dashed border border-transparent hover:border-blue-200 dark:hover:border-blue-700 transition-all"
        >
            + SATZ
        </button>

        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
             <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 font-semibold block mb-2">RPE (Anstrengung 1-10)</label>
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map(value => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleMetaUpdate('rpe', value.toString())}
                        className={`flex-1 py-2 rounded-lg font-semibold text-xs transition-all ${
                          exercise.rpe === value.toString()
                            ? 'bg-blue-500 text-white shadow-md'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    {[6, 7, 8, 9, 10].map(value => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleMetaUpdate('rpe', value.toString())}
                        className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${
                          exercise.rpe === value.toString()
                            ? 'bg-blue-500 text-white shadow-md scale-105'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
             </div>
             <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 font-semibold block mb-1">Notiz</label>
                <input 
                    type="text" 
                    placeholder="Optional: Bemerkungen zum Satz..."
                    value={exercise.note || ''}
                    onChange={(e) => handleMetaUpdate('note', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                />
             </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default ExerciseCard;
