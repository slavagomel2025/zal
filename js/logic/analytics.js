// Аналитика: считаем всё из сохранённых тренировок, ничего не дублируем.

import { baseLoad } from '../state.js?v=10';

export function e1rm(weightKg, reps) {
  if (!weightKg || !reps) return 0;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export function sessionStats(session) {
  let tonnage = 0;
  let sets = 0;
  let reps = 0;
  let warmups = 0;
  let adjustments = 0;
  let skippedRests = 0;
  const rests = [];

  for (const ex of session.exercises || []) {
    const extra = baseLoad(session, ex);
    for (const w of ex.warmupSets || []) if (w.status === 'done') warmups += 1;
    for (const s of ex.sets || []) {
      if (s.status !== 'done') continue;
      sets += 1;
      reps += s.actualReps;
      tonnage += (extra + s.actualWeightKg) * s.actualReps;
      if (s.restSec > 0) rests.push(s.restSec);
      adjustments += (s.restAdjustments || []).length;
      if (s.restSkipped) skippedRests += 1;
    }
  }

  return {
    tonnageKg: Math.round(tonnage),
    sets,
    reps,
    warmups,
    adjustments,
    skippedRests,
    durationSec: session.durationSec || 0,
    avgRestSec: rests.length ? Math.round(rests.reduce((a, b) => a + b, 0) / rests.length) : 0
  };
}

export function finishedSessions(sessions) {
  return (sessions || [])
    .filter((s) => s && s.status === 'finished')
    .slice()
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
}

export function mondayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const iso = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - iso);
  return d;
}

export function withinPeriod(sessions, days) {
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);
  return finishedSessions(sessions).filter(
    (s) => new Date(s.startedAt).getTime() >= from.getTime()
  );
}

export function weeklyTonnage(sessions, weeks = 8) {
  const list = finishedSessions(sessions);
  const currentMonday = mondayOf(new Date());
  const buckets = [];

  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(currentMonday);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    let tonnage = 0;
    let count = 0;
    for (const s of list) {
      const t = new Date(s.startedAt).getTime();
      if (t >= start.getTime() && t < end.getTime()) {
        tonnage += sessionStats(s).tonnageKg;
        count += 1;
      }
    }
    buckets.push({
      label: `${start.getDate()}.${String(start.getMonth() + 1).padStart(2, '0')}`,
      tonnageKg: tonnage,
      sessions: count
    });
  }
  return buckets;
}

export function exerciseSeries(sessions, exerciseId, limit = 12) {
  const points = [];
  for (const session of finishedSessions(sessions)) {
    const ex = (session.exercises || []).find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    const extra = baseLoad(session, ex);
    const done = (ex.sets || []).filter((s) => s.status === 'done');
    if (done.length === 0) continue;
    const total = (s) => extra + s.actualWeightKg;
    const best = done.reduce((a, b) => (total(b) > total(a) ? b : a));
    const tonnage = done.reduce((sum, s) => sum + total(s) * s.actualReps, 0);
    const bestE1rm = done.reduce((max, s) => Math.max(max, e1rm(total(s), s.actualReps)), 0);
    points.push({
      date: session.startedAt,
      label: new Date(session.startedAt).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: '2-digit'
      }),
      bestWeightKg: total(best),
      bestReps: best.actualReps,
      tonnageKg: Math.round(tonnage),
      e1rm: bestE1rm
    });
  }
  return points.slice(-limit);
}

