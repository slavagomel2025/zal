// Хранение в localStorage. Все ключи с версией схемы.

const PREFIX = 'gym.v1.';

export function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (err) {
    console.warn('storage read failed:', key, err);
    return fallback;
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn('storage write failed:', key, err);
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (err) {
    console.warn('storage remove failed:', key, err);
  }
}

export function defaultSettings() {
  return {
    soundEnabled: true,
    soundMode: 'mix',
    showRir: false,
    bodyWeightKg: null,
    analysis: {
      tonnage: true,
      weekly: true,
      sets: true,
      duration: true,
      rest: true,
      e1rm: true,
      prs: true,
      progress: true,
      frequency: true,
      bodyWeight: true
    }
  };
}

// Библиотека: сами упражнения со всеми настройками.
export function defaultLibrary() {
  return [
    {
      id: 'ex_bench',
      name: 'Жим лёжа',
      kind: 'base',
      loadType: 'external',
      muscleGroup: 'грудь',
      stepKg: 2.5,
      note: '',
      warmupSets: [
        { weightKg: 40, reps: 10, restSec: 60 },
        { weightKg: 60, reps: 6, restSec: 90 }
      ],
      sets: [
        { weightKg: 80, reps: 5, restSec: 90 },
        { weightKg: 80, reps: 5, restSec: 90 },
        { weightKg: 80, reps: 5, restSec: 90 }
      ],
      transitionRestSec: 120
    }
  ];
}

// Программы: какие упражнения и в каком порядке в конкретный день.
export function defaultPrograms(library) {
  return [
    {
      id: 'p_main',
      name: 'День 1',
      items: library.map((ex) => ({ exerciseId: ex.id, supersetGroup: null }))
    }
  ];
}

function normalizeData(raw) {
  const library = Array.isArray(raw.library) ? raw.library : [];
  const programs = Array.isArray(raw.programs) ? raw.programs : [];
  const activeProgramId =
    raw.activeProgramId && programs.some((p) => p.id === raw.activeProgramId)
      ? raw.activeProgramId
      : programs[0]
        ? programs[0].id
        : null;
  return { library, programs, activeProgramId };
}

// Загружает библиотеку и программы; при первом запуске переносит старую схему.
export function loadData() {
  const stored = read('data', null);
  if (stored && Array.isArray(stored.library) && Array.isArray(stored.programs)) {
    return normalizeData(stored);
  }

  const oldProgram = read('program', null);
  const library =
    Array.isArray(oldProgram) && oldProgram.length > 0 ? oldProgram : defaultLibrary();
  const programs = defaultPrograms(library);
  const data = { library, programs, activeProgramId: programs[0].id };
  write('data', data);
  return data;
}

export function saveData(data) {
  return write('data', data);
}

export function loadSessions() {
  const list = read('sessions', []);
  return Array.isArray(list) ? list : [];
}

export function saveSessions(list) {
  return write('sessions', list);
}

export function loadSettings() {
  const stored = read('settings', {});
  const base = defaultSettings();
  return Object.assign(base, stored, {
    analysis: Object.assign(base.analysis, stored.analysis || {})
  });
}

export function saveSettings(settings) {
  return write('settings', settings);
}

export function loadRecommendations() {
  const rec = read('recommendations', null);
  return rec && Array.isArray(rec.items) ? rec : null;
}

export function saveRecommendations(rec) {
  return write('recommendations', rec);
}

export function loadBackupSlot() {
  return read('backup', null);
}

export function saveBackupSlot(data) {
  return write('backup', data);
}
