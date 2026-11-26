// Мелкие утилиты без зависимостей.

export const BUILD = 10;

export function esc(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

export function parseNumber(raw) {
  const text = String(raw ?? '').trim().replace(',', '.');
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

export function todayISO() {
  return new Date().toISOString();
}
