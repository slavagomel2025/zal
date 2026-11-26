// Таймер отдыха. Время считается по абсолютной метке окончания,
// а не по количеству тиков — чтобы не «уплывало» после сворачивания.

export function formatMMSS(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(sec) {
  const total = Math.max(0, Math.round(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const TICK_THRESHOLDS_MS = [5000, 4000, 3000, 2000, 1000];

// Звук на iPhone стартует с задержкой (пока раскрутится воспроизведение),
// поэтому подаём сигналы на секунду раньше — на слух они попадают в 5..1.
export const SIGNAL_LEAD_MS = 1000;

export class RestTimer {
  constructor(opts = {}) {
    this.now = opts.now || (() => Date.now());
    this.onTick = opts.onTick || (() => {});
    this.onSignal = opts.onSignal || (() => {});
    this.onFinish = opts.onFinish || (() => {});
    this.tickMs = opts.tickMs || 100;
    this.leadMs = opts.leadMs != null ? opts.leadMs : SIGNAL_LEAD_MS;
    this.warnEnabled = opts.warnEnabled !== false;
    this.setIntervalFn = opts.setIntervalFn || ((fn, ms) => setInterval(fn, ms));
    this.clearIntervalFn = opts.clearIntervalFn || ((id) => clearInterval(id));
    this.endTime = 0;
    this.durationMs = 0;
    this.running = false;
    this._prev = null;
    this._interval = null;
  }

  start(durationMs) {
    this.stop();
    this.durationMs = Math.max(0, durationMs);
    this.endTime = this.now() + this.durationMs;
    this._prev = this.durationMs;
    this.running = true;
    this.onTick(this.durationMs, this);
    this._interval = this.setIntervalFn(() => this._tick(), this.tickMs);
    return this;
  }

  add(ms) {
    if (!this.running) return;
    this.endTime += ms;
    this.durationMs += ms;
    this._prev += ms;
  }

  remaining() {
    return Math.max(0, this.endTime - this.now());
  }

  stop() {
    this.running = false;
    if (this._interval != null) {
      this.clearIntervalFn(this._interval);
      this._interval = null;
    }
  }

  _tick() {
    if (!this.running) return;
    const remaining = this.remaining();
    this.onTick(remaining, this);
    this._fireSignals(this._prev, remaining);
    this._prev = remaining;
    if (remaining <= 0) {
      this.stop();
      this.onFinish();
    }
  }

  _fireSignals(prev, remaining) {
    if (prev == null || remaining <= 0) return;

    const lead = this.leadMs;
    const warnAt = 30000 + lead;
    let signals = [];

    if (this.warnEnabled && prev > warnAt && remaining <= warnAt) signals.push('30');
    for (const t of TICK_THRESHOLDS_MS) {
      if (prev > t + lead && remaining <= t + lead) signals.push('tick');
    }
    if (signals.length === 0) return;

    // Если времени «прыгнуло» (приложение было в фоне) — не сыпем пачкой.
    if (prev - remaining > 2000 && signals.length > 1) {
      signals = [signals[signals.length - 1]];
    }
    for (const kind of signals) this.onSignal(kind);
  }
}
