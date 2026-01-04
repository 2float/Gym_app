# 📋 Project Specification: Gym-Log & Auto-Planner (PWA)

## 1. Vision & Constraints
* **Goal:** Seamless gym tracking (Offline-First) with automated workout generation.
* **Cost:** 0€ (GitHub Pages + Supabase Free Tier).
* **Stack:** Vite, React, Tailwind CSS, Dexie.js (IndexedDB), Supabase.
* **Key Feature:** Modular JS-Algorithm for progressive overload.

## 2. Technical Architecture
* **Source of Truth:** Supabase (PostgreSQL).
* **Local Cache:** Dexie.js (IndexedDB) for 100% offline capability.
* **Sync Strategy:** 1. Fetch latest data on app start (if online).
    2. Log everything to IndexedDB during workout.
    3. Push "Done" workouts to Supabase when connection is available.
* **Auth:** Supabase Auth (Magic Link / Email).

## 3. Database Schema (Draft)
* `profiles`: id, user_id, preferences (jsonb).
* `exercises`: id, name, category, increment_value ($step\_size$).
* `workout_templates`: id, name, exercise_list (uuid[]).
* `workout_sessions`: id, template_id, date, status (draft/completed).
* `exercise_logs`: id, session_id, exercise_id, weight, reps, rpe, set_index.

## 4. Algorithm Logic (v1)
* **Input:** Last 3 sessions for Exercise X.
* **Rule:** * If RPE $\le 8$ for all sets $\rightarrow$ Next Weight = Current Weight + $step\_size$.
    * If RPE $> 9$ or failure $\rightarrow$ Maintain Weight.
    * If failure occurs in 2 consecutive sessions $\rightarrow$ Deload -10%.

## 5. Deployment
* **Frontend:** GitHub Pages via GitHub Actions.
* **Access:** PWA (Add to Home Screen) on iOS for persistent storage.