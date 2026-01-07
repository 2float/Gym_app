-- =====================================================================
-- Migration: Ändere workout_logs.date von DATE zu TIMESTAMPTZ
-- =====================================================================
-- Vorher: date DATE (nur Tag, keine Uhrzeit)
-- Nachher: date TIMESTAMPTZ (voller Timestamp mit Zeitzone)
--
-- WICHTIG: Führe diese Migration in Supabase SQL Editor aus,
-- BEVOR du reset_and_import_logs.js ausführst!
-- =====================================================================

-- Schritt 1: Spaltentyp ändern (PostgreSQL konvertiert automatisch)
ALTER TABLE workout_logs 
ALTER COLUMN date TYPE TIMESTAMPTZ 
USING date::TIMESTAMPTZ;

-- Schritt 2: NOT NULL Constraint beibehalten (falls vorhanden)
ALTER TABLE workout_logs 
ALTER COLUMN date SET NOT NULL;

-- Fertig! Ab jetzt kann 'date' volle Timestamps speichern.
