# Projektfortschritt

## Status: 🟡 Bugfixing / Hardening
**Aktueller Fokus:** Offline-Indikator & Zuverlässiger Sync-Mechanismus

## Roadmap

### Phase 1: Setup & Grundgerüst (Erledigt ✅)
- [x] Projekt-Initialisierung (Vite, React, Tailwind)
- [x] Supabase & Dexie Setup
- [x] Deployment Pipeline (GitHub Pages)
- [x] PWA Installation (Service Worker läuft)

### Phase 2: Core Loop & Robustness (In Arbeit 🚧)
- [x] Active Workout UI (Basis)
- [x] Sätze lokal loggen (Dexie)
- [x] Feature: Historie im Training anzeigen
- [ ] **Fix:** Visueller Online/Offline Status Indikator
- [ ] **Fix:** "Finish Workout" darf bei Offline nicht hängen bleiben
- [ ] **Fix:** Auto-Sync beim App-Start (Hochladen von 'completed' Sessions, die noch lokal liegen)

### Phase 3: Features
- [ ] Workout Templates (Routinen erstellen & laden)
- [ ] Bearbeiten von vergangenen Logs
- [ ] Erweiterte Statistiken