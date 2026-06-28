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
 * @param {Object} exerciseDef   - Aus ref_exercises (min_reps, max_reps, default_sets)
 * @param {Array}  recentEntries - Letzte ≤5 Log-Einträge für diese Übung, neueste zuerst
 *                                 Jeder Eintrag: { weight, reps, rpe, date }
 * @param {Array}  availableWeights - Verfügbare Gewichte des Equipment
 * @param {Object} config        - progressionType, rpeTargetMin/Max, weightOffsetPct
 */
export const calculateTarget = (exerciseDef, recentEntries, availableWeights, config) => {
  const targetSets   = exerciseDef.default_sets || 3;
  const repMin       = exerciseDef.min_reps || 8;
  const repMax       = exerciseDef.max_reps || 12;
  const rpeZielMax   = parseFloat(config?.rpeTargetMax ?? config?.rpe_ziel_max ?? 9);
  const progressionType  = config?.progressionType || 'hypertrophy';
  const weightOffsetPct  = config?.weightOffsetPct ?? 0;

  const sorted = availableWeights?.length > 0
    ? [...availableWeights].map(Number).sort((a, b) => a - b)
    : null;
  const minWeight = sorted ? sorted[0] : 0;
  const maxWeight = sorted ? sorted[sorted.length - 1] : 0;

  // Kompatibilität: einzelnes Objekt (alter Aufruf) → Array
  const entries = Array.isArray(recentEntries)
    ? recentEntries
    : (recentEntries ? [recentEntries] : []);
  const hasHistory = entries.length > 0;

  // Alle Einträge vorparsen
  const parsed = entries.map(e => {
    const weights = parseWeights(e.weight, targetSets);
    const reps    = parseReps(e.reps);
    return {
      maxWeight: weights.length > 0 ? Math.max(...weights) : 0,
      minReps:   reps.length > 0 ? Math.min(...reps) : 0,
      maxReps:   reps.length > 0 ? Math.max(...reps) : 0,
      rpe:       parseFloat(e.rpe || 0),
      date:      e.date,
    };
  });

  // ── EXPLOSIVE ────────────────────────────────────────────────────────────
  if (progressionType === 'explosive') {
    if (!hasHistory) {
      const target = maxWeight * (1 + weightOffsetPct / 100);
      return { weight: sorted ? getNearestWeight(target, sorted) : Math.round(target * 2) / 2, reps: repMin, sets: targetSets, hint: "⚡ Explosiv – Einstieg", isCalculated: true };
    }
    // Letzte Session wurde normal ausgeführt → Gewicht halten
    if (entries[0]?.execution === 'normal') {
      return { weight: parsed[0].maxWeight, reps: repMin, sets: targetSets, hint: "⚡ Zuletzt normal ausgeführt – Gewicht halten", isCalculated: true };
    }
    const refWeight = Math.max(...parsed.map(p => p.maxWeight));
    if (parsed[0].maxReps > repMax) {
      const target = refWeight * (1 + weightOffsetPct / 100);
      return { weight: sorted ? getNearestWeight(target, sorted) : Math.round(target * 2) / 2, reps: repMin, sets: targetSets, hint: "⚡ Explosiv – Steigerung", isCalculated: true };
    }
    return { weight: refWeight, reps: repMin, sets: targetSets, hint: "⚡ Konzentrisch MAXIMAL EXPLOSIV – Gewicht halten", isCalculated: true };
  }

  // ── CORRECTIVE ───────────────────────────────────────────────────────────
  if (progressionType === 'corrective') {
    if (!hasHistory) return { weight: minWeight, reps: repMin, sets: targetSets, hint: "🩹 Neu", isCalculated: true };
    const last = parsed[0];
    if (last.minReps >= repMax) return { weight: last.maxWeight, reps: repMin, sets: targetSets, hint: "🩹 Reps bestätigt – nächste Stufe", isCalculated: true };
    return { weight: last.maxWeight, reps: Math.min(last.minReps + 1, repMax), sets: targetSets, hint: "🩹 Reps steigern", isCalculated: true };
  }

  // ── ISOMETRIC ────────────────────────────────────────────────────────────
  if (progressionType === 'isometric') {
    if (!hasHistory) return { weight: '', reps: repMin, sets: targetSets, hint: "🧘 Neu", isCalculated: true };
    const last = parsed[0];
    const atMax = last.minReps >= repMax;
    return {
      weight: '',
      reps: atMax ? repMax : Math.min(last.minReps + 1, repMax),
      sets: targetSets,
      hint: atMax ? "🧘 Ziel gehalten" : "🧘 Haltezeit steigern",
      isCalculated: true
    };
  }

  // ── HYPERTROPHY ──────────────────────────────────────────────────────────
  if (!hasHistory) {
    return { weight: sorted ? minWeight : 0, reps: repMin, sets: targetSets, hint: "Neu", isCalculated: true };
  }

  // Deload: letzte Session liegt >28 Tage zurück und wenig Daten
  if (parsed[0].date && entries.length < 3) {
    const daysSince = (Date.now() - new Date(parsed[0].date).getTime()) / 86400000;
    if (daysSince > 28) {
      const deloadW = sorted ? getNearestWeight(parsed[0].maxWeight * 0.95, sorted) : parsed[0].maxWeight;
      return { weight: deloadW, reps: repMin, sets: targetSets, hint: "🔄 Deload nach Pause", isCalculated: true };
    }
  }

  // Referenzgewicht: höchstes Gewicht, bei dem minReps ≥ repMin (valide Session)
  const validSessions = parsed.filter(p => p.minReps >= repMin);
  const refWeight = validSessions.length > 0
    ? Math.max(...validSessions.map(p => p.maxWeight))
    : parsed[0].maxWeight;

  // Konsistenz-Check: In den letzten 3 Sessions bei refWeight – wie oft repMax erreicht?
  const recentAtRef  = parsed.slice(0, 3).filter(p => p.maxWeight === refWeight);
  const repMaxHits   = recentAtRef.filter(p => p.minReps >= repMax).length;
  const repMaxConsistent = recentAtRef.length > 0 && repMaxHits >= Math.ceil(recentAtRef.length / 2);

  // RPE: nur nutzen wenn Mehrheit der Einträge getrackt (>0)
  const rpeValues = parsed.map(p => p.rpe).filter(r => r > 0);
  const useRPE    = rpeValues.length >= Math.ceil(parsed.length / 2);
  const avgRPE    = useRPE ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length : null;

  if (repMaxConsistent) {
    if (!useRPE || avgRPE < rpeZielMax) {
      const nextW = getNextWeight(refWeight, availableWeights);
      const hint  = useRPE ? `↑ Steigerung (Ø RPE ${avgRPE.toFixed(1)})` : "↑ Steigerung";
      return { weight: nextW, reps: repMin, sets: targetSets, hint, isCalculated: true };
    }
    return { weight: refWeight, reps: repMax, sets: targetSets, hint: `⚖️ Halten (Ø RPE ${avgRPE.toFixed(1)})`, isCalculated: true };
  }

  // Reps noch nicht konsistent bei repMax → 1 Rep steigern
  return { weight: refWeight, reps: Math.min(parsed[0].minReps + 1, repMax), sets: targetSets, hint: "📈 Reps steigern", isCalculated: true };
};