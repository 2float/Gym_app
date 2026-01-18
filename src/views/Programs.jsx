import { useEffect, useState } from 'react';
import {
  getAvailablePrograms,
  getActiveProgram,
  setActiveProgram,
  getProgramRoutines,
  addRoutineToProgram,
  removeRoutineFromProgram,
  reorderProgramRoutines,
  getAllTemplates,
  createProgram
} from '../services/smartWorkoutService';
import { useApp } from '../contexts/AppContext';

export default function Programs() {
  const { isOnline } = useApp();
  const [programs, setPrograms] = useState([]);
  const [activeProgram, setActiveProgramState] = useState(null);
  const [programRoutines, setProgramRoutines] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setErrorMsg('');
      try {
        const [progs, current, templates] = await Promise.all([
          getAvailablePrograms(),
          getActiveProgram(),
          getAllTemplates()
        ]);
        setPrograms(progs);
        setActiveProgramState(current);
        setAllTemplates(templates);
        if (current) {
          const routines = await getProgramRoutines(current.id);
          setProgramRoutines(routines);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('Fehler beim Laden der Daten: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleProgramSelect = async (programId) => {
    try {
      if (!isOnline) {
        throw new Error('Programmwechsel erfordert Internet');
      }
      const idNum = Number(programId);
      await setActiveProgram(idNum);
      const current = programs.find(p => p.id === idNum) || null;
      setActiveProgramState(current);
      const routines = await getProgramRoutines(idNum);
      setProgramRoutines(routines);
    } catch (err) {
      console.error(err);
      setErrorMsg('Fehler beim Setzen des Programms: ' + err.message);
    }
  };

  const handleAddTemplate = async (routineId) => {
    try {
      if (!activeProgram) return;
      await addRoutineToProgram(activeProgram.id, routineId);
      const routines = await getProgramRoutines(activeProgram.id);
      setProgramRoutines(routines);
    } catch (err) {
      console.error(err);
      setErrorMsg('Fehler beim Hinzufügen: ' + err.message);
    }
  };

  const handleRemoveTemplate = async (routineId) => {
    try {
      if (!activeProgram) return;
      await removeRoutineFromProgram(activeProgram.id, routineId);
      const routines = await getProgramRoutines(activeProgram.id);
      setProgramRoutines(routines);
    } catch (err) {
      console.error(err);
      setErrorMsg('Fehler beim Entfernen: ' + err.message);
    }
  };

  const moveRoutine = async (routineId, direction) => {
    if (!activeProgram) return;
    const ids = programRoutines.map(r => r.id);
    const index = ids.indexOf(routineId);
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= ids.length) return;
    // swap
    const newOrder = [...ids];
    const temp = newOrder[index];
    newOrder[index] = newOrder[newIndex];
    newOrder[newIndex] = temp;

    try {
      await reorderProgramRoutines(activeProgram.id, newOrder);
      const routines = await getProgramRoutines(activeProgram.id);
      setProgramRoutines(routines);
    } catch (err) {
      console.error(err);
      setErrorMsg('Fehler beim Neuordnen: ' + err.message);
    }
  };

  const availableToAdd = allTemplates.filter(t => !programRoutines.some(r => r.id === t.id));

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-800 dark:text-red-200 p-4 rounded-r-lg shadow-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="font-medium">{errorMsg}</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">Programme</h2>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            disabled={isLoading}
          >
            Neues Programm erstellen
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {programs.map(p => {
            const isActive = Number(activeProgram?.id) === Number(p.id);
            return (
              <div
                key={p.id}
                onClick={() => handleProgramSelect(Number(p.id))}
                className={`p-4 rounded-xl border cursor-pointer transition-colors
                  ${isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-gray-800 dark:text-gray-100">{p.name}</div>
                  {isActive && (
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Aktiv</span>
                  )}
                </div>
              </div>
            );
          })}
          {programs.length === 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">Keine Programme verfügbar</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Program Mapping */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-2">Zuordnung & Reihenfolge</h3>
          {programRoutines.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Keine Templates zugeordnet</p>
          ) : (
            <ul className="space-y-2">
              {programRoutines.map((r) => (
                <li key={r.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="font-medium">{r.name}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => moveRoutine(r.id, 'up')} className="p-1 rounded bg-gray-200 dark:bg-gray-700">↑</button>
                    <button onClick={() => moveRoutine(r.id, 'down')} className="p-1 rounded bg-gray-200 dark:bg-gray-700">↓</button>
                    <button onClick={() => handleRemoveTemplate(r.id)} className="p-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30">Entfernen</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Templates Pool */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-2">Templates</h3>
          {availableToAdd.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Alle Templates sind zugeordnet</p>
          ) : (
            <ul className="space-y-2">
              {availableToAdd.map(t => (
                <li key={t.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="font-medium">{t.name}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleAddTemplate(t.id)} className="p-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30">Hinzufügen</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Create Program Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700 p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Neues Programm erstellen</h3>
            <ProgramCreateForm
              onCreate={async (name, description, setActive) => {
                try {
                  if (!isOnline) throw new Error('Erfordert Internet');
                  const created = await createProgram(name, description, false);
                  const updatedList = await getAvailablePrograms();
                  setPrograms(updatedList);
                  if (setActive) {
                    await setActiveProgram(created.id);
                    setActiveProgramState(created);
                    const routines = await getProgramRoutines(created.id);
                    setProgramRoutines(routines);
                  }
                  setIsModalOpen(false);
                } catch (err) {
                  setErrorMsg('Fehler beim Erstellen: ' + err.message);
                }
              }}
              onCancel={() => setIsModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ProgramCreateForm({ onCreate, onCancel }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [setActive, setSetActive] = useState(true);
  return (
    <div className="space-y-3">
      <input
        className="w-full p-2 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded"
        placeholder="Name (z.B. 4er Split)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="w-full p-2 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded"
        placeholder="Beschreibung (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={setActive} onChange={(e) => setSetActive(e.target.checked)} />
        Nach Erstellung aktivieren
      </label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onCreate(name.trim(), description.trim(), setActive)}
          disabled={!name.trim()}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          Programm erstellen
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
