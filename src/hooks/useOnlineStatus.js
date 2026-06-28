import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function useOnlineStatus() {
  // Startwert: Wir trauen dem Browser erstmal
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    let debounceTimer = null;

    const checkConnection = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }

      try {
        const { error } = await supabase.from('workout_logs').select('id', { count: 'exact', head: true });
        if (!error || error.code !== 'PGRST000') {
          setIsOnline(true);
        }
      } catch (err) {
        setIsOnline(false);
      }
    };

    // Debounce: mehrere schnelle Events (online + focus + visibilitychange)
    // werden zu einem einzigen Check zusammengefasst.
    const debouncedCheck = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkConnection, 300);
    };

    const updateStatus = () => {
      if (!navigator.onLine) {
        setIsOnline(false);
      } else {
        debouncedCheck();
      }
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    window.addEventListener('focus', debouncedCheck);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') debouncedCheck();
    });

    checkConnection();

    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      window.removeEventListener('focus', debouncedCheck);
      window.removeEventListener('visibilitychange', debouncedCheck);
    };
  }, []);

  return isOnline;
}