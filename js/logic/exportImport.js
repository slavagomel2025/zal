// Экспорт для агента, импорт рекомендаций и резервных копий.

export const SCHEMA_VERSION = 2;

export function collectNotes(sessions) {
  const notes = [];
  for (const session of sessions || []) {
    const date = (session.startedAt || '').slice(0, 10);
    if (session.note) {
      notes.push({
        sessionId: session.id,
        date,
        exerciseName: null,
        level: 'session',
        text: session.note
      });
    }
    for (const ex of session.exercises || []) {
      if (ex.note) {
        notes.push({
          sessionId: session.id,
          date,
          exerciseName: ex.name,
          level: 'exercise',
          text: ex.note
        });
      }
      for (const set of ex.sets || []) {
        if (set.note) {
          notes.push({
            sessionId: session.id,
            date,
            exerciseName: ex.name,
            level: 'set',
            text: set.note
          });
        }
      }
    }
  }
  return notes;
}

export function buildExport({ library, programs, activeProgramId, sessions, settings, recommendations }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'gym-timer',
    profile: { bodyWeightKg: settings.bodyWeightKg != null ? settings.bodyWeightKg : null },
    settings: { soundEnabled: settings.soundEnabled, soundMode: settings.soundMode, showRir: settings.showRir },
    library,
    programs,
    activeProgramId,
    sessions,
    notes: collectNotes(sessions),
    previousRecommendations: recommendations ? [recommendations] : []
  };
}

export function parseJson(text) {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: 'Это не JSON: ' + err.message };
  }
}

export function parseBackup(text) {
  const parsed = parseJson(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const data = parsed.data;
  if (!data || typeof data !== 'object') return { ok: false, error: 'В файле нет объекта' };
  if (!Array.isArray(data.sessions)) {
    return { ok: false, error: 'Нет поля sessions' };
  }

  const library = Array.isArray(data.library) ? data.library : Array.isArray(data.program) ? data.program : null;
  if (!library) return { ok: false, error: 'Нет библиотеки упражнений' };

  const programs = Array.isArray(data.programs) && data.programs.length
    ? data.programs
    : [{ id: 'p_restored', name: 'Восстановленный день', items: library.map((ex) => ({ exerciseId: ex.id, supersetGroup: null })) }];

  return {
    ok: true,
    backup: {
      schemaVersion: data.schemaVersion || SCHEMA_VERSION,
      library,
      programs,
      activeProgramId: data.activeProgramId || programs[0].id,
      sessions: data.sessions,
      settings: data.settings || {}
    }
  };
}

function normalizeTarget(target) {
  if (!target || typeof target !== 'object') return null;
  const result = {};
  if (Number.isFinite(target.weightKg)) result.weightKg = target.weightKg;
  if (Number.isFinite(target.reps)) result.reps = target.reps;
  if (Number.isFinite(target.restSec)) result.restSec = target.restSec;
  if (Number.isFinite(target.sets)) result.sets = target.sets;
  return Object.keys(result).length ? result : null;
}

export function parseRecommendations(text) {
  const parsed = parseJson(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const data = parsed.data;
  if (!data || typeof data !== 'object') return { ok: false, error: 'В файле нет объекта' };

  const rawItems = data.recommendations || data.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, error: 'Нет массива recommendations' };
  }

  const items = [];
  const errors = [];
  for (const raw of rawItems) {
    const name = raw.exerciseName || raw.name || '';
    const id = raw.exerciseId || '';
    const setTarget = normalizeTarget(raw.setTarget || raw.target);
    if (!name && !id) {
      errors.push('Пропущена рекомендация без названия упражнения');
      continue;
    }
    if (!setTarget) {
      errors.push(`Нет цифр в цели для «${name || id}»`);
      continue;
    }
    items.push({
      exerciseId: id || null,
      exerciseName: name || null,
      setTarget,
      reason: raw.reason || ''
    });
  }

  if (items.length === 0) return { ok: false, error: errors[0] || 'Нет валидных рекомендаций' };

  return {
    ok: true,
    errors,
    recommendation: {
      schemaVersion: data.schemaVersion || SCHEMA_VERSION,
      createdAt: data.createdAt || new Date().toISOString(),
      comment: data.comment || '',
      items,
      programChanges: data.programChanges || {}
    }
  };
}

