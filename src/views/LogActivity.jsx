import { useState } from 'react';
import { db } from '../db';
import { supabase } from '../supabaseClient';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { SPORTS, CUSTOM_SPORT_ICON } from '../constants/activitySports';

export default function LogActivity({ onSaved, onCancel }) {
  const { isOnline, refreshActivityHistory } = useApp();
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState(null);
  const [customLabel, setCustomLabel] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isCustom = selectedType === 'custom';
  const canSave = isCustom ? customLabel.trim().length > 0 : !!selectedType;

  const handleSave = async () => {
    if (!canSave || isSaving) return;
    setIsSaving(true);

    const now = new Date();
    const sportType = selectedType;
    const label = isCustom
      ? customLabel.trim()
      : SPORTS.find(s => s.type === sportType)?.label ?? sportType;

    const entryLocal = {
      date: now.toISOString(),
      sport_type: sportType,
      label,
      note: note.trim() || null,
      synced: false
    };

    let localId;
    try {
      localId = await db.activity_logs.add(entryLocal);
    } catch (err) {
      console.error('Local save failed:', err);
      alert('Fehler beim lokalen Speichern! Bitte erneut versuchen.');
      setIsSaving(false);
      return;
    }

    if (isOnline && user) {
      try {
        const pad = n => String(n).padStart(2, '0');
        const naiveTimestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}Z`;

        const { error } = await supabase.from('activity_logs').insert([{
          date: naiveTimestamp,
          sport_type: sportType,
          label,
          note: entryLocal.note,
          user_id: user.id
        }]);

        if (!error) {
          await db.activity_logs.update(localId, { synced: true });
        } else {
          console.error('Cloud sync error:', error);
        }
      } catch (syncErr) {
        console.warn('Cloud sync übersprungen (offline/Fehler):', syncErr.message);
      }
    }

    await refreshActivityHistory();
    setIsSaving(false);
    onSaved();
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">Andere Sportart</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Was hast du heute gemacht?</p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {SPORTS.map(sport => (
            <button
              key={sport.type}
              onClick={() => setSelectedType(sport.type)}
              className={`flex flex-col items-center justify-center gap-1 py-4 rounded-xl border-2 transition-all active:scale-95 ${
                selectedType === sport.type
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 hover:border-teal-300'
              }`}
            >
              <span className="text-3xl">{sport.icon}</span>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{sport.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setSelectedType('custom')}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all active:scale-95 mb-4 ${
            isCustom
              ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30'
              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 hover:border-teal-300'
          }`}
        >
          <span className="text-xl">{CUSTOM_SPORT_ICON}</span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Eigene Sportart eingeben</span>
        </button>

        {isCustom && (
          <input
            type="text"
            value={customLabel}
            onChange={e => setCustomLabel(e.target.value)}
            placeholder="z.B. Klettern"
            autoFocus
            className="w-full p-3 mb-4 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100"
          />
        )}

        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
          Notiz (optional)
        </label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="z.B. 1,5h, gute Session"
          rows={2}
          className="w-full p-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 resize-none"
        />

        {!isOnline && (
          <p className="text-xs text-amber-600 dark:text-amber-300 mt-3">
            Offline — wird lokal gespeichert und später synchronisiert.
          </p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-semibold text-sm transition-all active:scale-95"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-all active:scale-95 ${
              !canSave || isSaving
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                : 'bg-teal-600 hover:bg-teal-700 text-white'
            }`}
          >
            {isSaving ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
