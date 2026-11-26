// Прогрессия: считаем следующую цель по упражнению на основе истории.
//
// Правило (утверждено):
// 1. Все рабочие подходы закрыты по цели → +шаг (2,5 кг базовое / 1 кг вспомогательное).
// 2. Недобор 2+ повтора в 1-м или 2-м подходе → откат к весу, на котором
//    упражнение закрывалось полностью (нет истории — минус шаг).
// 3. Всё остальное → вес держим, пока не закроем все подходы.

const EPS = 0.001;

export function roundKg(value) {
  return Math.round(value * 100) / 100;
}

export function finishedHistory(sessions, exerciseId) {
  return (sessions || [])
    .filter((s) => s && s.status === 'finished')
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt))
    .map((s) => ({
      session: s,
      ex: (s.exercises || []).find((e) => e.exerciseId === exerciseId)
    }))
    .filter((entry) => entry.ex);
}

export function isFullyClosed(ex) {
  const sets = ex.sets || [];
  const done = sets.filter((s) => s.status === 'done');
  if (done.length === 0 || done.length !== sets.length) return false;
  return done.every(
    (s) => s.actualReps >= s.planReps && s.actualWeightKg + EPS >= s.planWeightKg
  );
}

export function lastClosedWeight(history) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const ex = history[i].ex;
    if (isFullyClosed(ex)) {
      return roundKg(ex.sets[0].planWeightKg);
    }
  }
  return null;
}

export function stepFor(exercise) {
  if (exercise.stepKg != null && exercise.stepKg > 0) return exercise.stepKg;
  return exercise.kind === 'accessory' ? 1 : 2.5;
}

export function computeNextTarget(exercise, sessions) {
  const step = stepFor(exercise);
  const baseSet = (exercise.sets && exercise.sets[0]) || { weightKg: 20, reps: 8 };
  const history = finishedHistory(sessions, exercise.id);

  if (history.length === 0) {
    return {
      action: 'first',
      weightKg: baseSet.weightKg,
      reps: baseSet.reps,
      stepKg: step,
      reason: 'Первая тренировка — цель из программы'
    };
  }

  const last = history[history.length - 1].ex;
  const first = last.sets[0] || baseSet;
  const currentWeight = roundKg(first.planWeightKg);
  const currentReps = first.planReps;

  if (isFullyClosed(last)) {
    return {
      action: 'up',
      weightKg: roundKg(currentWeight + step),
      reps: currentReps,
      stepKg: step,
      reason: `Все подходы закрыты по ${currentReps} — +${step} кг`
    };
  }

  const done = last.sets.filter((s) => s.status === 'done');
  let missIndex = -1;
  for (let i = 0; i < done.length; i += 1) {
    if (
      done[i].actualReps < done[i].planReps ||
      done[i].actualWeightKg + EPS < done[i].planWeightKg
    ) {
      missIndex = i;
      break;
    }
  }

  const deficit = missIndex >= 0 ? done[missIndex].planReps - done[missIndex].actualReps : 0;

  if (missIndex >= 0 && missIndex <= 1 && deficit >= 2) {
    const previous = lastClosedWeight(history.slice(0, -1));
    const fallback = roundKg(Math.max(step, currentWeight - step));
    return {
      action: 'rollback',
      weightKg: previous != null ? previous : fallback,
      reps: currentReps,
      stepKg: step,
      reason: `Недобор ${deficit} повтора в подходе ${missIndex + 1} — откат к рабочему весу`
    };
  }

  return {
    action: 'hold',
    weightKg: currentWeight,
    reps: currentReps,
    stepKg: step,
    reason: 'Цель не закрыта полностью — вес держим'
  };
}

function findRecommendation(recommendation, exercise) {
  if (!recommendation || !Array.isArray(recommendation.items)) return null;
  return (
    recommendation.items.find((item) => item.exerciseId && item.exerciseId === exercise.id) ||
    recommendation.items.find(
      (item) => item.exerciseName && item.exerciseName.toLowerCase() === exercise.name.toLowerCase()
    ) ||
    null
  );
}

// Итоговые цели перед тренировкой: рекомендация агента важнее автоматики.
export function resolveTargets(program, sessions, recommendation) {
  const result = {};
  for (const exercise of program) {
    const auto = computeNextTarget(exercise, sessions);
    const rec = findRecommendation(recommendation, exercise);
    const fallbackRest = (exercise.sets[0] && exercise.sets[0].restSec) || 60;
    if (rec && rec.setTarget) {
      result[exercise.id] = {
        weightKg: rec.setTarget.weightKg != null ? rec.setTarget.weightKg : auto.weightKg,
        reps: rec.setTarget.reps != null ? rec.setTarget.reps : auto.reps,
        restSec: rec.setTarget.restSec != null ? rec.setTarget.restSec : fallbackRest,
        setCount: rec.setTarget.sets != null ? rec.setTarget.sets : exercise.sets.length,
        source: 'agent',
        action: 'agent',
        reason: rec.reason || 'Рекомендация агента'
      };
    } else {
      result[exercise.id] = {
        weightKg: auto.weightKg,
        reps: auto.reps,
        restSec: fallbackRest,
        setCount: exercise.sets.length,
        source: 'auto',
        action: auto.action,
        reason: auto.reason
      };
    }
  }
  return result;
}