export function records(sessions) {
  const map = new Map();

  for (const session of finishedSessions(sessions)) {
    for (const ex of session.exercises || []) {
      const extra = baseLoad(session, ex);
      const done = (ex.sets || []).filter((s) => s.status === 'done');
      if (done.length === 0) continue;
      const key = ex.exerciseId || ex.name;
      const entry = map.get(key) || {
        exerciseId: ex.exerciseId,
        name: ex.name,
        bestWeightKg: 0,
        bestWeightReps: 0,
        bestE1rm: 0,
        bestTonnageKg: 0,
        date: null
      };
      for (const s of done) {
        const total = extra + s.actualWeightKg;
        if (total > entry.bestWeightKg) {
          entry.bestWeightKg = total;
          entry.bestWeightReps = s.actualReps;
          entry.date = session.startedAt;
        }
        entry.bestE1rm = Math.max(entry.bestE1rm, e1rm(total, s.actualReps));
      }
      const tonnage = Math.round(
        done.reduce((sum, s) => sum + (extra + s.actualWeightKg) * s.actualReps, 0)
      );
      if (tonnage > entry.bestTonnageKg) {
        entry.bestTonnageKg = tonnage;
        entry.date = entry.date || session.startedAt;
      }
      map.set(key, entry);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.bestWeightKg - a.bestWeightKg);
}

export function bodyWeightSeries(sessions, limit = 12) {
  return finishedSessions(sessions)
    .filter((s) => s.bodyWeightKg)
    .map((s) => ({ date: s.startedAt, kg: s.bodyWeightKg }))
    .slice(-limit);
}

export function frequencyStats(sessions) {
  const list = finishedSessions(sessions);
  const now = Date.now();
  const week = 7 * 24 * 3600 * 1000;
  const last7 = list.filter((s) => now - new Date(s.startedAt).getTime() <= week).length;
  const last28 = list.filter((s) => now - new Date(s.startedAt).getTime() <= 4 * week).length;
  return { last7, perWeek: Math.round((last28 / 4) * 10) / 10, total: list.length };
}

export function buildHints(sessions) {
  const hints = [];
  const list = finishedSessions(sessions);

  // Застой по весу: три последние тренировки с одинаковым лучшим весом.
  const byExercise = new Map();
  for (const session of list) {
    for (const ex of session.exercises || []) {
      const done = (ex.sets || []).filter((s) => s.status === 'done');
      if (!done.length) continue;
      const best = Math.max(...done.map((s) => s.actualWeightKg));
      const key = ex.exerciseId || ex.name;
      if (!byExercise.has(key)) byExercise.set(key, { name: ex.name, weights: [] });
      byExercise.get(key).weights.push(best);
    }
  }
  for (const entry of byExercise.values()) {
    const last = entry.weights.slice(-3);
    if (last.length === 3 && last[0] === last[1] && last[1] === last[2]) {
      hints.push({ kind: 'stall', text: `${entry.name}: три тренировки без прибавки веса` });
    }
  }

  // Пропущенные подходы.
  let planned = 0;
  let skipped = 0;
  let edited = 0;
  let painNotes = 0;
  for (const session of list) {
    for (const ex of session.exercises || []) {
      for (const s of ex.sets || []) {
        planned += 1;
        if (s.status === 'skipped') skipped += 1;
        if (s.edited) edited += 1;
      }
      if (ex.note && /бол|травм|ноет|хруст|жжёт|жжет/i.test(ex.note)) painNotes += 1;
    }
    if (session.note && /бол|травм|ноет|плохо|устал/i.test(session.note)) painNotes += 1;
  }
  if (planned > 0 && skipped / planned > 0.2) {
    hints.push({
      kind: 'skip',
      text: `Пропущено ${Math.round((skipped / planned) * 100)}% подходов — программа может быть слишком тяжёлой`
    });
  }
  if (planned > 0 && edited / planned > 0.1) {
    hints.push({
      kind: 'edits',
      text: `Много ручных правок (${Math.round((edited / planned) * 100)}%) — цели стоит подстроить`
    });
  }
  if (painNotes > 0) {
    hints.push({
      kind: 'pain',
      text: 'В заметках есть жалобы на боль — обсуди с агентом и проверь технику'
    });
  }

  const bw = bodyWeightSeries(list);
  if (bw.length >= 3) {
    const first = bw[0].kg;
    const last = bw[bw.length - 1].kg;
    if (last - first >= 2) {
      hints.push({ kind: 'bw', text: `Вес тела +${(last - first).toFixed(1)} кг — следи, чтобы рост шёл не только за счёт жира` });
    }
  }

  return hints;
}

export function buildAnalysis(sessions, options = {}) {
  const periodDays = options.periodDays || 28;
  const period = withinPeriod(sessions, periodDays);
  const all = finishedSessions(sessions);

  const totals = period.reduce(
    (acc, s) => {
      const stats = sessionStats(s);
      acc.tonnageKg += stats.tonnageKg;
      acc.sets += stats.sets;
      acc.reps += stats.reps;
      acc.durationSec += stats.durationSec;
      return acc;
    },
    { tonnageKg: 0, sets: 0, reps: 0, durationSec: 0 }
  );

  const exerciseIds = new Set();
  for (const s of all) {
    for (const ex of s.exercises || []) exerciseIds.add(ex.exerciseId);
  }

  const perExercise = Array.from(exerciseIds).map((id) => {
    const series = exerciseSeries(all, id);
    const last = series[series.length - 1] || null;
    return {
      exerciseId: id,
      name: last ? (all.find((s) => (s.exercises || []).some((e) => e.exerciseId === id)).exercises.find((e) => e.exerciseId === id).name) : id,
      series,
      last
    };
  });

  return {
    periodDays,
    sessionsCount: period.length,
    totals: {
      tonnageKg: totals.tonnageKg,
      sessions: period.length,
      sets: totals.sets,
      reps: totals.reps,
      durationSec: totals.durationSec,
      avgSessionSec: period.length ? Math.round(totals.durationSec / period.length) : 0
    },
    weekly: weeklyTonnage(sessions),
    records: records(sessions),
    bodyWeight: bodyWeightSeries(sessions),
    frequency: frequencyStats(sessions),
    perExercise,
    hints: buildHints(sessions)
  };
}
