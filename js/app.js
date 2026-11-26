// Точка входа: маршрутизация между экранами и сценарии.

import { initRouter, show } from './router.js?v=11';
import {
  state,
  newSession,
  findNext,
  logSet,
  skipItem,
  finishSession
} from './state.js?v=11';
import {
  loadData,
  saveData,
  loadSettings,
  loadSessions,
  saveSessions,
  saveSettings,
  loadRecommendations,
  saveRecommendations,
  saveBackupSlot,
  remove
} from './storage.js?v=11';
import { startScreen, setScreen } from './screens/workout.js?v=11';
import { restScreen } from './screens/rest.js?v=11';
import { summaryScreen } from './screens/summary.js?v=11';
import { historyScreen } from './screens/history.js?v=11';
import { reportScreen } from './screens/report.js?v=11';
import { buildSessionReport, reportText, reportFileName } from './logic/report.js?v=11';
import { programsScreen } from './screens/programs.js?v=11';
import { libraryScreen } from './screens/exercises.js?v=11';
import { analysisScreen } from './screens/analysis.js?v=11';
import { settingsScreen } from './screens/settings.js?v=11';
import { importScreen } from './screens/import.js?v=11';
import { resolveTargets } from './logic/progression.js?v=11';
import {
  buildExport,
  parseBackup,
  parseRecommendations,
  previewRecommendations,
  applyRecommendations,
  exportFileName
} from './logic/exportImport.js?v=11';
import { unlockAudio, setSoundMode, beep30, sayReady } from './sound.js?v=11';

const root = document.getElementById('app');
let periodDays = 28;
let pendingImport = null;
let toastTimer = null;

function persist(session) {
  const target = session || state.session;
  if (!target) return;
  const list = state.sessions.filter((s) => s.id !== target.id);
  list.unshift(target);
  state.sessions = list;
  saveSessions(list);
}

function saveAppData() {
  saveData({
    library: state.library,
    programs: state.programs,
    activeProgramId: state.activeProgramId
  });
}

function toast(text) {
  let box = document.getElementById('toast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast';
    document.body.appendChild(box);
  }
  box.textContent = text;
  box.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('is-visible'), 2500);
}

function lastBodyWeight() {
  const withWeight = state.sessions.find((s) => s.bodyWeightKg);
  if (withWeight) return withWeight.bodyWeightKg;
  return state.settings.bodyWeightKg != null ? state.settings.bodyWeightKg : null;
}

function activeProgram() {
  return (
    state.programs.find((p) => p.id === state.activeProgramId) ||
    state.programs[0] ||
    null
  );
}

// Собираем упражнения выбранного дня: копии из библиотеки с номером блока.
function programExercises() {
  const program = activeProgram();
  if (!program) return [];
  const result = [];
  for (const item of program.items || []) {
    const ex = state.library.find((e) => e.id === item.exerciseId);
    if (!ex) continue;
    result.push({
      ...ex,
      supersetGroup: item.supersetGroup != null ? item.supersetGroup : null
    });
  }
  return result;
}

function prunePrograms() {
  const ids = new Set(state.library.map((ex) => ex.id));
  for (const program of state.programs) {
    program.items = (program.items || []).filter((item) => ids.has(item.exerciseId));
  }
}

function showStart() {
  if (state.session && state.session.status === 'finished') state.session = null;
  const exercises = programExercises();
  const targets = resolveTargets(exercises, state.sessions, state.recommendations);
  show(startScreen, {
    programs: state.programs,
    activeProgramId: state.activeProgramId,
    exercises,
    targets,
    lastBodyWeight: lastBodyWeight(),
    onStart(bodyWeightKg) {
      startWorkout(bodyWeightKg, targets);
    },
    onSelectProgram(id) {
      state.activeProgramId = id;
      saveAppData();
      showStart();
    },
    onNav(name) {
      if (name === 'programs') openPrograms();
      else if (name === 'history') openHistory();
      else if (name === 'analysis') openAnalysis();
      else openSettings();
    }
  });
}

