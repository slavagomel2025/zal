// Состояние приложения и операции с тренировкой. Без DOM — тестируется в Node.

export const state = {
  session: null,
  library: [],
  programs: [],
  activeProgramId: null,
  settings: null,
  sessions: [],
  recommendations: null
};

function isoNow() {
  return new Date().toISOString();
}

function emptySet(index, plan) {
  return {
    index,
    planWeightKg: plan.weightKg,
    planReps: plan.reps,
    actualWeightKg: plan.weightKg,
    actualReps: plan.reps,
    restSec: plan.restSec,
    status: 'pending',
    restAdjustments: [],
    restSkipped: false,
    rir: null,
    note: '',
    loggedAt: null,
    edited: false
  };
}

function planFor(ex, target, i, fallback) {
  const base = ex.sets[i] || ex.sets[ex.sets.length - 1] || fallback;
  return {
    weightKg: target.weightKg != null ? target.weightKg : base.weightKg,
    reps: target.reps != null ? target.reps : base.reps,
    restSec: target.restSec != null ? target.restSec : base.restSec
  };
}

// programExercises — уже собранные упражнения выбранной программы
// (копии из библиотеки с полем supersetGroup).
export function newSession(programExercises, bodyWeightKg = null, targets = {}) {
  const now = new Date();
  const fallback = { weightKg: 20, reps: 10, restSec: 60 };

  return {
    id: 's_' + now.toISOString().slice(0, 19),
    startedAt: now.toISOString(),
    finishedAt: null,
    durationSec: null,
    bodyWeightKg,
    status: 'active',
    note: '',
    exercises: programExercises.map((ex, i) => {
      const target = targets[ex.id] || {};
      const setCount = Math.max(1, Math.min(20, target.setCount || (ex.sets ? ex.sets.length : 1)));
      const sets = [];
      for (let si = 0; si < setCount; si += 1) {
        sets.push(emptySet(si + 1, planFor(ex, target, si, fallback)));
      }
      return {
        exerciseId: ex.id,
        name: ex.name,
        kind: ex.kind,
        loadType: ex.loadType === 'bodyweight' ? 'bodyweight' : 'external',
        muscleGroup: ex.muscleGroup || '',
        order: i + 1,
        supersetGroup: ex.supersetGroup != null ? ex.supersetGroup : null,
        stepKg: ex.stepKg,
        transitionRestSec: ex.transitionRestSec,
        note: '',
        warmupSets: (ex.warmupSets || []).map((w, wi) =>
          emptySet(wi + 1, {
            weightKg: w.weightKg,
            reps: w.reps,
            restSec: w.restSec != null ? w.restSec : 60
          })
        ),
        sets
      };
    })
  };
}

// Порядок выполнения: сначала все разминки, потом рабочие подходы.
// Упражнения с одинаковым supersetGroup чередуются по кругам.
export function buildOrder(session) {
  const order = [];
  const exercises = session.exercises || [];

  exercises.forEach((ex, ei) => {
    (ex.warmupSets || []).forEach((item, ii) => {
      order.push({ ei, kind: 'warmup', ii });
    });
  });

  let i = 0;
  while (i < exercises.length) {
    const ex = exercises[i];
    const group = ex.supersetGroup;
    if (group == null) {
      (ex.sets || []).forEach((item, ii) => {
        order.push({ ei: i, kind: 'set', ii });
      });
      i += 1;
      continue;
    }

    const members = [];
    while (i < exercises.length && exercises[i].supersetGroup === group) {
      members.push(i);
      i += 1;
    }
    const maxSets = Math.max(...members.map((m) => exercises[m].sets.length));
    for (let round = 0; round < maxSets; round += 1) {
      for (const ei of members) {
        if (round < exercises[ei].sets.length) {
          order.push({ ei, kind: 'set', ii: round });
        }
      }
    }
  }

  return order;
}

// Первый незакрытый элемент в порядке выполнения.
export function findNext(session) {
  const order = buildOrder(session);
  for (const slot of order) {
    const ex = session.exercises[slot.ei];
    const item = slot.kind === 'warmup' ? ex.warmupSets[slot.ii] : ex.sets[slot.ii];
    if (item && item.status === 'pending') {
      return { ...slot, ex, item };
    }
  }
  return null;
}

