// Отчёт по одной тренировке: для агента и для «поделиться».

import { sessionStats } from './analytics.js?v=10';
import { formatDuration } from '../timer.js?v=10';

export const REPORT_VERSION = 1;

function hhmm(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function dateRu(iso) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export function buildSessionReport(session) {
  const stats = sessionStats(session);
  return {
    schemaVersion: 2,
    kind: 'session-report',
    reportVersion: REPORT_VERSION,
    exportedAt: new Date().toISOString(),
    profile: { bodyWeightKg: session.bodyWeightKg != null ? session.bodyWeightKg : null },
    session: {
      id: session.id,
      date: (session.startedAt || '').slice(0, 10),
      startedAt: session.startedAt || null,
      finishedAt: session.finishedAt || null,
      startTime: hhmm(session.startedAt),
      endTime: hhmm(session.finishedAt),
      durationSec: session.durationSec || 0,
      bodyWeightKg: session.bodyWeightKg != null ? session.bodyWeightKg : null,
      note: session.note || '',
      exercises: (session.exercises || []).map((ex) => ({
        exerciseId: ex.exerciseId,
        name: ex.name,
        kind: ex.kind,
        loadType: ex.loadType || 'external',
        supersetGroup: ex.supersetGroup != null ? ex.supersetGroup : null,
        note: ex.note || '',
        warmupSets: (ex.warmupSets || []).map((w) => ({
          weightKg: w.actualWeightKg,
          reps: w.actualReps,
          status: w.status
        })),
        sets: (ex.sets || []).map((s) => ({
          index: s.index,
          planWeightKg: s.planWeightKg,
          planReps: s.planReps,
          weightKg: s.actualWeightKg,
          reps: s.actualReps,
          status: s.status,
          edited: Boolean(s.edited),
          rir: s.rir != null ? s.rir : null,
          note: s.note || ''
        }))
      }))
    },
    totals: {
      tonnageKg: stats.tonnageKg,
      sets: stats.sets,
      reps: stats.reps,
      warmups: stats.warmups,
      avgRestSec: stats.avgRestSec,
      adjustments: stats.adjustments,
      skippedRests: stats.skippedRests,
      durationSec: stats.durationSec
    }
  };
}

export function reportText(report) {
  const s = report.session;
  const t = report.totals;
  const lines = [];

  lines.push(`Тренировка: ${dateRu(s.startedAt)}`);
  lines.push(
    `Начало: ${s.startTime || '—'} · Конец: ${s.endTime || '—'} · Длительность: ${formatDuration(
      s.durationSec
    )}`
  );
  if (s.bodyWeightKg) lines.push(`Вес тела: ${s.bodyWeightKg} кг`);
  lines.push(
    `Тоннаж: ${t.tonnageKg} кг · Подходы: ${t.sets} · Повторы: ${t.reps} · Средний отдых: ${formatDuration(
      t.avgRestSec
    )}`
  );

  for (const ex of s.exercises) {
    lines.push('');
    const flags = [];
    if (ex.supersetGroup != null) flags.push('блок');
    if (ex.kind === 'accessory') flags.push('вспомогательное');
    if (ex.loadType === 'bodyweight') flags.push('свой вес');
    lines.push(ex.name + (flags.length ? ' (' + flags.join(', ') + ')' : ''));

    const warmups = ex.warmupSets.filter((w) => w.status === 'done');
    if (warmups.length) {
      lines.push('  разминка: ' + warmups.map((w) => `${w.weightKg} × ${w.reps}`).join(', '));
    }

    for (const set of ex.sets) {
      if (set.status === 'skipped') {
        lines.push(`  ${set.index}) пропущен`);
        continue;
      }
      if (set.status !== 'done') continue;
      const extra = [];
      if (set.rir != null) extra.push(`RIR ${set.rir}`);
      if (set.edited) extra.push('правка');
      lines.push(
        `  ${set.index}) ${set.weightKg} кг × ${set.reps}${extra.length ? ' (' + extra.join(', ') + ')' : ''}`
      );
    }
    if (ex.note) lines.push(`  заметка: ${ex.note}`);
  }

  if (s.note) {
    lines.push('');
    lines.push(`Заметка к тренировке: ${s.note}`);
  }

  return lines.join('\n').trim();
}

export function reportFileName(session) {
  const date = (session.startedAt || '').slice(0, 10);
  return `trenirovka-${date}.json`;
}
