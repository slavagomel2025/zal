// Библиотека упражнений: список и редактор.

import { esc, parseNumber } from '../util.js?v=11';

const GROUPS = ['', 'грудь', 'спина', 'ноги', 'плечи', 'руки', 'пресс'];

function blankExercise() {
  return {
    id: 'ex_' + Math.random().toString(36).slice(2, 8),
    name: '',
    kind: 'base',
    loadType: 'external',
    muscleGroup: '',
    stepKg: 2.5,
    note: '',
    warmupSets: [{ weightKg: 20, reps: 10, restSec: 60 }],
    sets: [
      { weightKg: 20, reps: 8, restSec: 90 },
      { weightKg: 20, reps: 8, restSec: 90 },
      { weightKg: 20, reps: 8, restSec: 90 }
    ],
    transitionRestSec: 60
  };
}

function clone(exercise) {
  return JSON.parse(JSON.stringify(exercise));
}

function planText(ex) {
  const first = ex.sets[0] || { weightKg: 0, reps: 0, restSec: 0 };
  const rest = first.restSec ? ` · отдых ${Math.round(first.restSec)} с` : '';
  const weight = ex.loadType === 'bodyweight' ? `+${first.weightKg} кг` : `${first.weightKg} кг`;
  return `${ex.sets.length} × ${first.reps} · ${weight}${rest}`;
}

