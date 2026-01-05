# Project Specification

## Sync-Strategie (Offline-First)

### 1. Status Erkennung
- Die App muss aktiv auf `window.addEventListener('online')` und `('offline')` hören.
- Ein visueller Banner zeigt an, wenn der User offline ist.

### 2. Speichern (Write)
- **Immer:** Schreiben in Dexie.js (Lokale DB).
- **Versuch:** Wenn Online -> Push zu Supabase.
- **Fallback:** Wenn Offline oder Fehler -> Nur lokal markieren (`status: 'completed'`), User informieren ("Lokal gespeichert").

### 3. Re-Sync (Read/Upload)
- **Trigger:** Beim App-Start (Mount) und wenn Status auf "Online" wechselt.
- **Logik:**
    1. Suche in Dexie nach Sessions mit `status: 'completed'`.
    2. Prüfe, ob diese Sessions bereits in Supabase existieren (Check via ID).
    3. Falls nicht in Supabase -> Upload Session + Logs.
    4. Feedback an User (z.B. kleiner Toast "3 Trainings nachsynchronisiert").

## Tech Constraints
- **Datentypen:** Gewicht (FLOAT), RPE (FLOAT, 0.5 Schritte).
- **Keys:** Supabase URL/Key kommen aus `import.meta.env`.