export function previewRecommendations(library, recommendation) {
  return (recommendation.items || []).map((item) => {
    const exercise =
      library.find((e) => item.exerciseId && e.id === item.exerciseId) ||
      library.find(
        (e) => item.exerciseName && e.name.toLowerCase() === item.exerciseName.toLowerCase()
      );
    if (!exercise) {
      return { missing: true, name: item.exerciseName || item.exerciseId, reason: item.reason };
    }
    const first = exercise.sets[0] || { weightKg: 0, reps: 0, restSec: 0 };
    return {
      missing: false,
      exerciseId: exercise.id,
      name: exercise.name,
      before: {
        weightKg: first.weightKg,
        reps: first.reps,
        restSec: first.restSec,
        sets: exercise.sets.length
      },
      after: {
        weightKg: item.setTarget.weightKg != null ? item.setTarget.weightKg : first.weightKg,
        reps: item.setTarget.reps != null ? item.setTarget.reps : first.reps,
        restSec: item.setTarget.restSec != null ? item.setTarget.restSec : first.restSec,
        sets: item.setTarget.sets != null ? item.setTarget.sets : exercise.sets.length
      },
      reason: item.reason
    };
  });
}

export function applyRecommendations(library, recommendation) {
  let next = library.map((ex) => ({
    ...ex,
    warmupSets: (ex.warmupSets || []).map((w) => ({ ...w })),
    sets: (ex.sets || []).map((s) => ({ ...s }))
  }));
  const errors = [];
  const added = [];
  let applied = 0;

  for (const item of recommendation.items || []) {
    const exercise =
      next.find((e) => item.exerciseId && e.id === item.exerciseId) ||
      next.find(
        (e) => item.exerciseName && e.name.toLowerCase() === item.exerciseName.toLowerCase()
      );
    if (!exercise) {
      errors.push('Не найдено упражнение: ' + (item.exerciseName || item.exerciseId));
      continue;
    }
    const target = item.setTarget || {};
    const count = target.sets != null ? Math.max(1, Math.min(20, target.sets)) : exercise.sets.length;
    while (exercise.sets.length < count) {
      const last = exercise.sets[exercise.sets.length - 1];
      exercise.sets.push({ ...last });
    }
    if (exercise.sets.length > count) exercise.sets.length = count;
    exercise.sets = exercise.sets.map((s) => ({
      weightKg: target.weightKg != null ? target.weightKg : s.weightKg,
      reps: target.reps != null ? target.reps : s.reps,
      restSec: target.restSec != null ? target.restSec : s.restSec
    }));
    applied += 1;
  }

  const changes = recommendation.programChanges || {};
  if (Array.isArray(changes.addExercises)) {
    for (const raw of changes.addExercises) {
      if (!raw || !raw.name) continue;
      const id = raw.id || 'ex_' + Math.random().toString(36).slice(2, 8);
      next.push({
        id,
        name: raw.name,
        kind: raw.kind === 'accessory' ? 'accessory' : 'base',
        loadType: raw.loadType === 'bodyweight' ? 'bodyweight' : 'external',
        muscleGroup: raw.muscleGroup || '',
        stepKg: raw.stepKg,
        note: raw.note || '',
        warmupSets: Array.isArray(raw.warmupSets) ? raw.warmupSets : [],
        sets:
          Array.isArray(raw.sets) && raw.sets.length
            ? raw.sets
            : [{ weightKg: 20, reps: 8, restSec: 60 }],
        transitionRestSec: raw.transitionRestSec != null ? raw.transitionRestSec : 60
      });
      added.push(id);
    }
  }

  if (Array.isArray(changes.removeExerciseIds)) {
    next = next.filter((ex) => !changes.removeExerciseIds.includes(ex.id));
  }

  return { library: next, applied, errors, added };
}

export function exportFileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `zal-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}
