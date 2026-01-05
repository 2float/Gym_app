import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useOnlineStatus() {
  // Startwert: Wir trauen dem Browser erstmal
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    // Der "echte" Check: Ein minimaler Ping an Supabase
    const checkConnection = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }

      try {
        // 'head: true' = Nur Header laden, extrem schnell & datensparsam
        const { error } = await supabase.from('workout_sessions').select('id', { count: 'exact', head: true });
        
        // Wenn kein Netzwerk-Fehler kommt, sind wir online
        if (!error || error.code !== 'PGRST000') { 
            setIsOnline(true);
        }
      } catch (err) {
        // Echter Netzwerkfehler -> Offline
        setIsOnline(false);
      }
    };

    const updateStatus = () => {
      if (!navigator.onLine) {
        setIsOnline(false); // Sofort Offline schalten
      } else {
        checkConnection(); // Bei Online erst prüfen
      }
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    window.addEventListener('focus', checkConnection); 
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkConnection();
    });

    // Initialer Check
    checkConnection();

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      window.removeEventListener('focus', checkConnection);
      window.removeEventListener('visibilitychange', checkConnection);
    };
  }, []);

  return isOnline;
}