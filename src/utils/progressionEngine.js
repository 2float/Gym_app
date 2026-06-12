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

// Nächstes verfügbares Gewicht nahe einem Zielwert finden (closest)
const getNearestWeight = (target, availableWeights) => {
  if (!availableWeights || availableWeights.length === 0) return target;
  const sorted = [...availableWeights].map(Number).sort((a, b) => a - b);
  return sorted.reduce((prev, curr) =>
    Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
  );
};

/**
 * BERECHNUNGS-KERN
 * @param {Object} exerciseDef - Aus ref_exercises (min_reps, max_reps, etc.)
 * @param {Object} lastLogEntry - Letzter Eintrag aus workout_logs für diese Übung
 * @param {Array} availableWeights - Array mit Gewichten (z.B. [2, 4, 6...])
 * @param {Object} config - Config inkl. progressionType, rpeTargetMin/Max, weightOffsetPct
 */
export const calculateTarget = (exerciseDef, lastLogEntry, availableWeights, config) => {
  const targetSets = exerciseDef.default_sets || 3;
  const repMin = exerciseDef.min_reps || 8;
  const repMax = exerciseDef.max_reps || 12;
  const rpeZielMin = parseFloat(config?.rpeTargetMin ?? config?.rpe_ziel_min ?? 8);
  const rpeZielMax = parseFloat(config?.rpeTargetMax ?? config?.rpe_ziel_max ?? 9);
  const progressionType = config?.progressionType || 'hypertrophy';
  const weightOffsetPct = config?.weightOffsetPct ?? 0;

  const sorted = availableWeights && availableWeights.length > 0
    ? [...availableWeights].map(Number).sort((a, b) => a - b)
    : null;
  const minWeight = sorted ? sorted[0] : 0;
  const maxWeight = sorted ? sorted[sorted.length - 1] : 0;

  // ── EXPLOSIVE ────────────────────────────────────────────────────────────
  if (progressionType === 'explosive') {
    if (!lastLogEntry) {
      const targetWeight = maxWeight * (1 + weightOffsetPct / 100);
      return {
        weight: sorted ? getNearestWeight(targetWeight, sorted) : targetWeight,
        reps: repMin,
        sets: targetSets,
        hint: "⚡ Explosiv",
        isCalculated: true,
      };
    }
    const lastWeights = parseWeights(lastLogEntry.weight, targetSets);
    return {
      weight: Math.max(...lastWeights),
      reps: repMin,
      sets: targetSets,
      hint: "⚡ Konzentrisch MAXIMAL EXPLOSIV – Gewicht halten",
      isCalculated: true,
    };
  }

  // ── CORRECTIVE ───────────────────────────────────────────────────────────
  if (progressionType === 'corrective') {
    if (!lastLogEntry) {
      return { weight: minWeight, reps: repMin, sets: targetSets, hint: "🩹 Neu", isCalculated: true };
    }
    const lastReps = parseReps(lastLogEntry.reps);
    const lastWeights = parseWeights(lastLogEntry.weight, targetSets);
    const maxMovedWeight = Math.max(...lastWeights);
    const allMaxRepsHit = lastReps.every(r => r >= repMax);
    if (allMaxRepsHit) {
      return { weight: maxMovedWeight, reps: repMin, sets: targetSets, hint: "🩹 Reps bestätigt – nächste Stufe", isCalculated: true };
    }
    const minReps = Math.min(...lastReps);
    return {
      weight: maxMovedWeight,
      reps: Math.min(minReps + 1, repMax),
      sets: targetSets,
      hint: "🩹 Reps steigern",
      isCalculated: true,
    };
  }

  // ── ISOMETRIC ────────────────────────────────────────────────────────────
  if (progressionType === 'isometric') {
    if (!lastLogEntry) {
      return { weight: minWeight, reps: repMin, sets: targetSets, hint: "🧘 Neu", isCalculated: true };
    }
    const lastReps = parseReps(lastLogEntry.reps);
    const lastWeights = parseWeights(lastLogEntry.weight, targetSets);
    const maxMovedWeight = Math.max(...lastWeights);
    const minReps = Math.min(...lastReps);
    return {
      weight: maxMovedWeight,
      reps: Math.min(minReps + 1, repMax),
      sets: targetSets,
      hint: "🧘 Haltezeit steigern",
      isCalculated: true,
    };
  }

  // ── HYPERTROPHY (default) ────────────────────────────────────────────────
  if (!lastLogEntry) {
    return {
      weight: sorted ? minWeight : 0,
      reps: repMin,
      sets: targetSets,
      hint: "Neu",
      isCalculated: true,
    };
  }

  const lastReps = parseReps(lastLogEntry.reps);
  const lastWeights = parseWeights(lastLogEntry.weight, targetSets);
  const lastRPE = parseFloat(lastLogEntry.rpe || 0);
  const maxMovedWeight = Math.max(...lastWeights);
  const minMovedReps = Math.min(...lastReps);
  const isWeightUniform = lastWeights.every(w => w === maxMovedWeight) && lastWeights.length >= targetSets;
  const allMaxRepsHit = lastReps.every(r => r >= repMax);

  let result = { weight: maxMovedWeight, reps: repMin, sets: targetSets, hint: "", isCalculated: true };

  if (isWeightUniform && allMaxRepsHit && lastRPE < rpeZielMax) {
    result.weight = getNextWeight(maxMovedWeight, availableWeights);
    result.hint = lastRPE > 0 && lastRPE < rpeZielMin ? "↑ Steigerung (Easy!)" : "↑ Steigerung";
  } else if (isWeightUniform && allMaxRepsHit && lastRPE >= rpeZielMax) {
    result.weight = maxMovedWeight;
    result.reps = repMax;
    result.hint = `⚖️ Halten (RPE ${lastRPE})`;
  } else if (!isWeightUniform) {
    const index = lastWeights.indexOf(maxMovedWeight);
    result.reps = lastReps[index] || repMin;
    result.hint = "⚖️ Konsolidieren";
  } else {
    result.reps = Math.min(minMovedReps + 1, repMax);
    result.hint = "📈 Reps steigern";
  }

  return result;
};