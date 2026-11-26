// Экран отдыха: крупный отсчёт, крупное название следующего упражнения.

import { RestTimer, formatMMSS } from '../timer.js?v=11';
import { beep30, beepTick, beepEnd, sayReady } from '../sound.js?v=11';
import { keepAwake, releaseAwake } from '../wakelock.js?v=11';
import { esc } from '../util.js?v=11';

// Короткий отдых: «готовимся» за 30 секунд до конца звучало бы почти сразу
// после начала, поэтому для него оставляем только пики.
const WARN_MIN_REST_MS = 40000;

export const restScreen = {
  mount(el, props) {
    const { durationMs, next, soundEnabled, onAdjust, onSkip, onDone } = props;

    const nextBlock = next
      ? `<div class="rest-next-label">дальше</div>
         <div class="rest-next-name">${esc(next.name)}</div>
         <div class="rest-next-detail">${esc(next.detail || '')}</div>`
      : '<div class="rest-next-label">тренировка</div><div class="rest-next-name">завершена</div>';

    el.innerHTML = `
      <div class="rest" id="rest">
        <div class="rest-label">отдых</div>
        <div class="rest-time" id="rest-time">${formatMMSS(durationMs)}</div>
        <div class="rest-next">${nextBlock}</div>
      </div>
      <div class="rest-actions">
        <button class="btn" id="btn-add">+15 сек</button>
        <button class="btn btn-ghost" id="btn-skip">Пропустить</button>
      </div>
    `;

    const restEl = el.querySelector('#rest');
    const timeEl = el.querySelector('#rest-time');
    let finished = false;

    const timer = new RestTimer({
      warnEnabled: durationMs >= WARN_MIN_REST_MS,
      onTick(remaining) {
        timeEl.textContent = formatMMSS(remaining);
        restEl.classList.toggle('is-warn', remaining <= 30000 && remaining > 5000);
        restEl.classList.toggle('is-danger', remaining <= 5000);
      },
      onSignal(kind) {
        if (!soundEnabled) return;
        if (kind === '30') {
          // Сначала резкий бип, чтобы привлечь внимание сквозь музыку, потом голос.
          beep30();
          setTimeout(() => sayReady(), 260);
        } else {
          beepTick();
        }
      },
      onFinish() {
        if (finished) return;
        finished = true;
        if (soundEnabled) beepEnd();
        onDone();
      }
    });

    timer.start(durationMs);
    keepAwake();

    el.querySelector('#btn-add').addEventListener('click', () => {
      if (finished) return;
      timer.add(15000);
      onAdjust(15);
    });

    el.querySelector('#btn-skip').addEventListener('click', () => {
      if (finished) return;
      finished = true;
      timer.stop();
      onSkip();
      onDone();
    });

    restScreen._timer = timer;
  },

  unmount() {
    if (restScreen._timer) {
      restScreen._timer.stop();
      restScreen._timer = null;
    }
    releaseAwake();
  }
};
