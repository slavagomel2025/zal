// Итоги тренировки: цифры и правка подходов.

import { formatDuration } from '../timer.js?v=11';
import { computeSummary, updateSet } from '../state.js?v=11';
import { esc, parseNumber } from '../util.js?v=11';

function restText(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}:${String(s).padStart(2, '0')}` : `${m} мин`;
}

function timeOf(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export const summaryScreen = {
  mount(el, props) {
    const { session, onChanged, onDone, onBack, onReport, title, doneLabel } = props;
    const date = new Date(session.startedAt).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long'
    });

    const exerciseBlocks = (session.exercises || [])
      .map((ex, ei) => {
        const warmups = (ex.warmupSets || [])
          .map(
            (w) => `
            <div class="set-line is-warmup">
              <span class="set-line-num">разм.</span>
              <span class="set-line-value">${w.planWeightKg} кг × ${w.planReps}</span>
              <span class="set-line-state">${w.status === 'done' ? 'сделано' : '—'}</span>
            </div>`
          )
          .join('');

        const sets = (ex.sets || [])
          .map(
            (s, si) => `
            <div class="set-line" data-line="${ei}:${si}">
              <span class="set-line-num">${s.index}</span>
              <input class="mini-input" inputmode="decimal" type="text"
                     data-ei="${ei}" data-ii="${si}" data-field="weight"
                     value="${s.actualWeightKg}" ${s.status === 'skipped' ? 'disabled' : ''}>
              <span class="set-line-x">×</span>
              <input class="mini-input" inputmode="numeric" type="text"
                     data-ei="${ei}" data-ii="${si}" data-field="reps"
                     value="${s.actualReps}" ${s.status === 'skipped' ? 'disabled' : ''}>
              <button class="btn-mini" data-skip="${ei}:${si}">
                ${s.status === 'skipped' ? 'вернуть' : 'пропуск'}
              </button>
            </div>`
          )
          .join('');

        return `
          <div class="card">
            <div class="label">${esc(ex.name)}${
              ex.kind === 'accessory' ? ' · вспомогательное' : ''
            }${ex.loadType === 'bodyweight' ? ' · свой вес' : ''}</div>
            ${
              ex.loadType === 'bodyweight'
                ? `<div class="list-sub">Вес тела ${session.bodyWeightKg != null ? session.bodyWeightKg + ' кг' : '—'} + отягощение. В тоннаж идёт сумма.</div>`
                : ''
            }
            ${warmups}
            ${sets}
          </div>`;
      })
      .join('');

    el.innerHTML = `
      <div class="topbar">
        <button class="btn-back" id="btn-back" aria-label="Назад">‹</button>
        <span>${esc(title || 'Итоги')}</span>
        <span>${date}</span>
      </div>
      <div class="card">
        <div class="sum-row"><span>Дата</span><b>${date}</b></div>
        <div class="sum-row"><span>Начало</span><b>${timeOf(session.startedAt)}</b></div>
        <div class="sum-row"><span>Конец</span><b>${timeOf(session.finishedAt)}</b></div>
        <div class="sum-row"><span>Время</span><b id="sum-duration">—</b></div>
        <div class="sum-row"><span>Тоннаж</span><b id="sum-tonnage">—</b></div>
        <div class="sum-row"><span>Подходы</span><b id="sum-sets">—</b></div>
        <div class="sum-row"><span>Повторы</span><b id="sum-reps">—</b></div>
        <div class="sum-row"><span>Средний отдых</span><b id="sum-rest">—</b></div>
      </div>
      <div class="card">
        <div class="label">Вес тела, кг</div>
        <input id="in-bw" class="num-input" inputmode="decimal" type="text"
               value="${session.bodyWeightKg ?? ''}" placeholder="—">
      </div>
      ${exerciseBlocks}
      <div class="card">
        <div class="label">Заметка к тренировке</div>
        <input id="in-note" class="note-input" type="text" placeholder="Самочувствие, боль, прочее"
               value="${esc(session.note || '')}">
      </div>
      <div class="spacer"></div>
      <button class="btn" id="btn-report">Отчёт для агента</button>
      <button class="btn btn-primary btn-big" id="btn-done">${esc(doneLabel || 'Готово')}</button>
    `;

    const paint = () => {
      const summary = computeSummary(session);
      el.querySelector('#sum-duration').textContent = formatDuration(
        session.durationSec || Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000)
      );
      el.querySelector('#sum-tonnage').textContent = `${summary.tonnageKg} кг`;
      el.querySelector('#sum-sets').textContent = String(summary.setsDone);
      el.querySelector('#sum-reps').textContent = String(summary.reps);
      el.querySelector('#sum-rest').textContent = restText(summary.avgRestSec);
    };
    paint();

    el.querySelectorAll('.mini-input').forEach((input) => {
      input.addEventListener('change', () => {
        const ei = Number(input.dataset.ei);
        const ii = Number(input.dataset.ii);
        const item = session.exercises[ei].sets[ii];
        const value = parseNumber(input.value);
        const patch = {};
        if (input.dataset.field === 'weight') patch.weightKg = value;
        else patch.reps = value != null ? Math.round(value) : null;
        updateSet(item, patch);
        item.edited = true;
        onChanged();
        paint();
      });
    });

    el.querySelectorAll('[data-skip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [ei, ii] = btn.dataset.skip.split(':').map(Number);
        const item = session.exercises[ei].sets[ii];
        updateSet(item, { skipped: item.status !== 'skipped' });
        onChanged();
        summaryScreen._rerender(el, props);
      });
    });

    const bwEl = el.querySelector('#in-bw');
    bwEl.addEventListener('change', () => {
      const bw = parseNumber(bwEl.value);
      session.bodyWeightKg = bw != null && bw > 0 ? bw : null;
      onChanged();
    });

    const noteEl = el.querySelector('#in-note');
    noteEl.addEventListener('input', () => {
      session.note = noteEl.value;
      onChanged();
    });

    el.querySelector('#btn-back').addEventListener('click', () => onBack());
    el.querySelector('#btn-done').addEventListener('click', () => onDone());
    if (onReport) {
      el.querySelector('#btn-report').addEventListener('click', () => onReport());
    } else {
      el.querySelector('#btn-report').remove();
    }
  },

  // Перерисовка при переключении «пропуск/вернуть», чтобы обновить поля.
  _rerender(el, props) {
    this.mount(el, props);
  },

  unmount() {}
};
