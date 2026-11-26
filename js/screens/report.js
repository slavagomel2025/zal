// Экран отчёта по тренировке: текст и кнопки «поделиться / скопировать / JSON».

export const reportScreen = {
  mount(el, props) {
    const { text, onShare, onCopy, onDownload, onBack } = props;

    el.innerHTML = `
      <div class="topbar">
        <button class="btn-back" id="btn-back" aria-label="Назад">‹</button>
        <span>Отчёт</span>
        <span></span>
      </div>
      <div class="card">
        <pre class="report-text" id="report-text"></pre>
      </div>
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-share">Поделиться</button>
      <div class="row-actions">
        <button class="btn" id="btn-copy">Скопировать текст</button>
        <button class="btn" id="btn-json">Сохранить JSON</button>
      </div>
    `;

    el.querySelector('#report-text').textContent = text;
    el.querySelector('#btn-back').addEventListener('click', () => onBack());
    el.querySelector('#btn-share').addEventListener('click', () => onShare());
    el.querySelector('#btn-copy').addEventListener('click', () => onCopy());
    el.querySelector('#btn-json').addEventListener('click', () => onDownload());
  },
  unmount() {}
};
