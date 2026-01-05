-- =================================================================
-- 1. HARD RESET (Alles löschen)
-- =================================================================
DROP TABLE IF EXISTS workout_logs CASCADE;
DROP TABLE IF EXISTS ref_routine_exercises CASCADE;
DROP TABLE IF EXISTS ref_routines CASCADE;
DROP TABLE IF EXISTS ref_exercises CASCADE;
DROP TABLE IF EXISTS ref_equipment CASCADE;
DROP TABLE IF EXISTS app_config CASCADE;

-- =================================================================
-- 2. SCHEMA DEFINITION (Tabellen neu anlegen)
-- =================================================================

-- Config
CREATE TABLE app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipment (Geräte & Gewichte)
CREATE TABLE ref_equipment (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    weights NUMERIC[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exercises (Übungskatalog)
CREATE TABLE ref_exercises (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    category TEXT CHECK (category IN ('compound', 'isolation')),
    default_sets INT DEFAULT 3,
    min_reps INT DEFAULT 8,
    max_reps INT DEFAULT 12,
    equipment_names TEXT[], -- Wir speichern Namen als Referenz für einfachen Match
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Routines (Templates)
CREATE TABLE ref_routines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    sort_order INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Routine <-> Exercise Verknüpfung
CREATE TABLE ref_routine_exercises (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    routine_id UUID REFERENCES ref_routines(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES ref_exercises(id) ON DELETE CASCADE,
    sort_order INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(routine_id, exercise_id)
);

-- Logs (Historie)
CREATE TABLE workout_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    workout_name TEXT NOT NULL,
    duration_ms INT DEFAULT 0,
    exercises JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================================================================
-- 3. SECURITY (Row Level Security aktivieren)
-- =================================================================
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Alles offen (Public Read/Write) für Phase 3 Testing
CREATE POLICY "Public Access" ON app_config FOR ALL USING (true);
CREATE POLICY "Public Access" ON ref_equipment FOR ALL USING (true);
CREATE POLICY "Public Access" ON ref_exercises FOR ALL USING (true);
CREATE POLICY "Public Access" ON ref_routines FOR ALL USING (true);
CREATE POLICY "Public Access" ON ref_routine_exercises FOR ALL USING (true);
CREATE POLICY "Public Access" ON workout_logs FOR ALL USING (true);

-- =================================================================
-- 4. DATA SEEDING (Deine CSV Daten importieren)
-- =================================================================

-- A. CONFIG
INSERT INTO app_config (key, value) VALUES
('rpe_ziel_min', '8'),
('rpe_ziel_max', '9'),
('plateau_schwelle_einheiten', '3'),
('pause_tage_fuer_deload', '7'),
('deload_faktor', '0.9'); -- Komma zu Punkt korrigiert

-- B. EQUIPMENT (Aus 'Geräte.csv')
-- Hinweis: Habe Kommas in Dezimalzahlen durch Punkte ersetzt für SQL Array Syntax
INSERT INTO ref_equipment (name, weights) VALUES
('KH', '{2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60}'),
('LH', '{20,22.5,25,27.5,30,32.5,35,37.5,40,42.5,45,47.5,50,52.5,55,57.5,60,62.5,65,67.5,70,72.5,75,77.5,80,82.5,85,87.5,90,92.5,95,97.5,100,102.5,105,107.5,110,112.5,115,117.5,120,122.5,125,127.5,130,132.5,135,137.5,140,142.5,145,147.5,150}'),
('kurze_LH', '{8,10.25,12.5,14.75,17,19.25,21.5,23.75,26,28.25,30.5,32.75,35,37.25,39.5,41.75,44,46.25,48.5,50.75,53,55.25,57.5,59.75,62,64.25,66.5,68.75,71,73.25,75.5,77.75,80,82.25,84.5,86.75,89,91.25,93.5,95.75,98,100.25,102.5,104.75,107,109.25,111.5,113.75,116,118.25,120.5,122.75,125}'),
('Gewichtsscheiben_einzel', '{1.25,2.5,3.75,5,6.25,7.5,8.75,10,11.25,12.5,13.75,15,16.25,17.5,18.75,20,21.25,22.5,23.75,25,26.25,27.5,28.75,30,31.25,32.5,33.75,35,36.25,37.5,38.75,40,41.25,42.5,43.75,45,46.25,47.5,48.75,50,51.25,52.5,53.75,55,56.25,57.5,58.75,60,61.25,62.5,63.75,65,66.25,67.5,68.75,70,71.25,72.5,73.75,75,76.25,77.5,78.75,80,81.25,82.5,83.75,85,86.25,87.5,88.75,90,91.25,92.5,93.75,95,96.25,97.5,98.75,100}'),
('Gewichtsscheiben_doppel', '{2.5,5,7.5,10,12.5,15,17.5,20,22.5,25,27.5,30,32.5,35,37.5,40,42.5,45,47.5,50,52.5,55,57.5,60,62.5,65,67.5,70,72.5,75,77.5,80,82.5,85,87.5,90,92.5,95,97.5,100,102.5,105,107.5,110,112.5,115,117.5,120,122.5,125,127.5,130,132.5,135,137.5,140,142.5,145,147.5,150}'),
('Kabelzug_Mitte', '{2.5,5,7.5,10,12.5,15,17.5,21.25,25,28.75,32.5,36.25,40,43.75,47.5}'),
('Kabelzug_Seite', '{1.25,1.875,2.5,3.75,4.375,5,6.25,6.875,7.5,8.75,9.375,10,11.25,11.875,12.5,13.75,14.375,15,16.25,16.875,17.5,18.75,19.375,20,21.25,21.875,22.5,23.75,24.375,25,26.25,26.875,27.5,28.75,29.375,30,31.25,31.875,32.5,33.75,34.375,35,36.25,36.875,37.5,38.75,39.375,40,41.25,41.875,42.5,43.75,44.375,45,46.25,46.875,47.5,48.75,49.375,50}'),
('Beinpresse', '{5,12,19,26,33,40,47,54,61,68,75,82,89,96,103,110,117,124,131,138}'),
('Beinstrecker', '{5,12,19,26,33,40,47,54,61,68,75,82,89,96,103,110,117,124,131,138}'),
('Beinbeuger', '{5,12,19,26,33,40,47,54,61,68,75,82,89,96,103,110,117,124,131,138}'),
('Latzug', '{5,12.5,20,27.5,35,42.5,50,60,70,80,90,100,110,120,130}'),
('Rudern_Kabel', '{5,12.5,20,27.5,35,42.5,50,60,70,80,90,100,110,120,130}'),
('Abductor_Maschine', '{5,7.5,10,12,14.5,17,19,21.5,24,26,28.5,31,33,35.5,38,40,42.5,45,47,49.5,52,54,56.5,59,61,63.5,66,68,70.5,73,75,77.5,80,82,84.5,87,89,91.5,94,96,98.5,101,103,105.5,108,110,112.5,115,117,119.5,122,124,126.5,129,131,133.5,136,138,140.5,143}'),
('Adductor_Maschine', '{5,7.5,10,12,14.5,17,19,21.5,24,26,28.5,31,33,35.5,38,40,42.5,45,47,49.5,52,54,56.5,59,61,63.5,66,68,70.5,73,75,77.5,80,82,84.5,87,89,91.5,94,96,98.5,101,103,105.5,108,110,112.5,115,117,119.5,122,124,126.5,129,131,133.5,136,138,140.5,143}'),
('Wadenheben_Maschine', '{5,7.5,10,10,12.5,15,15,17.5,20,25,27.5,30,35,37.5,40,45,47.5,50,55,57.5,60,65,67.5,70,75,77.5,80,85,87.5,90,95,97.5,100,105,107.5,110,115,117.5,120,125,127.5,130,135,137.5,140,145,147.5,150,155,157.5,160,165,167.5,170,175,177.5,180,185,187.5,190,195,197.5,200}');


-- C. EXERCISES (Aus 'Katalog.csv')
-- Hinweis: Semikolons in Gerätenamen wurden zu Array-Syntax: 'A;B' -> '{A,B}'
INSERT INTO ref_exercises (name, category, default_sets, min_reps, max_reps, equipment_names) VALUES
('Bankdrücken LH', 'compound', 4, 8, 12, '{LH}'),
('Schrägbank LH', 'compound', 3, 8, 12, '{LH}'),
('Schulterdrücken KH', 'compound', 3, 8, 12, '{KH}'),
('Schulterdrücken Maschine', 'compound', 3, 8, 12, '{Gewichtsscheiben_doppel}'),
('Seitheben KH', 'isolation', 3, 10, 20, '{KH}'),
('Trizeps Kabel', 'isolation', 3, 10, 15, '{Kabelzug_Seite,Kabelzug_Mitte}'),
('Trizeps Kabel Overhead', 'isolation', 3, 10, 15, '{Kabelzug_Seite,Kabelzug_Mitte}'),
('Trizeps KH Overhead', 'isolation', 3, 8, 15, '{KH}'),
('Latzug', 'compound', 4, 8, 12, '{Latzug}'),
('Rudern LH', 'compound', 4, 8, 12, '{LH}'),
('Rudern Kabel', 'compound', 4, 8, 12, '{Rudern_Kabel}'),
('Facepulls', 'isolation', 3, 12, 20, '{Kabelzug_Seite,Kabelzug_Mitte}'),
('Bizepscurls KH gedreht', 'isolation', 3, 8, 15, '{KH}'),
('Bizepscurls KH gerade', 'isolation', 3, 8, 15, '{KH}'),
('SZ-Curls', 'isolation', 4, 8, 15, '{kurze_LH}'),
('Hammercurls', 'isolation', 3, 8, 15, '{KH}'),
('Beinpresse', 'compound', 4, 8, 12, '{Beinpresse}'),
('Beinstrecker', 'isolation', 3, 10, 15, '{Beinstrecker}'),
('Beinbeuger liegend', 'isolation', 3, 10, 15, '{Beinbeuger}'),
('Wadenheben Beinpresse', 'isolation', 4, 12, 20, '{Beinpresse}'),
('Wadenheben stehend', 'isolation', 4, 12, 20, '{Wadenheben_Maschine}'),
('Situps Schrägbank', 'isolation', 3, 12, 25, '{Gewichtsscheiben_einzel}'),
('Cable Crunch', 'isolation', 4, 12, 20, '{Kabelzug_Seite,Kabelzug_Mitte}'),
('Oblique Crunch Maschine', 'isolation', 3, 10, 15, '{Gewichtsscheiben_einzel}'),
('Plank', 'isolation', 3, 30, 180, '{bodyweight}'),
('Side Plank', 'isolation', 3, 20, 180, '{bodyweight}'),
('Bulgarian Split Squat KH', 'compound', 3, 8, 12, '{KH}'),
('Einbeiniges Kreuzheben KH', 'compound', 3, 8, 12, '{KH}'),
('Abduktoren Maschine', 'isolation', 3, 10, 15, '{Abductor_Maschine}'),
('Adduktoren Maschine', 'isolation', 3, 10, 15, '{Adductor_Maschine}'),
('Dead Bug', 'isolation', 3, 10, 50, '{bodyweight}'),
('Bird Dog', 'isolation', 3, 10, 50, '{bodyweight}'),
('Situps gekreuzt', 'isolation', 3, 10, 50, '{bodyweight}');


-- D. TEMPLATES (Aus 'Templates.csv')
INSERT INTO ref_routines (name, sort_order) VALUES
('Push', 1),
('Pull', 2),
('Beine', 3);

-- E. LINK TEMPLATES (Logik zum Verknüpfen)
DO $$
DECLARE
    -- Funktion zum Einfügen (Inline)
    -- Da wir keine permanente Funktion erstellen wollen, nutzen wir Logik im Block
    r_push UUID;
    r_pull UUID;
    r_beine UUID;
    
    -- Helper Function Simulation via Procedure Call
    PROCEDURE link_ex(p_routine TEXT, p_exercise TEXT, p_order INT) IS
    DECLARE
        v_r_id UUID;
        v_e_id UUID;
    BEGIN
        SELECT id INTO v_r_id FROM ref_routines WHERE name = p_routine;
        SELECT id INTO v_e_id FROM ref_exercises WHERE name = p_exercise;
        
        IF v_r_id IS NOT NULL AND v_e_id IS NOT NULL THEN
            INSERT INTO ref_routine_exercises (routine_id, exercise_id, sort_order)
            VALUES (v_r_id, v_e_id, p_order)
            ON CONFLICT DO NOTHING;
        END IF;
    END;
BEGIN
    -- Push
    CALL link_ex('Push', 'Bankdrücken LH', 1);
    CALL link_ex('Push', 'Schrägbank LH', 2);
    CALL link_ex('Push', 'Schulterdrücken KH', 3);
    CALL link_ex('Push', 'Seitheben KH', 4);
    CALL link_ex('Push', 'Trizeps Kabel', 5);
    CALL link_ex('Push', 'Cable Crunch', 6);
    CALL link_ex('Push', 'Plank', 7);

    -- Pull
    CALL link_ex('Pull', 'Latzug', 1);
    CALL link_ex('Pull', 'Rudern LH', 2);
    CALL link_ex('Pull', 'Rudern Kabel', 3); 
    CALL link_ex('Pull', 'Facepulls', 4);
    CALL link_ex('Pull', 'Bizepscurls KH gedreht', 5);
    CALL link_ex('Pull', 'Bizepscurls KH gerade', 6);
    CALL link_ex('Pull', 'Oblique Crunch Maschine', 7);
    CALL link_ex('Pull', 'Dead Bug', 8);

    -- Beine
    CALL link_ex('Beine', 'Bulgarian Split Squat KH', 1);
    CALL link_ex('Beine', 'Einbeiniges Kreuzheben KH', 2);
    CALL link_ex('Beine', 'Adduktoren Maschine', 3);
    CALL link_ex('Beine', 'Abduktoren Maschine', 4);
    CALL link_ex('Beine', 'Wadenheben stehend', 5);
    CALL link_ex('Beine', 'Situps Schrägbank', 6);
    CALL link_ex('Beine', 'Side Plank', 7);
END $$;