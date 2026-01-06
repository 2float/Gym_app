import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { db } from '../db';
import useOnlineStatus from './useOnlineStatus';

export function useDataSync() {
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const syncReferenceData = async () => {
      // Nur syncen, wenn wir online sind
      if (!isOnline) return;
      
      setIsSyncing(true);
      try {
        console.log("🔄 Starte Background-Sync für Stammdaten...");

        // 1. Übungen holen
        const { data: exercises, error: exError } = await supabase
          .from('ref_exercises')
          .select('*');
        
        if (!exError && exercises?.length > 0) {
          await db.ref_exercises.bulkPut(exercises);
          console.log(`✅ ${exercises.length} Übungen gesynct.`);
        }

        // 2. Equipment holen
        const { data: equipment, error: eqError } = await supabase
           .from('ref_equipment')
           .select('*');

        if (!eqError && equipment?.length > 0) {
          await db.ref_equipment.bulkPut(equipment);
          console.log(`✅ ${equipment.length} Equipment-Items gesynct.`);
        }

      } catch (err) {
        console.error("❌ Fehler beim Stammdaten-Sync:", err);
      } finally {
        setIsSyncing(false);
      }
    };

    syncReferenceData();
  }, [isOnline]); // Läuft immer, wenn der Online-Status sich zu "true" ändert

  return isSyncing; // Rückgabewert, falls wir später einen Spinner anzeigen wollen
}