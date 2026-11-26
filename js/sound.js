// Звуки. Два движка, между ними переключаемся в настройках:
//
// 1. Web Audio («вместе с музыкой») — микшируется с музыкой и не останавливает
//    её, но iOS глушит его переключателем «Без звука».
// 2. <audio> («слышно в беззвучном режиме») — играет даже при включённом
//    «Без звука» и в наушниках, но iOS на время сигнала забирает звук у музыки.

const SAMPLE_RATE = 16000;

// Два тона в каждой ноте: так звук заметно громче и резче, чем один тон.
const SPECS = {
  tick: { freqs: [2000, 2650], durationSec: 0.09, gain: 0.5, wave: 'square' },
  warn30: { freqs: [1200, 1600], durationSec: 0.25, gain: 0.5, wave: 'square' },
  end: { freqs: [2000, 2650], durationSec: 0.45, gain: 0.5, wave: 'square' }
};

// Голос «Готовимся» записан заранее (app/audio/ready.wav).
const READY_URL = new URL('../audio/ready.wav', import.meta.url).href;

let mode = 'mix';
let ctx = null;
let voiceBuffer = null;
let voiceLoading = null;
const players = new Map();

export function setSoundMode(next) {
  mode = next === 'media' ? 'media' : 'mix';
}

export function getSoundMode() {
  return mode;
}

function applySessionType(type) {
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession) {
      navigator.audioSession.type = type;
    }
  } catch (err) {
    // Не критично.
  }
}

// ---------- Web Audio ----------

function ensureContext() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    if (!ctx) ctx = new Ctor();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  } catch (err) {
    return null;
  }
  return ctx;
}

function beepWeb(spec) {
  const audio = ensureContext();
  if (!audio) return false;
  try {
    const t = audio.currentTime;
    const freqs = spec.freqs || [spec.freq];
    for (const freq of freqs) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = spec.wave || 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(spec.gain, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + spec.durationSec);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + spec.durationSec + 0.02);
    }
    return true;
  } catch (err) {
    return false;
  }
}

// Только загрузка голоса в память — без воспроизведения.
async function preloadVoice() {
  if (voiceBuffer) return true;
  const audio = ensureContext();
  if (!audio || typeof fetch !== 'function') return false;
  if (voiceLoading) return voiceLoading;

  voiceLoading = (async () => {
    try {
      const response = await fetch(READY_URL);
      if (!response.ok) return false;
      const data = await response.arrayBuffer();
      voiceBuffer = await audio.decodeAudioData(data);
      return true;
    } catch (err) {
      return false;
    } finally {
      voiceLoading = null;
    }
  })();

  return voiceLoading;
}

async function playVoiceWeb() {
  const audio = ensureContext();
  if (!audio) return false;
  const ready = await preloadVoice();
  if (!ready) return false;
  try {
    const source = audio.createBufferSource();
    source.buffer = voiceBuffer;
    source.connect(audio.destination);
    source.start();
    return true;
  } catch (err) {
    return false;
  }
}

// ---------- <audio> ----------

function writeString(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

// Громкий бип: два тона, мягкое ограничение даёт больше гармоник,
// на телефонном динамике пробивается сквозь музыку.
export function makeBeepWav({ freq, freqs, durationSec, gain = 0.9, sampleRate = SAMPLE_RATE }) {
  const tones = freqs || (freq ? [freq] : [1000]);
  const sampleCount = Math.max(1, Math.floor(sampleRate * durationSec));
  const dataBytes = sampleCount * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  const attack = 0.004;
  const release = Math.min(0.03, durationSec / 3);
  const twoPi = Math.PI * 2;
  const limit = Math.tanh(2.5);

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleRate;
    let envelope = 1;
    if (t < attack) envelope = t / attack;
    else if (t > durationSec - release) envelope = Math.max(0, (durationSec - t) / release);
    let raw = 0;
    for (const tone of tones) raw += Math.sin(twoPi * tone * t);
    raw /= tones.length;
    const shaped = Math.tanh(raw * 2.5) / limit;
    view.setInt16(44 + i * 2, Math.round(shaped * gain * envelope * 32767), true);
  }

  return buffer;
}

export function toDataUri(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

function ensurePlayers() {
  if (players.size > 0) return;
  if (typeof Audio === 'undefined') return;
  for (const [name, spec] of Object.entries(SPECS)) {
    try {
      const el = new Audio(toDataUri(makeBeepWav({ ...spec, gain: 0.9 })));
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      players.set(name, el);
    } catch (err) {
      console.warn('sound init failed:', name, err);
    }
  }
  try {
    const voice = new Audio(READY_URL);
    voice.preload = 'auto';
    voice.setAttribute('playsinline', '');
    players.set('ready', voice);
  } catch (err) {
    console.warn('voice init failed:', err);
  }
}

function speakFallback() {
  try {
    if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
      return;
    }
    const utterance = new SpeechSynthesisUtterance('Готовимся');
    utterance.lang = 'ru-RU';
    speechSynthesis.speak(utterance);
  } catch (err) {
    // ignore
  }
}

function playMedia(name) {
  const spec = SPECS[name];
  ensurePlayers();
  const el = players.get(name);
  if (!el) {
    if (spec) beepWeb(spec);
    else speakFallback();
    return;
  }
  try {
    el.pause();
    el.currentTime = 0;
    const promise = el.play();
    if (promise && promise.catch) {
      promise.catch(() => {
        if (spec) beepWeb(spec);
        else speakFallback();
      });
    }
  } catch (err) {
    if (spec) beepWeb(spec);
    else speakFallback();
  }
}

// ---------- Публичный интерфейс ----------

// Вызывается из обработчиков касаний: будим Web Audio и/или прогреваем элементы.
// ВАЖНО: звук здесь не играет, только готовим движок и загружаем голос.
export function unlockAudio() {
  if (mode === 'media') {
    applySessionType('playback');
    ensurePlayers();
    for (const el of players.values()) {
      try {
        el.muted = true;
        const promise = el.play();
        el.pause();
        el.currentTime = 0;
        if (promise && promise.catch) promise.catch(() => {});
        el.muted = false;
      } catch (err) {
        // ignore
      }
    }
    return;
  }

  applySessionType('ambient');
  const audio = ensureContext();
  if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
  preloadVoice().catch(() => {});
}

export function beep30() {
  if (mode === 'mix' && beepWeb(SPECS.warn30)) return;
  playMedia('warn30');
}
export function beepTick() {
  if (mode === 'mix' && beepWeb(SPECS.tick)) return;
  playMedia('tick');
}

export function beepEnd() {
  if (mode === 'mix' && beepWeb(SPECS.end)) return;
  playMedia('end');
}

export function sayReady() {
  if (mode === 'mix' && typeof window !== 'undefined') {
    playVoiceWeb().then((ok) => {
      if (!ok) playMedia('ready');
    });
    return;
  }
  playMedia('ready');
}
