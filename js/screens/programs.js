// Программы на разные дни: список дней, состав дня, выбор упражнений.

import { esc } from '../util.js?v=10';

function groupLabel(group) {
  return group == null ? '' : 'блок';
}

function planText(ex, count) {
  const first = ex.sets[0] || { weightKg: 0, reps: 0, restSec: 0 };
  const rest = first.restSec ? ` · отдых ${Math.round(first.restSec)} с` : '';
  const weight = ex.loadType === 'bodyweight' ? `+${first.weightKg} кг` : `${first.weightKg} кг`;
  return `${count || ex.sets.length} × ${first.reps} · ${weight}${rest}`;
}

export const programsScreen = {
  mount(el, props) {
    const { library, programs, activeProgramId, onSavePrograms, onSaveActive, onOpenLibrary, onBack } =
      props;

    let mode = 'programs';
    let currentId = activeProgramId || (programs[0] && programs[0].id) || null;
    let pickerReturn = 'programs';

    const currentProgram = () => programs.find((p) => p.id === currentId) || null;

    const nextGroupId = () => {
      let max = 0;
      for (const program of programs) {
        for (const item of program.items) {
          if (typeof item.supersetGroup === 'number') max = Math.max(max, item.supersetGroup);
        }
      }
      return max + 1;
    };

    const savePrograms = () => {
      onSavePrograms(programs);
    };

    const render = () => {
      if (mode === 'picker') return renderPicker();
      return renderPrograms();
    };

    const renderPrograms = () => {
      const program = currentProgram();
      const chips = programs
        .map(
          (p) =>
            `<button class="chip ${p.id === currentId ? 'is-on' : ''}" data-select="${esc(p.id)}">${esc(p.name)}</button>`
        )
        .join('');

      const items = program
        ? program.items
            .map((item, index) => {
              const ex = library.find((e) => e.id === item.exerciseId);
              if (!ex) {
                return `
                  <div class="program-row is-missing">
                    <div class="program-main">
                      <span class="list-title">упражнение удалено</span>
                      <span class="list-sub">убери из программы</span>
                    </div>
                    <button class="btn-mini" data-remove="${index}">✕</button>
                  </div>`;
              }
              const block = groupLabel(item.supersetGroup);
              const next = program.items[index + 1];
              const groupedWithNext =
                item.supersetGroup != null && next && next.supersetGroup === item.supersetGroup;
              return `
                <div class="program-row ${block ? 'is-block' : ''}">
                  <button class="program-main" data-edit="${esc(ex.id)}">
                    <span class="list-title">${esc(ex.name)}${
                      block ? ' <span class="chip chip-block">блок</span>' : ''
                    }</span>
                    <span class="list-sub">${planText(ex, 0)}</span>
                  </button>
                  <span class="program-actions">
                    <button class="btn-mini" data-up="${index}" aria-label="Выше">↑</button>
                    <button class="btn-mini" data-down="${index}" aria-label="Ниже">↓</button>
                    <button class="btn-mini ${groupedWithNext || item.supersetGroup != null ? 'is-on' : ''}"
                            data-group="${index}" aria-label="Объединить с следующим">⛓</button>
                    <button class="btn-mini" data-remove="${index}" aria-label="Убрать">✕</button>
                  </span>
                </div>`;
            })
            .join('')
        : '';

      el.innerHTML = `
        <div class="topbar">
          <button class="btn-back" id="btn-back" aria-label="Назад">‹</button>
          <span>Программы</span>
          <button class="btn-mini" id="btn-add-program">+ день</button>
        </div>
        <div class="chips">${chips}</div>
        ${
          program
            ? `<div class="card card-list">
                 ${items || '<div class="empty">В этом дне пока нет упражнений</div>'}
               </div>
               <button class="btn" id="btn-add-ex">+ Добавить упражнение</button>
               <div class="row-actions">
                 <button class="btn btn-ghost" id="btn-rename">Переименовать</button>
                 <button class="btn btn-ghost" id="btn-delete-program">Удалить день</button>
               </div>
               <div class="hint-line">⛓ объединяет упражнение со следующим: подходы будут чередоваться (жим → отдых → подтягивания → отдых → снова жим).</div>`
            : '<div class="empty">Нет программ — создай первый день</div>'
        }
        <button class="btn btn-ghost" id="btn-library">Библиотека упражнений</button>
      `;

      el.querySelector('#btn-back').addEventListener('click', () => onBack());
      el.querySelector('#btn-library').addEventListener('click', () => onOpenLibrary());

      el.querySelectorAll('[data-select]').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentId = btn.dataset.select;
          onSaveActive(currentId);
          renderPrograms();
        });
      });

      el.querySelector('#btn-add-program').addEventListener('click', () => {
        const name = window.prompt('Название дня:', 'День ' + (programs.length + 1));
        if (!name) return;
        const program = { id: 'p_' + Math.random().toString(36).slice(2, 8), name, items: [] };
        programs.push(program);
        currentId = program.id;
        onSavePrograms(programs);
        onSaveActive(currentId);
        renderPrograms();
      });

      if (!program) return;

      el.querySelector('#btn-add-ex').addEventListener('click', () => {
        pickerReturn = 'programs';
        mode = 'picker';
        renderPicker();
      });

      el.querySelector('#btn-rename').addEventListener('click', () => {
        const name = window.prompt('Название дня:', program.name);
        if (!name) return;
        program.name = name;
        onSavePrograms(programs);
        renderPrograms();
      });

      el.querySelector('#btn-delete-program').addEventListener('click', () => {
        if (!window.confirm('Удалить день «' + program.name + '»?')) return;
        const index = programs.findIndex((p) => p.id === program.id);
        programs.splice(index, 1);
        currentId = programs[0] ? programs[0].id : null;
        onSavePrograms(programs);
        onSaveActive(currentId);
        renderPrograms();
      });

      el.querySelectorAll('[data-edit]').forEach((btn) => {
        btn.addEventListener('click', () => onOpenLibrary(btn.dataset.edit));
      });

      el.querySelectorAll('[data-remove]').forEach((btn) => {
        btn.addEventListener('click', () => {
          program.items.splice(Number(btn.dataset.remove), 1);
          onSavePrograms(programs);
          renderPrograms();
        });
      });

      el.querySelectorAll('[data-up]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.up);
          if (i === 0) return;
          [program.items[i - 1], program.items[i]] = [program.items[i], program.items[i - 1]];
          onSavePrograms(programs);
          renderPrograms();
        });
      });

      el.querySelectorAll('[data-down]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.down);
          if (i >= program.items.length - 1) return;
          [program.items[i], program.items[i + 1]] = [program.items[i + 1], program.items[i]];
          onSavePrograms(programs);
          renderPrograms();
        });
      });

      el.querySelectorAll('[data-group]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.group);
          const next = program.items[i + 1];
          if (!next) return;
          const item = program.items[i];
          if (item.supersetGroup != null || next.supersetGroup != null) {
            const group = item.supersetGroup != null ? item.supersetGroup : next.supersetGroup;
            item.supersetGroup = null;
            next.supersetGroup = null;
            // если в блоке остались другие упражнения, они сохраняют свою группу
            if (group != null) {
              const rest = program.items.filter(
                (it, idx) => idx !== i && idx !== i + 1 && it.supersetGroup === group
              );
              if (rest.length === 1) rest[0].supersetGroup = null;
            }
          } else {
            const group = nextGroupId();
            item.supersetGroup = group;
            next.supersetGroup = group;
          }
          onSavePrograms(programs);
          renderPrograms();
        });
      });
    };

    const renderPicker = () => {
      const program = currentProgram();
      const rows = library
        .map(
          (ex) => `
          <div class="program-row">
            <div class="program-main">
              <span class="list-title">${esc(ex.name)}</span>
              <span class="list-sub">${planText(ex, 0)}</span>
            </div>
            <button class="btn-mini" data-add="${esc(ex.id)}">+</button>
          </div>`
        )
        .join('');

      el.innerHTML = `
        <div class="topbar">
          <button class="btn-back" id="btn-back" aria-label="Назад">‹</button>
          <span>Добавить в «${program ? esc(program.name) : 'день'}»</span>
          <span></span>
        </div>
        <div class="card card-list">
          ${rows || '<div class="empty">Библиотека пуста — создай упражнение</div>'}
        </div>
        <button class="btn btn-ghost" id="btn-library">Библиотека упражнений</button>
      `;

      el.querySelector('#btn-back').addEventListener('click', () => {
        mode = pickerReturn;
        renderPrograms();
      });

      el.querySelector('#btn-library').addEventListener('click', () => onOpenLibrary());

      el.querySelectorAll('[data-add]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const program = currentProgram();
          if (!program) return;
          program.items.push({ exerciseId: btn.dataset.add, supersetGroup: null });
          onSavePrograms(programs);
          mode = 'programs';
          renderPrograms();
        });
      });
    };

    render();
  },
  unmount() {}
};
