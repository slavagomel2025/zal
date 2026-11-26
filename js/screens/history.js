// История тренировок: список, открыть и «поделиться».

import { finishedSessions, sessionStats } from '../logic/analytics.js?v=11';
import { formatDuration } from '../timer.js?v=11';
import { esc } from '../util.js?v=11';

export const historyScreen = {
  mount(el, props) {
    const { sessions, onOpen, onShare, onBack } = props;
    const list = finishedSessions(sessions).reverse();

    const rows = list
      .map((session) => {
        const stats = sessionStats(session);
        const date = new Date(session.startedAt).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long'
        });
        const time = new Date(session.startedAt).toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        });
        return `
          <div class="list-row">
            <button class="list-main" data-id="${esc(session.id)}">
              <span class="list-title">${date} · ${time}</span>
              <span class="list-sub">${formatDuration(stats.durationSec)} · ${stats.sets} подходов · ${
                stats.avgRestSec ? 'отдых ' + formatDuration(stats.avgRestSec) : 'без отдыха'
              }</span>
            </button>
            <span class="list-value">${stats.tonnageKg} кг</span>
            <button class="btn-mini" data-share="${esc(session.id)}" aria-label="Поделиться">↗</button>
          </div>`;
      })
      .join('');

    el.innerHTML = `
      <div class="topbar">
        <button class="btn-back" id="btn-back" aria-label="Назад">‹</button>
        <span>История</span>
        <span>${list.length}</span>
      </div>
      <div class="card card-list">
        ${rows || '<div class="empty">Пока нет завершённых тренировок</div>'}
      </div>
    `;

    el.querySelector('#btn-back').addEventListener('click', () => onBack());
    el.querySelectorAll('.list-main').forEach((row) => {
      row.addEventListener('click', () => {
        const session = sessions.find((s) => s.id === row.dataset.id);
        if (session) onOpen(session);
      });
    });
    el.querySelectorAll('[data-share]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const session = sessions.find((s) => s.id === btn.dataset.share);
        if (session && onShare) onShare(session);
      });
    });
  },
  unmount() {}
};
