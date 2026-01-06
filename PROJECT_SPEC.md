# Project Specification

## Sync-Strategie (Hybrid / Online-Start)

### 1. Status Erkennung
* Die App nutzt `window.addEventListener('online'/'offline')`.
* Ein visueller Indikator zeigt den Status an, blockiert aber nicht die UI (außer bei Features, die zwingend Online sein müssen).

### 2. Speichern (Write-Strategy)
* **Primär:** Schreiben in Dexie.js (Lokale DB/Cache). Das sorgt für sofortiges UI-Feedback.
* **Sekundär (Background):**
    * Wenn **Online**: Versuch, den Datensatz sofort an Supabase zu pushen.
    * Wenn **Offline/Fehler**: Datensatz lokal als `synced: false` (oder `status: 'completed_local'`) markieren.
    * User-Feedback: "Gespeichert" (UI muss nicht unterscheiden, wo gespeichert wurde, solange es sicher ist).

### 3. Laden & Re-Sync (Read-Strategy)
* **Training Start:** Darf eine Online-Verbindung voraussetzen, um Templates/Historie zu laden.
* **Im Training:** Muss offline-fähig sein (Daten kommen aus dem lokalen State/Cache).
* **Re-Sync Trigger:** Beim App-Start oder Wechsel auf "Online":
    1.  Prüfe Dexie auf nicht synchronisierte Einträge.
    2.  Push zu Supabase.
    3.  Bei Konflikten: Server gewinnt (oder letzte Änderung gewinnt, je nach Logik).
    4.  Button für den User um einen Resync zu triggern (solange keine Gewissheit ist, dass die Daten auf dem Server angekommen sind)

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