function startWorkout(bodyWeightKg, targets) {
  unlockAudio();
  const bw = bodyWeightKg != null ? bodyWeightKg : lastBodyWeight();
  state.session = newSession(programExercises(), bw, targets);
  persist(state.session);
  showCurrent();
}

function restAfter(ref, next) {
  if (!next) return 0;
  if (next.ei === ref.ei) return (ref.item.restSec || 0) * 1000;
  const transition = ref.ex.transitionRestSec;
  const seconds = transition != null ? transition : ref.item.restSec || 0;
  return seconds * 1000;
}

function nextInfo(next) {
  if (!next) return null;
  const detail =
    next.kind === 'warmup' ? 'разминка' : `подход ${next.ii + 1} из ${next.ex.sets.length}`;
  return { name: next.ex.name, detail };
}

function supersetInfo(ref) {
  const group = ref.ex.supersetGroup;
  if (group == null) return null;
  const members = state.session.exercises.filter((ex) => ex.supersetGroup === group);
  const rounds = Math.max(...members.map((ex) => ex.sets.length));
  return { round: ref.ii + 1, rounds, members: members.length };
}

function showCurrent() {
  const ref = findNext(state.session);
  if (!ref) {
    finishWorkout();
    return;
  }
  show(setScreen, {
    ex: ref.ex,
    item: ref.item,
    kind: ref.kind,
    si: ref.ii,
    total: ref.kind === 'warmup' ? ref.ex.warmupSets.length : ref.ex.sets.length,
    startedAt: state.session.startedAt,
    showRir: Boolean(state.settings.showRir),
    bodyWeightKg: state.session.bodyWeightKg,
    superset: ref.kind === 'set' ? supersetInfo(ref) : null,
    onNote(text) {
      ref.ex.note = text;
      persist(state.session);
    },
    onSkip() {
      unlockAudio();
      skipItem(ref.item);
      persist(state.session);
      afterItem(ref, true);
    },
    onLog(weightKg, reps, rir) {
      unlockAudio();
      logSet(ref.item, weightKg, reps, { rir });
      persist(state.session);
      afterItem(ref, false);
    }
  });
}

function afterItem(ref, skipped) {
  const next = findNext(state.session);
  if (skipped) {
    if (next) showCurrent();
    else finishWorkout();
    return;
  }
  const restMs = restAfter(ref, next);
  if (!next || restMs <= 0) {
    if (next) showCurrent();
    else finishWorkout();
    return;
  }
  show(restScreen, {
    durationMs: restMs,
    next: nextInfo(next),
    soundEnabled: Boolean(state.settings.soundEnabled),
    onAdjust(delta) {
      ref.item.restAdjustments.push({ at: new Date().toISOString(), delta });
      persist(state.session);
    },
    onSkip() {
      ref.item.restSkipped = true;
      persist(state.session);
    },
    onDone() {
      if (findNext(state.session)) showCurrent();
      else finishWorkout();
    }
  });
}

function finishWorkout() {
  finishSession(state.session);
  persist(state.session);
  const session = state.session;
  openSummary(session, {
    title: 'Итоги',
    doneLabel: 'Готово',
    onBack() {
      showStart();
    },
    onDone() {
      state.session = null;
      showStart();
    }
  });
}

function openSummary(session, options) {
  show(summaryScreen, {
    session,
    title: options.title,
    doneLabel: options.doneLabel,
    onChanged() {
      persist(session);
    },
    onBack: options.onBack,
    onDone: options.onDone,
    onReport() {
      openReport(session, () => openSummary(session, options));
    }
  });
}

async function shareText(text) {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Тренировка', text });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Отчёт скопирован — вставь в чат');
  } catch (err) {
    window.prompt('Скопируй отчёт:', text);
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Скопировано');
  } catch (err) {
    window.prompt('Скопируй текст:', text);
  }
}

