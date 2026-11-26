// Настройки: звук, RIR, экспорт, импорт, очистка.

import { esc, parseNumber } from '../util.js?v=11';

export const settingsScreen = {
  mount(el, props) {
    const {
      settings,
      onSave,
      onExport,
      onCopy,
      onPasteRecs,
      onImportRecs,
      onImportBackup,
      onClear,
      onTestSound,
      onBack
    } = props;

    const toggle = (key, label, hint) => `
      <button class="switch-row" data-toggle="${key}">
        <span class="switch-text">
          <span class="list-title">${label}</span>
          ${hint ? `<span class="list-sub">${hint}</span>` : ''}
        </span>
        <span class="switch ${settings[key] ? 'is-on' : ''}"><span class="switch-knob"></span></span>
      </button>`;

    const musicOn = settings.soundMode !== 'media';

    el.innerHTML = `
      <div class="topbar">
        <button class="btn-back" id="btn-back" aria-label="Назад">‹</button>
        <span>Настройки</span>
        <span></span>
      </div>
      <div class="card">
        ${toggle('soundEnabled', 'Звук таймера', 'Голос и пики во время отдыха')}
        ${toggle('showRir', 'RIR в подходе', 'Поле «запас повторов»')}
        <button class="switch-row" id="btn-music">
          <span class="switch-text">
            <span class="list-title">Не прерывать музыку</span>
            <span class="list-sub">${
              musicOn
                ? 'Звук идёт вместе с музыкой. Нужен выключенный переключатель «Без звука»'
                : 'Слышно в беззвучном режиме, но музыка встаёт на паузу после сигнала'
            }</span>
          </span>
          <span class="switch ${musicOn ? 'is-on' : ''}"><span class="switch-knob"></span></span>
        </button>
        <button class="btn" id="btn-test-sound">Проверить звук</button>
      </div>
      <div class="card">
        <div class="label">Вес тела по умолчанию, кг</div>
        <input id="in-bw" class="num-input" inputmode="decimal" type="text"
               value="${settings.bodyWeightKg ?? ''}" placeholder="—">
      </div>
      <div class="card">
        <div class="label">Данные</div>
        <button class="btn" id="btn-export">Экспорт в файл (для агента)</button>
        <button class="btn" id="btn-copy">Скопировать JSON</button>
        <button class="btn" id="btn-paste-recs">Вставить рекомендации из буфера</button>
        <button class="btn" id="btn-import-recs">Импорт рекомендаций из файла</button>
        <button class="btn" id="btn-import-backup">Импорт резервной копии</button>
      </div>
      <div class="card">
        <button class="btn btn-ghost" id="btn-clear">Очистить все данные</button>
      </div>
      <div class="spacer"></div>
    `;

    el.querySelector('#btn-back').addEventListener('click', () => onBack());

    el.querySelectorAll('[data-toggle]').forEach((row) => {
      row.addEventListener('click', () => {
        const key = row.dataset.toggle;
        settings[key] = !settings[key];
        onSave(settings);
        settingsScreen.mount(el, props);
      });
    });

    el.querySelector('#btn-music').addEventListener('click', () => {
      settings.soundMode = settings.soundMode === 'media' ? 'mix' : 'media';
      onSave(settings);
      settingsScreen.mount(el, props);
    });

    el.querySelector('#btn-test-sound').addEventListener('click', () => onTestSound());

    const bwEl = el.querySelector('#in-bw');
    bwEl.addEventListener('change', () => {
      const bw = parseNumber(bwEl.value);
      settings.bodyWeightKg = bw != null && bw > 0 ? bw : null;
      onSave(settings);
    });

    el.querySelector('#btn-export').addEventListener('click', () => onExport());
    el.querySelector('#btn-copy').addEventListener('click', () => onCopy());
    el.querySelector('#btn-paste-recs').addEventListener('click', () => onPasteRecs());
    el.querySelector('#btn-import-recs').addEventListener('click', () => onImportRecs());
    el.querySelector('#btn-import-backup').addEventListener('click', () => onImportBackup());

    el.querySelector('#btn-clear').addEventListener('click', () => onClear());
  },
  unmount() {}
};
