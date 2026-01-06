# Projektfortschritt

## Status: 🟡 Refactoring & Bugfixing
**Aktueller Fokus:** Stabilisierung Core-Loop, Validierung & Sync-Logik

## Roadmap

### Phase 1 & 2: Basis (Erledigt ✅)
- [x] Setup, Dexie, Supabase, PWA, Offline-Sync Basic

### Phase 3: Smart Features (Erledigt ✅)
- [x] Datenmodell & Import
- [x] Smart Engine Algorithmus
- [x] Refactoring: Component Splitting (`ExerciseCard`)

### Phase 4: Hardening & UX (Aktuell 🚧)
Wir befinden uns hier. Das Ziel ist eine robuste, fehlerfreie App vor neuen Features.

#### Prio 1: Kritische Logik & Daten-Integrität 🛑
- [x] **Bugfix Sync/Upload:** Behoben werden muss das Problem, dass Workouts lokal da sind, aber nicht in Supabase landen (Folge: Smart Engine erkennt letztes Training nicht).
- [x] **Speicher-Logik:** Nur *abgehakte* (completed) Sätze speichern. Leere/nicht gemachte Sätze verwerfen.
- [x] **Validierung:** Speichern blockieren, wenn Sätze abgehakt sind, aber **keine RPE** eingetragen wurde.
- [ ] **Daten-Qualität:** "Übung hinzufügen" muss ein Dropdown aus dem Katalog sein (keine Freitext-Fehler).

#### Prio 2: Workflow & Usability ⚡
- [ ] **Routine-Wahl:** Im Dashboard nicht nur das empfohlene Training, sondern Auswahl aller Templates ermöglichen.
- [ ] **UI Focus:** Übersichtliche Liste der Übungen, Details erst beim Draufklicken (Accordion/Focus Mode).

#### Prio 3: Nice to Have 🎨
- [ ] Erweiterte History-Details während des Trainings
- [ ] Editierbare Historie (Vergangene Logs korrigieren)