// Анализ: метрики с тумблерами, недели, рекорды, прогресс.

import { buildAnalysis, sessionStats } from '../logic/analytics.js?v=11';
import { formatDuration } from '../timer.js?v=11';
import { esc } from '../util.js?v=11';

const METRICS = [
  ['tonnage', 'Тоннаж'],
  ['weekly', 'По неделям'],
  ['sets', 'Подходы'],
  ['duration', 'Время'],
  ['rest', 'Отдых'],
  ['e1rm', '1ПМ'],
  ['prs', 'Рекорды'],
  ['progress', 'Прогресс'],
  ['frequency', 'Частота'],
  ['bodyWeight', 'Вес тела']
];

const PERIODS = [
  [28, '4 недели'],
  [90, '3 месяца'],
  [3650, 'всё время']
];

function sparkline(values) {
  if (!values || values.length < 2) return '';
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 28 - ((v - min) / span) * 24;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return `<svg class="spark" viewBox="0 0 100 32" preserveAspectRatio="none"><polyline points="${points}" /></svg>`;
}

function bars(weekly) {
  const max = Math.max(1, ...weekly.map((w) => w.tonnageKg));
  return weekly
    .map(
      (w) => `
      <div class="bar-row">
        <span class="bar-label">${w.label}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${Math.round(
          (w.tonnageKg / max) * 100
        )}%"></span></span>
        <span class="bar-value">${w.tonnageKg}</span>
      </div>`
    )
    .join('');
}

export const analysisScreen = {
  mount(el, props) {
    const { sessions, settings, periodDays, onPeriod, onToggle, onBack } = props;
    const data = buildAnalysis(sessions, { periodDays });
    const on = settings.analysis || {};

    const periodChips = PERIODS.map(
      ([days, label]) =>
        `<button class="chip ${days === periodDays ? 'is-on' : ''}" data-period="${days}">${label}</button>`
    ).join('');

    const metricChips = METRICS.map(
      ([key, label]) =>
        `<button class="chip ${on[key] !== false ? 'is-on' : ''}" data-metric="${key}">${label}</button>`
    ).join('');

    const records = data.records
      .map(
        (r) => `
      <div class="sum-row">
        <span>${esc(r.name)}</span>
        <b>${r.bestWeightKg} кг × ${r.bestWeightReps} · 1ПМ ${r.bestE1rm}</b>
      </div>`
      )
      .join('');

    const progress = data.perExercise
      .filter((ex) => ex.series.length > 0)
      .map((ex) => {
        const weights = ex.series.map((p) => p.bestWeightKg);
        const last = ex.series[ex.series.length - 1];
        return `
        <div class="progress-row">
          <div class="progress-head">
            <span class="list-title">${esc(ex.name)}</span>
            <span class="list-sub">${last.bestWeightKg} кг × ${last.bestReps} · тоннаж ${last.tonnageKg} кг</span>
          </div>
          ${sparkline(weights)}
        </div>`;
      })
      .join('');

    const weights = data.bodyWeight.map((p) => p.kg);
    const hints = data.hints
      .map((h) => `<div class="hint">${esc(h.text)}</div>`)
      .join('');

    const avgRest = data.sessionsCount
      ? Math.round(
          sessions
            .filter((s) => data.totals && s.status === 'finished')
            .slice(-data.sessionsCount)
            .reduce((sum, s) => sum + sessionStats(s).avgRestSec, 0) / data.sessionsCount
        )
      : 0;

    el.innerHTML = `
      <div class="topbar">
        <button class="btn-back" id="btn-back" aria-label="Назад">‹</button>
        <span>Анализ</span>
        <span>${data.sessionsCount} тренировок</span>
      </div>
      <div class="chips">${periodChips}</div>
      <div class="chips">${metricChips}</div>

      ${on.tonnage !== false
        ? `<div class="card">
            <div class="label">Тоннаж за период</div>
            <div class="big-number">${data.totals.tonnageKg} <span>кг</span></div>
            <div class="list-sub">${data.sessionsCount} тренировок · ${data.totals.sets} подходов · ${data.totals.reps} повторов</div>
          </div>`
        : ''}

      ${on.weekly !== false
        ? `<div class="card">
            <div class="label">Тоннаж по неделям</div>
            ${bars(data.weekly)}
          </div>`
        : ''}

      ${on.duration !== false
        ? `<div class="card">
            <div class="sum-row"><span>Средняя тренировка</span><b>${formatDuration(data.totals.avgSessionSec)}</b></div>
            <div class="sum-row"><span>Всего за период</span><b>${formatDuration(data.totals.durationSec)}</b></div>
          </div>`
        : ''}

      ${on.rest !== false
        ? `<div class="card">
            <div class="sum-row"><span>Средний отдых</span><b>${formatDuration(avgRest)}</b></div>
          </div>`
        : ''}

      ${on.frequency !== false
        ? `<div class="card">
            <div class="sum-row"><span>За последние 7 дней</span><b>${data.frequency.last7}</b></div>
            <div class="sum-row"><span>В среднем за неделю</span><b>${data.frequency.perWeek}</b></div>
            <div class="sum-row"><span>Всего тренировок</span><b>${data.frequency.total}</b></div>
          </div>`
        : ''}

      ${(on.e1rm !== false || on.prs !== false) && records
        ? `<div class="card"><div class="label">Рекорды</div>${records}</div>`
        : ''}

      ${on.progress !== false && progress
        ? `<div class="card"><div class="label">Прогресс по упражнениям</div>${progress}</div>`
        : ''}

      ${on.bodyWeight !== false && weights.length
        ? `<div class="card">
            <div class="label">Вес тела</div>
            ${sparkline(weights)}
            <div class="list-sub">${data.bodyWeight[0].kg} → ${weights[weights.length - 1]} кг</div>
          </div>`
        : ''}

      ${hints ? `<div class="card"><div class="label">Что улучшить</div>${hints}</div>` : ''}
    `;

    el.querySelector('#btn-back').addEventListener('click', () => onBack());
    el.querySelectorAll('[data-period]').forEach((btn) => {
      btn.addEventListener('click', () => onPeriod(Number(btn.dataset.period)));
    });
    el.querySelectorAll('[data-metric]').forEach((btn) => {
      btn.addEventListener('click', () => onToggle(btn.dataset.metric));
    });
  },
  unmount() {}
};
