import React from 'react';

const ExerciseCard = ({ exercise, onUpdate, onDelete }) => {
  
  // Hilfsfunktion: Aktualisiert einen spezifischen Satz
  const handleSetUpdate = (setIndex, field, value) => {
    // 1. Tiefe Kopie der Sätze erstellen (WICHTIG für den Bugfix!)
    const updatedSets = exercise.sets.map((s, i) => 
      i === setIndex ? { ...s, [field]: value } : s
    );
    
    // 2. Das gesamte Übungsobjekt aktualisieren und nach oben melden
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
    // Kopiere Werte vom letzten Satz als Vorschlag, aber erstelle NEUES Objekt
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
      {/* HEADER */}
      <div className="bg-gray-50 p-4 border-b border-gray-100">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-lg text-gray-800">{exercise.name}</h3>
            
            {/* SMART HINT & EQUIPMENT INFO */}
            {exercise.targetDetails && (
              <div className="mt-1 flex flex-wrap gap-2">
                 {/* Progressions-Hinweis */}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    exercise.targetDetails.hint.includes("Steigerung") ? "bg-green-100 text-green-700" :
                    exercise.targetDetails.hint.includes("Halten") ? "bg-yellow-100 text-yellow-700" :
                    "bg-blue-100 text-blue-700"
                }`}>
                    {exercise.targetDetails.hint}
                </span>

                {/* Anzeige: Welches Gerät? (Wichtig für Kabelzug) */}
                {exercise.equipment_names && (
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                        🏗️ {exercise.equipment_names.join(" oder ")}
                    </span>
                )}
              </div>
            )}
             
             {/* Letzte Werte */}
             {exercise.targetDetails?.lastWeight !== "-" && (
                 <div className="text-xs text-gray-400 mt-1">
                    Last: {exercise.targetDetails.lastWeight}kg x {exercise.targetDetails.lastReps}
                 </div>
             )}
          </div>
          
          {/* Löschen Button (optional) */}
          {onDelete && (
            <button onClick={onDelete} className="text-gray-300 hover:text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* SETS TABLE */}
      <div className="p-4 space-y-3">
        {/* Labels */}
        <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 uppercase font-semibold text-center mb-1">
          <div className="col-span-1">#</div>
          <div className="col-span-4">kg</div>
          <div className="col-span-4">Reps</div>
          <div className="col-span-2"></div>{/* Checkbox */}
          <div className="col-span-1"></div>{/* Delete Set */}
        </div>

        {/* Rows */}
        {exercise.sets.map((set, i) => (
          <div key={i} className={`grid grid-cols-12 gap-2 items-center transition-opacity ${set.completed ? 'opacity-50' : ''}`}>
            
            {/* Index */}
            <div className="col-span-1 text-center font-bold text-gray-400">{i + 1}</div>
            
            {/* Weight Input */}
            <div className="col-span-4">
              <input 
                type="number" 
                placeholder="kg"
                value={set.weight}
                onChange={(e) => handleSetUpdate(i, 'weight', e.target.value)}
                className={`w-full p-2 text-center border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold
                    ${exercise.targetDetails ? 'bg-green-50 border-green-200 text-green-900' : 'bg-gray-50'}
                `}
              />
            </div>
            
            {/* Reps Input */}
            <div className="col-span-4">
              <input 
                type="number" 
                placeholder="Reps"
                value={set.reps}
                onChange={(e) => handleSetUpdate(i, 'reps', e.target.value)}
                className={`w-full p-2 text-center border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold
                     ${exercise.targetDetails ? 'bg-green-50 border-green-200 text-green-900' : 'bg-gray-50'}
                `}
              />
            </div>
            
            {/* Check Button */}
            <div className="col-span-2 flex justify-center">
              <button 
                onClick={() => toggleSetComplete(i)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  set.completed 
                    ? 'bg-green-500 text-white shadow-md transform scale-105' 
                    : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                }`}
              >
                {set.completed && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                )}
              </button>
            </div>

            {/* Delete Set Button (X) */}
            <div className="col-span-1 flex justify-center">
                <button onClick={() => removeSet(i)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
            </div>
          </div>
        ))}

        {/* Add Set Button */}
        <button 
            onClick={addSet}
            className="w-full py-2 mt-2 text-xs font-bold text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded dashed border border-transparent hover:border-blue-200 transition-all"
        >
            + SATZ
        </button>

        {/* FOOTER: RPE & Notes */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex gap-3">
             <div className="w-1/3">
                <label className="text-xs text-gray-400 font-semibold block mb-1">RPE (1-10)</label>
                <input 
                    type="number" 
                    max="10"
                    placeholder="-"
                    value={exercise.rpe || ''}
                    onChange={(e) => handleMetaUpdate('rpe', e.target.value)}
                    className="w-full p-2 text-center border rounded-lg bg-gray-50 text-sm"
                />
             </div>
             <div className="w-2/3">
                <label className="text-xs text-gray-400 font-semibold block mb-1">Notiz</label>
                <input 
                    type="text" 
                    placeholder="..."
                    value={exercise.note || ''}
                    onChange={(e) => handleMetaUpdate('note', e.target.value)}
                    className="w-full p-2 border rounded-lg bg-gray-50 text-sm"
                />
             </div>
        </div>

      </div>
    </div>
  );
};

export default ExerciseCard;