export const libraryScreen = {
  mount(el, props) {
    const { library, onSave, onBack, openId } = props;
    let mode = 'list';
    let index = null;
    let draft = null;
    const list = library.slice();

    const renderList = () => {
      const rows = list
        .map(
          (ex, i) => `
          <button class="program-row" data-edit="${i}">
            <span class="program-main">
              <span class="list-title">${esc(ex.name)}${
                ex.loadType === 'bodyweight' ? ' <span class="chip">свой вес</span>' : ''
              }</span>
              <span class="list-sub">${planText(ex)}${
                ex.kind === 'accessory' ? ' · вспомогательное' : ''
              }</span>
            </span>
          </button>`
        )
        .join('');

      el.innerHTML = `
        <div class="topbar">
          <button class="btn-back" id="btn-back" aria-label="Назад">‹</button>
          <span>Упражнения</span>
          <button class="btn-mini" id="btn-add">+ добавить</button>
        </div>
        <div class="card card-list">
          ${rows || '<div class="empty">Пока нет упражнений — добавь первое</div>'}
        </div>
      `;

      el.querySelector('#btn-back').addEventListener('click', () => onBack());
      el.querySelector('#btn-add').addEventListener('click', () => {
        index = null;
        draft = blankExercise();
        mode = 'edit';
        renderEditor();
      });
      el.querySelectorAll('[data-edit]').forEach((row) => {
        row.addEventListener('click', () => {
          index = Number(row.dataset.edit);
          draft = clone(list[index]);
          mode = 'edit';
          renderEditor();
        });
      });
    };

    const rowsHtml = (list, kind) =>
      list
        .map(
          (entry, i) => `
          <div class="edit-row">
            <input class="mini-input" inputmode="decimal" type="text"
                   data-${kind}="${i}" data-field="weightKg" value="${entry.weightKg}">
            <span class="set-line-x">×</span>
            <input class="mini-input" inputmode="numeric" type="text"
                   data-${kind}="${i}" data-field="reps" value="${entry.reps}">
            <input class="mini-input mini-rest" inputmode="numeric" type="text"
                   data-${kind}="${i}" data-field="restSec" value="${entry.restSec}">
            <button class="btn-mini" data-del-${kind}="${i}" aria-label="Удалить">✕</button>
          </div>`
        )
        .join('');

    const renderEditor = () => {
      const ex = draft;
      el.innerHTML = `
        <div class="topbar">
          <button class="btn-back" id="btn-cancel" aria-label="Назад">‹</button>
          <span>${index === null ? 'Новое упражнение' : 'Упражнение'}</span>
          <span></span>
        </div>
        <div class="card">
          <label class="field"><span>Название</span>
            <input id="f-name" class="text-input" type="text" value="${esc(ex.name)}">
          </label>
          <label class="field"><span>Тип</span>
            <select id="f-kind" class="text-input">
              <option value="base" ${ex.kind === 'base' ? 'selected' : ''}>Базовое (5×5)</option>
              <option value="accessory" ${ex.kind === 'accessory' ? 'selected' : ''}>Вспомогательное (5×12)</option>
            </select>
          </label>
          <label class="field"><span>Нагрузка</span>
            <select id="f-load" class="text-input">
              <option value="external" ${ex.loadType !== 'bodyweight' ? 'selected' : ''}>Внешний вес (штанга, гантели)</option>
              <option value="bodyweight" ${ex.loadType === 'bodyweight' ? 'selected' : ''}>Свой вес (подтягивания, брусья)</option>
            </select>
          </label>
          <label class="field"><span>Группа мышц</span>
            <select id="f-group" class="text-input">
              ${GROUPS.map(
                (g) => `<option value="${g}" ${ex.muscleGroup === g ? 'selected' : ''}>${g || '—'}</option>`
              ).join('')}
            </select>
          </label>
          <div class="inputs">
            <label class="field"><span>Шаг, кг</span>
              <input id="f-step" class="text-input" inputmode="decimal" type="text" value="${ex.stepKg ?? ''}">
            </label>
            <label class="field"><span>Отдых перед след., с</span>
              <input id="f-transition" class="text-input" inputmode="numeric" type="text" value="${ex.transitionRestSec ?? ''}">
            </label>
          </div>
          <label class="field"><span>Заметка</span>
            <input id="f-note" class="text-input" type="text" value="${esc(ex.note || '')}">
          </label>
        </div>
        <div class="card">
          <div class="label">Разминочные подходы</div>
          <div class="edit-box">${rowsHtml(ex.warmupSets || [], 'warmup')}</div>
          <button class="btn-mini" id="btn-add-warmup">+ разминка</button>
        </div>
        <div class="card">
          <div class="label">Рабочие подходы</div>
          <div class="edit-box">${rowsHtml(ex.sets || [], 'set')}</div>
          <button class="btn-mini" id="btn-add-set">+ подход</button>
        </div>
        <div class="spacer"></div>
        <button class="btn btn-primary btn-big" id="btn-save">Сохранить</button>
        ${index !== null ? '<button class="btn btn-ghost" id="btn-delete">Удалить упражнение</button>' : ''}
      `;

      const bindField = (selector, key, isNumber) => {
        const input = el.querySelector(selector);
        if (!input) return;
        const handler = () => {
          ex[key] = isNumber ? parseNumber(input.value) : input.value;
        };
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
      };

      bindField('#f-name', 'name', false);
      bindField('#f-kind', 'kind', false);
      bindField('#f-load', 'loadType', false);
      bindField('#f-group', 'muscleGroup', false);
      bindField('#f-step', 'stepKg', true);
      bindField('#f-transition', 'transitionRestSec', true);
      bindField('#f-note', 'note', false);

      el.querySelectorAll('[data-warmup], [data-set]').forEach((input) => {
        const kind = input.dataset.warmup != null ? 'warmup' : 'set';
        const rowIndex = Number(input.dataset[kind]);
        const field = input.dataset.field;
        const handler = () => {
          const value = parseNumber(input.value);
          ex[kind === 'warmup' ? 'warmupSets' : 'sets'][rowIndex][field] = value;
        };
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
      });

      const removeRow = (kind, rowIndex) => {
        const list = ex[kind === 'warmup' ? 'warmupSets' : 'sets'];
        if (list.length <= 1) return;
        list.splice(rowIndex, 1);
        renderEditor();
      };

      el.querySelectorAll('[data-del-warmup]').forEach((btn) => {
        btn.addEventListener('click', () => removeRow('warmup', Number(btn.dataset.delWarmup)));
      });
      el.querySelectorAll('[data-del-set]').forEach((btn) => {
        btn.addEventListener('click', () => removeRow('set', Number(btn.dataset.delSet)));
      });

      el.querySelector('#btn-add-warmup').addEventListener('click', () => {
        const last = ex.warmupSets[ex.warmupSets.length - 1] || { weightKg: 20, reps: 10, restSec: 60 };
        ex.warmupSets.push({ ...last });
        renderEditor();
      });
      el.querySelector('#btn-add-set').addEventListener('click', () => {
        const last = ex.sets[ex.sets.length - 1] || { weightKg: 20, reps: 8, restSec: 90 };
        ex.sets.push({ ...last });
        renderEditor();
      });

      el.querySelector('#btn-cancel').addEventListener('click', () => {
        mode = 'list';
        draft = null;
        renderList();
      });

      el.querySelector('#btn-save').addEventListener('click', () => {
        if (!ex.name || !ex.name.trim()) {
          el.querySelector('#f-name').classList.add('is-invalid');
          el.querySelector('#f-name').focus();
          return;
        }
        const cleaned = {
          ...ex,
          name: ex.name.trim(),
          stepKg: ex.stepKg != null ? ex.stepKg : ex.kind === 'accessory' ? 1 : 2.5,
          warmupSets: (ex.warmupSets || [])
            .filter((w) => w.weightKg > 0 && w.reps > 0)
            .map((w) => ({ weightKg: w.weightKg, reps: w.reps, restSec: w.restSec || 60 })),
          sets: (ex.sets || [])
            .filter((s) => s.weightKg > 0 && s.reps > 0)
            .map((s) => ({ weightKg: s.weightKg, reps: s.reps, restSec: s.restSec || 60 }))
        };
        if (!cleaned.sets.length) return;

        const next = list.slice();
        if (index === null) next.push(cleaned);
        else next[index] = cleaned;
        onSave(next);
        mode = 'list';
        draft = null;
        list.length = 0;
        next.forEach((item) => list.push(item));
        renderList();
      });

      const deleteBtn = el.querySelector('#btn-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          if (!window.confirm('Удалить упражнение из библиотеки? Оно исчезнет из всех дней.')) return;
          const next = list.filter((_, i) => i !== index);
          onSave(next);
          mode = 'list';
          draft = null;
          list.length = 0;
          next.forEach((item) => list.push(item));
          renderList();
        });
      }
    };

    // Локальная копия списка, чтобы экран оставался согласованным после сохранения.
    if (openId) {
      const found = list.findIndex((ex) => ex.id === openId);
      if (found >= 0) {
        index = found;
        draft = clone(list[found]);
        mode = 'edit';
        renderEditor();
        return;
      }
    }
    renderList();
  },
  unmount() {}
};
