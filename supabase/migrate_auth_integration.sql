-- =====================================================================
-- Migration: Supabase Auth Integration
-- =====================================================================
-- Fügt user_id zu workout_logs hinzu und aktualisiert RLS Policies
-- 
-- WICHTIG: Führe dies im Supabase SQL Editor aus!
-- =====================================================================

-- SCHRITT 1: user_id Spalte hinzufügen
ALTER TABLE workout_logs 
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- SCHRITT 2: Index für Performance
CREATE INDEX idx_workout_logs_user_id ON workout_logs(user_id);

-- SCHRITT 3: Alte "Public Access" Policies löschen
DROP POLICY IF EXISTS "Public Access" ON workout_logs;
DROP POLICY IF EXISTS "Public Access" ON ref_equipment;
DROP POLICY IF EXISTS "Public Access" ON ref_exercises;
DROP POLICY IF EXISTS "Public Access" ON ref_routines;
DROP POLICY IF EXISTS "Public Access" ON ref_routine_exercises;
DROP POLICY IF EXISTS "Public Access" ON app_config;

-- SCHRITT 4: Neue User-spezifische Policies für workout_logs
-- Jeder User kann nur seine eigenen Trainings sehen/bearbeiten
CREATE POLICY "Users can view their own workouts"
ON workout_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workouts"
ON workout_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workouts"
ON workout_logs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workouts"
ON workout_logs FOR DELETE
USING (auth.uid() = user_id);

-- SCHRITT 5: Referenzdaten (Übungen, Equipment, Routinen) für alle lesbar
-- Alle eingeloggten User können Referenzdaten lesen
CREATE POLICY "Authenticated users can read exercises"
ON ref_exercises FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read equipment"
ON ref_equipment FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read routines"
ON ref_routines FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read routine_exercises"
ON ref_routine_exercises FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read app_config"
ON app_config FOR SELECT
USING (auth.role() = 'authenticated');

-- OPTIONAL: Wenn User eigene Übungen erstellen sollen (später)
-- CREATE POLICY "Users can insert exercises"
-- ON ref_exercises FOR INSERT
-- WITH CHECK (auth.uid() IS NOT NULL);

-- Fertig! RLS ist jetzt aktiviert mit User-spezifischen Policies.