// Проверка звука из настроек: короткий сигнал и голос текущим движком.
function testSound() {
  unlockAudio();
  setSoundMode(state.settings.soundMode);
  setTimeout(() => beep30(), 80);
  setTimeout(() => sayReady(), 600);
  toast(
    state.settings.soundMode === 'media'
      ? 'Звук через медиа: слышно в беззвучном режиме'
      : 'Звук вместе с музыкой: нужен выключенный «Без звука»'
  );
}

function openReport(session, onBack) {
  const report = buildSessionReport(session);
  const text = reportText(report);
  show(reportScreen, {
    text,
    onShare() {
      shareText(text);
    },
    onCopy() {
      copyText(text);
    },
    onDownload() {
      download(reportFileName(session), JSON.stringify(report, null, 2));
      toast('JSON сохранён');
    },
    onBack
  });
}

function shareSession(session) {
  shareText(reportText(buildSessionReport(session)));
}

function openHistory() {
  show(historyScreen, {
    sessions: state.sessions,
    onBack: showStart,
    onShare: shareSession,
    onOpen(session) {
      openSummary(session, {
        title: 'Тренировка',
        doneLabel: 'Назад',
        onBack: openHistory,
        onDone: openHistory
      });
    }
  });
}

function openPrograms() {
  show(programsScreen, {
    library: state.library,
    programs: state.programs,
    activeProgramId: state.activeProgramId,
    onBack: showStart,
    onSavePrograms(next) {
      state.programs = next;
      saveAppData();
    },
    onSaveActive(id) {
      state.activeProgramId = id;
      saveAppData();
    },
    onOpenLibrary(exerciseId) {
      openLibrary(exerciseId);
    }
  });
}

function openLibrary(openId) {
  show(libraryScreen, {
    library: state.library,
    openId,
    onBack: openPrograms,
    onSave(next) {
      state.library = next;
      prunePrograms();
      saveAppData();
    }
  });
}

function openAnalysis() {
  show(analysisScreen, {
    sessions: state.sessions,
    settings: state.settings,
    periodDays,
    onBack: showStart,
    onPeriod(days) {
      periodDays = days;
      openAnalysis();
    },
    onToggle(key) {
      state.settings.analysis[key] = !state.settings.analysis[key];
      saveSettings(state.settings);
      openAnalysis();
    }
  });
}

function openSettings() {
  show(settingsScreen, {
    settings: state.settings,
    onBack: showStart,
    onSave(settings) {
      state.settings = settings;
      saveSettings(settings);
      setSoundMode(settings.soundMode);
    },
    onExport: exportToFile,
    onCopy: copyExport,
    onPasteRecs: pasteRecommendations,
    onImportRecs: importRecommendations,
    onImportBackup: importBackup,
    onClear: clearAll,
    onTestSound: testSound
  });
}

function exportJson() {
  return JSON.stringify(
    buildExport({
      library: state.library,
      programs: state.programs,
      activeProgramId: state.activeProgramId,
      sessions: state.sessions,
      settings: state.settings,
      recommendations: state.recommendations
    }),
    null,
    2
  );
}

function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportToFile() {
  download(exportFileName(), exportJson());
  toast('Файл сохранён в «Файлы»');
}

async function copyExport() {
  const text = exportJson();
  try {
    await navigator.clipboard.writeText(text);
    toast('JSON скопирован');
  } catch (err) {
    window.prompt('Скопируй JSON вручную:', text);
  }
}

function pickFile(callback) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json,.txt';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => callback(String(reader.result || ''), file.name);
    reader.onerror = () => toast('Не удалось прочитать файл');
    reader.readAsText(file);
    input.remove();
  });
  input.click();
}

function previewRecommendation(text, name) {
  const parsed = parseRecommendations(text);
  if (!parsed.ok) {
    toast(parsed.error);
    return;
  }
  pendingImport = parsed.recommendation;
  show(importScreen, {
    preview: previewRecommendations(state.library, parsed.recommendation),
    comment: parsed.recommendation.comment,
    errors: parsed.errors,
    fileName: name,
    onCancel: openSettings,
    onApply() {
      applyImport(pendingImport);
      pendingImport = null;
    }
  });
}