export function logSet(item, weightKg, reps, extra = {}) {
  item.actualWeightKg = weightKg;
  item.actualReps = reps;
  item.status = 'done';
  item.loggedAt = isoNow();
  item.edited = weightKg !== item.planWeightKg || reps !== item.planReps;
  if (extra.rir != null) item.rir = extra.rir;
  if (extra.note != null) item.note = extra.note;
}

export function skipItem(item) {
  item.status = 'skipped';
  item.loggedAt = isoNow();
}

export function workingSets(ex) {
  return (ex.sets || []).filter((s) => s.status === 'done');
}

// Для упражнений со своим весом в поле веса хранится только отягощение,
// а итоговая нагрузка = вес тела + отягощение.
export function baseLoad(session, ex) {
  return ex && ex.loadType === 'bodyweight' ? session.bodyWeightKg || 0 : 0;
}

export function setTotalWeight(session, ex, item) {
  return baseLoad(session, ex) + (item.actualWeightKg || 0);
}

export function computeSummary(session) {
  const result = {
    tonnageKg: 0,
    setsDone: 0,
    reps: 0,
    warmupDone: 0,
    avgRestSec: 0,
    adjustments: 0,
    skippedRests: 0
  };
  const rests = [];

  for (const ex of session.exercises || []) {
    const extra = baseLoad(session, ex);
    for (const w of ex.warmupSets || []) {
      if (w.status === 'done') result.warmupDone += 1;
    }
    for (const s of ex.sets || []) {
      if (s.status !== 'done') continue;
      result.setsDone += 1;
      result.reps += s.actualReps;
      result.tonnageKg += (extra + s.actualWeightKg) * s.actualReps;
      if (s.restSec > 0) rests.push(s.restSec);
      result.adjustments += (s.restAdjustments || []).length;
      if (s.restSkipped) result.skippedRests += 1;
    }
  }

  result.tonnageKg = Math.round(result.tonnageKg);
  result.avgRestSec = rests.length
    ? Math.round(rests.reduce((sum, v) => sum + v, 0) / rests.length)
    : 0;
  return result;
}

export function finishSession(session) {
  const end = new Date();
  session.finishedAt = end.toISOString();
  session.durationSec = Math.max(
    0,
    Math.round((end.getTime() - new Date(session.startedAt).getTime()) / 1000)
  );
  session.status = 'finished';
  return session;
}

export function elapsedSec(session) {
  if (!session) return 0;
  const end = session.finishedAt ? new Date(session.finishedAt).getTime() : Date.now();
  return Math.max(0, Math.round((end - new Date(session.startedAt).getTime()) / 1000));
}

export function updateSet(item, patch) {
  if (patch.weightKg != null && Number.isFinite(patch.weightKg) && patch.weightKg > 0) {
    item.actualWeightKg = patch.weightKg;
  }
  if (patch.reps != null && Number.isFinite(patch.reps) && patch.reps >= 0) {
    item.actualReps = patch.reps;
  }
  if (patch.skipped === true) item.status = 'skipped';
  if (patch.skipped === false && item.status === 'skipped') {
    item.status = 'done';
    item.actualWeightKg = item.actualWeightKg || item.planWeightKg;
    item.actualReps = item.actualReps || item.planReps;
    item.loggedAt = item.loggedAt || isoNow();
  }
  item.edited = true;
}

export function addSet(ex, template) {
  const last = ex.sets[ex.sets.length - 1] || { planWeightKg: 20, planReps: 8, restSec: 60 };
  const plan = {
    weightKg: template ? template.weightKg : last.planWeightKg,
    reps: template ? template.reps : last.planReps,
    restSec: template ? template.restSec : last.restSec
  };
  ex.sets.push(emptySet(ex.sets.length + 1, plan));
  return ex.sets[ex.sets.length - 1];
}

export function removeSet(ex, index) {
  if (ex.sets.length <= 1) return false;
  ex.sets.splice(index, 1);
  ex.sets.forEach((s, i) => {
    s.index = i + 1;
  });
  return true;
}
