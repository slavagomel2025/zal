// Роутер: показывает один экран за раз, без перезагрузки страницы.

let rootEl = null;
let activeScreen = null;

export function initRouter(el) {
  rootEl = el;
}

export function show(screen, props = {}) {
  if (activeScreen && typeof activeScreen.unmount === 'function') {
    activeScreen.unmount();
  }
  rootEl.innerHTML = '';
  const el = document.createElement('section');
  el.className = 'screen is-active';
  rootEl.appendChild(el);
  activeScreen = screen;
  screen.mount(el, props);
}
