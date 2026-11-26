// Экран тренировки: старт (какой день и план) и ввод подхода.

import { formatDuration } from '../timer.js?v=10';
import { esc, parseNumber, BUILD } from '../util.js?v=10';

let cleanup = null;

function restLabel(sec) {
  if (!sec) return 'без отдыха';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}:${String(s).padStart(2, '0')}` : `${m} мин`;
}

export const startScreen = {
  mount(el, props) {
    const {
      programs,
      activeProgramId,
      exercises,
      targets,
      lastBodyWeight,
      onStart,
      onNav,
      onSelectProgram
    } = props;

    const chips = (programs || [])
      .map(
        (p) =>
          `<button class="chip ${p.id === activeProgramId ? 'is-on' : ''}" data-program="${esc(
            p.id
          )}">${esc(p.name)}</button>`
      )
      .join('');

    const rows = (exercises || [])
      .map((ex) => {
        const target = targets[ex.id] || {};
        const count = target.setCount || ex.sets.length;
        const weight = ex.loadType === 'bodyweight' ? `+${target.weightKg} кг` : `${target.weightKg} кг`;
        const plan = `${count} × ${target.reps} · ${weight} · отдых ${restLabel(target.restSec)}`;
        const chip =
          target.source === 'agent'
            ? '<span class="chip chip-agent">агент</span>'
            : '<span class="chip">авто</span>';
        const block =
          ex.supersetGroup != null ? '<span class="chip chip-block">блок</span>' : '';
        return `
          <div class="ex-row">
            <div class="ex-row-head">
              <div class="ex-row-name">${esc(ex.name)}</div>
              ${block}${chip}
            </div>
            <div class="ex-row-plan">${plan}</div>
            <div class="ex-row-reason">${esc(target.reason || '')}</div>
          </div>`;
      })
      .join('');

    el.innerHTML = `
      <div class="topbar"><span>Зал</span><span>v${BUILD}</span></div>
      <nav class="nav">
        <button class="nav-btn" data-nav="programs">Программы</button>
        <button class="nav-btn" data-nav="history">История</button>
        <button class="nav-btn" data-nav="analysis">Анализ</button>
        <button class="nav-btn" data-nav="settings">Настройки</button>
      </nav>
      <div class="chips">${chips}</div>
      <div class="card">
        <div class="label">Вес тела, кг</div>
        <input id="in-bw" class="num-input" inputmode="decimal" type="text"
               value="${lastBodyWeight ?? ''}" placeholder="—">
      </div>
      <div class="card">
        <div class="label">План на тренировку</div>
        ${rows || '<div class="empty">В этом дне нет упражнений — добавь в «Программах»</div>'}
      </div>
      <div class="spacer"></div>
      <button class="btn btn-primary btn-big" id="btn-start">Начать тренировку</button>
    `;

    el.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => onNav(btn.dataset.nav));
    });
    el.querySelectorAll('[data-program]').forEach((btn) => {
      btn.addEventListener('click', () => onSelectProgram(btn.dataset.program));
    });

    el.querySelector('#btn-start').addEventListener('click', () => {
      if (!exercises || !exercises.length) {
        onNav('programs');
        return;
      }
      const bw = parseNumber(el.querySelector('#in-bw').value);
      onStart(bw != null && bw > 0 ? bw : null);
    });
  },
  unmount() {}
};

export const setScreen = {
  mount(el, props) {
    const {
      ex,
      item,
      kind,
      si,
      total,
      startedAt,
      showRir,
      bodyWeightKg,
      superset,
      onLog,
      onSkip,
      onNote
    } = props;
    const isWarmup = kind === 'warmup';
    const isBodyweight = ex.loadType === 'bodyweight';
    const title = isWarmup ? 'Разминка' : 'Подход';
    const targetText = isBodyweight
      ? `+${item.planWeightKg} кг × ${item.planReps}`
      : `${item.planWeightKg} кг × ${item.planReps}`;

    const badge = isWarmup
      ? '<div class="badge">разминка</div>'
      : superset
        ? `<div class="badge">блок · круг ${superset.round} из ${superset.rounds}</div>`
        : '';

    el.innerHTML = `
      <div class="topbar">
        <span>${esc(ex.name)}</span>
        <span id="elapsed">0:00</span>
      </div>
      <div class="set-head">
        ${badge}
        <div class="set-num">${title} ${si + 1} из ${total}</div>
        <div class="target" id="target">${targetText}</div>
        ${
          isBodyweight
            ? `<div class="hint-line">свой вес ${bodyWeightKg != null ? bodyWeightKg + ' кг' : '—'} + отягощение</div>`
            : ''
        }
      </div>
      <div class="inputs">
        <label class="field">
          <span>${isBodyweight ? 'Отягощение, кг' : 'Вес, кг'}</span>
          <input id="in-weight" class="num-input" inputmode="decimal" type="text"
                 value="${item.actualWeightKg}">
        </label>
        <label class="field">
          <span>Повторы</span>
          <input id="in-reps" class="num-input" inputmode="numeric" type="text"
                 value="${item.actualReps}">
        </label>
      </div>
      ${
        showRir
          ? `<label class="field">
              <span>RIR (запас повторов)</span>
              <input id="in-rir" class="num-input" inputmode="numeric" type="text"
                     value="${item.rir != null ? item.rir : ''}" placeholder="—">
            </label>`
          : ''
      }
      <input id="in-note" class="note-input" type="text"
             placeholder="Заметка к упражнению (например: болит плечо)"
             value="${esc(ex.note || '')}">
      <div class="spacer"></div>
      <button class="btn btn-ghost" id="btn-skip">Пропустить</button>
      <button class="btn btn-primary btn-big" id="btn-ok">ОК</button>
    `;

    const weightEl = el.querySelector('#in-weight');
    const repsEl = el.querySelector('#in-reps');
    const rirEl = el.querySelector('#in-rir');
    const noteEl = el.querySelector('#in-note');
    const elapsedEl = el.querySelector('#elapsed');

    const startTs = new Date(startedAt).getTime();
    const paint = () => {
      elapsedEl.textContent = formatDuration((Date.now() - startTs) / 1000);
    };
    paint();
    const intervalId = setInterval(paint, 1000);

    noteEl.addEventListener('input', () => onNote(noteEl.value));
    repsEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') el.querySelector('#btn-ok').click();
    });

    el.querySelector('#btn-skip').addEventListener('click', () => onSkip());

    el.querySelector('#btn-ok').addEventListener('click', () => {
      const weightKg = parseNumber(weightEl.value);
      const reps = parseNumber(repsEl.value);
      const rir = rirEl ? parseNumber(rirEl.value) : null;

      const weightInvalid = weightKg == null || weightKg <= 0;
      const repsInvalid = reps == null || reps < 0 || !Number.isInteger(reps);

      weightEl.classList.toggle('is-invalid', weightInvalid);
      repsEl.classList.toggle('is-invalid', repsInvalid);

      if (weightInvalid || repsInvalid) {
        (weightInvalid ? weightEl : repsEl).focus();
        return;
      }
      onLog(weightKg, reps, rir);
    });

    cleanup = () => clearInterval(intervalId);
  },
  unmount() {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  }
};
