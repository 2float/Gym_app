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

## 4. Feature Spezifikation: Smart Workout Engine (Phase 3)

### 4.1. Zielsetzung
Die App fungiert als intelligenter Coach. Statt leerer Eingabemasken erhält der User beim Start eines Trainings einen **vollständig generierten Plan** mit Ziel-Vorgaben für Gewicht und Wiederholungen, basierend auf seiner Historie und definierten Progressions-Regeln.

### 4.2. Datenmodell Erweiterung (Supabase & Dexie)

Wir mappen die CSV-Struktur auf relationale Tabellen:

1.  **`ref_equipment`** (Geräte)
    * `id`: UUID
    * `name`: String (Unique, z.B. "KH", "Latzug")
    * `weights`: Numeric Array (Die verfügbaren physikalischen Gewichte, z.B. `[2, 4, 6]`)

2.  **`ref_exercises`** (Übungskatalog)
    * `id`: UUID
    * `name`: String (Unique)
    * `category`: String ("compound", "isolation")
    * `equipment_ids`: Text Array (Referenz auf Gerätenamen oder IDs)
    * `default_sets`: Int
    * `min_reps`: Int
    * `max_reps`: Int

3.  **`ref_routines`** (Templates)
    * `id`: UUID
    * `name`: String ("Push", "Pull")
    * `order`: Int

4.  **`ref_routine_exercises`** (Verknüpfung)
    * `routine_id`: UUID
    * `exercise_id`: UUID
    * `order`: Int

5.  **`app_config`** (Globale Parameter)
    * `key`: String (PK)
    * `value`: String

### 4.3. Workflow "Smart Start"

1.  **Trigger:** User klickt "Training generieren".
2.  **Logik (Client-Side JavaScript):**
    * Bestimme nächste Routine basierend auf `workout_logs` (Last Training).
    * Lade Template-Übungen.
    * Führe **Progressions-Algorithmus** für jede Übung aus (basierend auf RPE/Reps des letzten Logs).
3.  **Output:** Ein `ActiveWorkout`-Objekt mit vorausgefüllten Zielwerten (Gewicht/Reps) und Hinweistext (z.B. "↑ Steigerung").

### 4.4. Progressions-Logik (Regelwerk)
(Portierung aus Google Apps Script)
* **Neu:** Kein Log -> Min-Gewicht / Min-Reps.
* **Steigerung:** RPE < Ziel & Max Reps erreicht -> Gewicht hoch, Reps runter.
* **Halten:** RPE >= Ziel & Max Reps erreicht -> Gewicht halten.
* **Konsolidieren:** Letztes Training uneinheitlich -> Max Gewicht stabilisieren.
* **Reps steigern:** Gewicht halten, Reps + 1 (bis Max).


## Tech Constraints
- **Datentypen:** Gewicht (FLOAT), RPE (FLOAT, 0.5 Schritte).
- **Keys:** Supabase URL/Key kommen aus `import.meta.env`.