# SYSTEM CONTEXT

## CODE-STRUKTUR & LIMITS
Diese Regeln dienen der Wartbarkeit. Das Einhalten ist Pflicht.

### Datei-Größen Richtlinien
* **Soft Limit:** ~200-250 Zeilen
    * **Aktion:** Aktiv prüfen: "Macht diese Datei zu viel?" (Single Responsibility Principle).
    * **Lösung:** Logik in Custom Hooks (`useWorkoutLogic`) oder UI in Sub-Komponenten (`ExerciseCard`) auslagern.
* **Hard Limit:** 400 Zeilen
    * **Aktion:** Refactoring ist Pflicht. Dateien dieser Größe sind schwer zu warten und fehleranfällig.
* **Ausnahmen:** Reine Daten-Config-Dateien (z.B. große Arrays, Mappings) oder extrem zentrale Views (nur wenn unvermeidbar).

## AKTUELLER FOKUS & STATUS
* Siehe `PROGRESS.md` für den detaillierten Status, offene Tasks und Roadmap.
* Primäres Ziel: Stabilität vor neuen Features.