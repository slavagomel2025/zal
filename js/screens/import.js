// Подтверждение рекомендаций агента: что изменится.

import { esc } from '../util.js?v=10';

function formatTarget(target) {
  return `${target.weightKg} кг × ${target.reps} · ${target.sets} подх. · отдых ${target.restSec} с`;
}

export const importScreen = {
  mount(el, props) {
    const { preview, comment, errors, fileName, onApply, onCancel } = props;

    const rows = preview
      .map((row) => {
        if (row.missing) {
          return `
            <div class="import-row is-missing">
              <div class="list-title">${esc(row.name)}</div>
              <div class="list-sub">Такого упражнения нет в программе — пропустим</div>
            </div>`;
        }
        return `
          <div class="import-row">
            <div class="list-title">${esc(row.name)}</div>
            <div class="list-sub">было: ${formatTarget(row.before)}</div>
            <div class="import-after">станет: ${formatTarget(row.after)}</div>
            <div class="ex-row-reason">${esc(row.reason || '')}</div>
          </div>`;
      })
      .join('');

    const warn = (errors || []).length
      ? `<div class="card"><div class="label">Предупреждения</div>${errors
          .map((e) => `<div class="hint">${esc(e)}</div>`)
          .join('')}</div>`
      : '';

    el.innerHTML = `
      <div class="topbar">
        <button class="btn-back" id="btn-cancel" aria-label="Назад">‹</button>
        <span>Рекомендации</span>
        <span>${esc(fileName || '')}</span>
      </div>
      ${comment ? `<div class="card"><div class="label">Комментарий агента</div><div class="comment">${esc(comment)}</div></div>` : ''}
      <div class="card card-list">${rows}</div>
      ${warn}
      <div class="spacer"></div>
      <button class="btn btn-primary btn-big" id="btn-apply">Применить</button>
    `;

    el.querySelector('#btn-cancel').addEventListener('click', () => onCancel());
    el.querySelector('#btn-apply').addEventListener('click', () => onApply());
  },
  unmount() {}
};
