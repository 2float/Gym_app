/**
 * Smart Workout Progression Engine
 * Portiert aus Google Apps Script (trainingsplan_v2)
 */

// Hilfsfunktion: Rep-String parsen (z.B. "10;10;9" oder "10")
export const parseReps = (repsInput) => {
  if (!repsInput) return [];
  const s = String(repsInput);
  if (s.includes("/")) return s.split("/").map(r => parseInt(r.trim())).filter(r => !isNaN(r));
  if (s.includes(";")) return s.split(";").map(r => parseInt(r.trim())).filter(r => !isNaN(r));
  const n = parseInt(s);
  return isNaN(n) ? [] : [n];
};

// Hilfsfunktion: Gewicht-String parsen
export const parseWeights = (weightInput, sets) => {
    if (!weightInput) return Array(sets).fill(0);
    const s = String(weightInput).replace(",", "."); // Komma zu Punkt
    let weights = [];
    
    if (s.includes(";")) {
        weights = s.split(";").map(w => parseFloat(w.trim())).filter(w => !isNaN(w));
    } else {
        const val = parseFloat(s);
        weights = isNaN(val) ? [] : [val];
    }

    // Wenn nur ein Gewicht angegeben ist, gilt es für alle Sätze
    if (weights.length === 1 && sets > 1) {
        return Array(sets).fill(weights[0]);
    }
    return weights;
};

// Hilfsfunktion: Nächstes Gewicht finden
const getNextWeight = (currentWeight, availableWeights) => {
  if (!availableWeights || availableWeights.length === 0) return currentWeight + 1; // Fallback
  
  // Sortiere Gewichte aufsteigend
  const sorted = [...availableWeights].sort((a, b) => a - b);
  
  // Finde das nächsthöhere
  for (let w of sorted) {
    if (w > currentWeight) return w;
  }
  return currentWeight; // Schon Maximum erreicht
};

/**
 * BERECHNUNGS-KERN
 * * @param {Object} exerciseDef - Aus ref_exercises (min_reps, max_reps, etc.)
 * @param {Object} lastLogEntry - Letzter Eintrag aus workout_logs für diese Übung
 * @param {Array} availableWeights - Array mit Gewichten (z.B. [2, 4, 6...])
 * @param {Object} config - Global Config (rpe_ziel_min, rpe_ziel_max)
 */
export const calculateTarget = (exerciseDef, lastLogEntry, availableWeights, config) => {
  const targetSets = exerciseDef.default_sets || 3;
  const repMin = exerciseDef.min_reps || 8;
  const repMax = exerciseDef.max_reps || 12;
  const rpeZielMin = parseFloat(config?.rpe_ziel_min || 8);
  const rpeZielMax = parseFloat(config?.rpe_ziel_max || 9);

  // FALL 1: NEU (Kein Log vorhanden)
  if (!lastLogEntry) {
    const startWeight = availableWeights && availableWeights.length > 0 
        ? Math.min(...availableWeights) 
        : 0;
    
    return {
      weight: startWeight,
      reps: repMin,
      sets: targetSets,
      hint: "Neu",
      isCalculated: true
    };
  }

  // FALL 2: ANALYSE DES LETZTEN TRAININGS
  const lastReps = parseReps(lastLogEntry.reps); // Array [10, 10, 10]
  const lastWeights = parseWeights(lastLogEntry.weight, targetSets); // Array [20, 20, 20]
  const lastRPE = parseFloat(lastLogEntry.rpe || 0);

  // Statistiken
  const maxMovedWeight = Math.max(...lastWeights);
  const minMovedReps = Math.min(...lastReps); // Schlechtester Satz
  
  // Checks
  // War das Gewicht über alle Sätze gleich?
  const isWeightUniform = lastWeights.every(w => w === maxMovedWeight) && lastWeights.length >= targetSets;
  // Wurden überall die Max-Reps geschafft?
  const allMaxRepsHit = lastReps.every(r => r >= repMax);

  let result = {
      weight: maxMovedWeight,
      reps: repMin,
      sets: targetSets,
      hint: "",
      isCalculated: true
  };

  // --- ENTSCHEIDUNGS-BAUM ---

  if (isWeightUniform && allMaxRepsHit && lastRPE < rpeZielMax) {
      // 1. STEIGERUNG (RPE erlaubt es & Leistung war da)
      result.weight = getNextWeight(maxMovedWeight, availableWeights);
      result.reps = repMin;
      result.hint = "↑ Steigerung";
      
      if (lastRPE > 0 && lastRPE < rpeZielMin) {
          result.hint += " (Easy!)";
      }

  } else if (isWeightUniform && allMaxRepsHit && lastRPE >= rpeZielMax) {
      // 2. HALTEN (Leistung da, aber Limit erreicht)
      result.weight = maxMovedWeight;
      result.reps = repMax; // Versuchen zu bestätigen
      result.hint = `⚖️ Halten (RPE ${lastRPE})`;

  } else if (!isWeightUniform) {
      // 3. KONSOLIDIEREN (Gewichte waren durcheinander)
      result.weight = maxMovedWeight;
      // Versuche die Reps zu matchen, die mit diesem Gewicht geschafft wurden (fallback repMin)
      const index = lastWeights.indexOf(maxMovedWeight);
      result.reps = lastReps[index] || repMin;
      result.hint = "⚖️ Konsolidieren";

  } else {
      // 4. REPS STEIGERN (Micro-Loading)
      // Gewicht bleibt gleich, wir versuchen eine Rep mehr im schlechtesten Satz
      result.weight = maxMovedWeight;
      result.reps = Math.min(minMovedReps + 1, repMax);
      result.hint = "📈 Reps steigern";
  }

  return result;
};