function applyImport(recommendation) {
  const result = applyRecommendations(state.library, recommendation);
  state.library = result.library;

  const program = activeProgram();
  if (program) {
    program.items = program.items || [];
    for (const id of result.added || []) {
      program.items.push({ exerciseId: id, supersetGroup: null });
    }
    const changes = recommendation.programChanges || {};
    if (Array.isArray(changes.reorder) && changes.reorder.length) {
      const order = changes.reorder;
      program.items.sort((a, b) => {
        const ia = order.indexOf(a.exerciseId);
        const ib = order.indexOf(b.exerciseId);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      });
    }
    if (Array.isArray(changes.removeExerciseIds)) {
      program.items = program.items.filter(
        (item) => !changes.removeExerciseIds.includes(item.exerciseId)
      );
    }
  }

  prunePrograms();
  state.recommendations = recommendation;
  saveRecommendations(recommendation);
  saveAppData();
  toast(`Применено рекомендаций: ${result.applied}`);
  openPrograms();
}

function importRecommendations() {
  pickFile((text, name) => previewRecommendation(text, name));
}

async function pasteRecommendations() {
  let text = '';
  try {
    text = await navigator.clipboard.readText();
  } catch (err) {
    text = window.prompt('Вставь JSON рекомендаций:') || '';
  }
  if (!text || !text.trim()) return;
  previewRecommendation(text, 'из буфера');
}

function importBackup() {
  pickFile((text) => {
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      toast(parsed.error);
      return;
    }
    if (!window.confirm('Заменить библиотеку, программы и историю данными из файла?')) return;
    saveBackupSlot({
      library: state.library,
      programs: state.programs,
      activeProgramId: state.activeProgramId,
      sessions: state.sessions,
      settings: state.settings,
      savedAt: new Date().toISOString()
    });
    state.library = parsed.backup.library;
    state.programs = parsed.backup.programs;
    state.activeProgramId = parsed.backup.activeProgramId;
    state.sessions = parsed.backup.sessions;
    state.settings = Object.assign({}, state.settings, parsed.backup.settings);
    state.session = null;
    saveAppData();
    saveSessions(state.sessions);
    saveSettings(state.settings);
    toast('Данные восстановлены');
    showStart();
  });
}

function clearAll() {
  if (!window.confirm('Удалить библиотеку, программы, историю и настройки? Это необратимо.')) return;
  remove('data');
  remove('program');
  remove('sessions');
  remove('settings');
  remove('recommendations');
  const data = loadData();
  state.library = data.library;
  state.programs = data.programs;
  state.activeProgramId = data.activeProgramId;
  state.settings = loadSettings();
  state.sessions = [];
  state.session = null;
  state.recommendations = null;
  showStart();
  toast('Все данные удалены');
}

function boot() {
  const data = loadData();
  state.library = data.library;
  state.programs = data.programs;
  state.activeProgramId = data.activeProgramId;
  state.settings = loadSettings();
  state.sessions = loadSessions();
  state.recommendations = loadRecommendations();
  setSoundMode(state.settings.soundMode);
  initRouter(root);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  const active = state.sessions.find((s) => s.status === 'active');
  if (active) {
    state.session = active;
    showCurrent();
    return;
  }
  showStart();
}

function renderFatal(err) {
  const message = err && err.message ? err.message : String(err);
  const stack = err && err.stack ? String(err.stack).split('\n').slice(0, 6).join('\n') : '';
  console.error('boot failed', err);

  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `
      <div class="screen is-active">
        <div class="card">
          <div class="label">Ошибка запуска</div>
          <div class="comment" id="fatal-text"></div>
          <button class="btn" id="fatal-reload">Перезагрузить</button>
        </div>
      </div>`;
    app.querySelector('#fatal-text').textContent = message + (stack ? '\n\n' + stack : '');
    app.querySelector('#fatal-reload').addEventListener('click', () => window.location.reload());
  }
  if (typeof window.__showBootError === 'function') {
    window.__showBootError('Запуск: ' + message);
  }
}

try {
  boot();
} catch (err) {
  renderFatal(err);
}
