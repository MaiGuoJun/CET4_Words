"use strict";

const STORAGE_KEY = "mogu-cet4-state-v1";
const DB_NAME = "mogu-cet4-audio";
const DB_VERSION = 1;
const STABLE_LOCAL_ORIGIN = "http://127.0.0.1:4174";
const WORD_PHASE_SECONDS = 15 * 60;
const LISTEN_PHASE_SECONDS = 15 * 60;
const EXAM_DEFAULT = "2026-12-12";
const SYNC_CONFIG_KEY = "mogu-cet4-sync-config-v1";
const SYNC_DEVICE_KEY = "mogu-cet4-sync-device-v1";
const SYNC_POLL_MS = 45 * 1000;
const DEFAULT_SYNC_ENDPOINT = "https://mogu-cet4-sync.wb408study.workers.dev";
const DEVICE_AI_CONFIG_KEY = "mogu-cet4-device-ai-v1";
const ZHIPU_CHAT_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const DEFAULT_ZHIPU_MODEL = "glm-5.3-flash";

const fallbackWords = [
  { word: "access", phonetic: "ˈækses", partOfSpeech: "n. / v.", translation: "进入、存取", frequency: 86, phrase: "have access to", phraseMeaning: "有权使用；可以接近" },
  { word: "available", phonetic: "əˈveɪləbl", partOfSpeech: "adj.", translation: "可获得的、可用的", frequency: 121, phrase: "be available to", phraseMeaning: "可被……获得或使用" },
  { word: "approach", phonetic: "əˈprəʊtʃ", partOfSpeech: "n. / v.", translation: "接近、方法", frequency: 174, phrase: "an approach to", phraseMeaning: "处理……的方法" },
  { word: "benefit", phonetic: "ˈbenɪfɪt", partOfSpeech: "n. / v.", translation: "益处、好处", frequency: 193, phrase: "benefit from", phraseMeaning: "从……中受益" },
  { word: "concern", phonetic: "kənˈsɜːn", partOfSpeech: "n. / v.", translation: "关心、涉及", frequency: 212, phrase: "be concerned about", phraseMeaning: "担心；关注" },
  { word: "contribute", phonetic: "kənˈtrɪbjuːt", partOfSpeech: "v.", translation: "贡献", frequency: 286, phrase: "contribute to", phraseMeaning: "有助于；促成" },
  { word: "determine", phonetic: "dɪˈtɜːmɪn", partOfSpeech: "v.", translation: "决定", frequency: 302, phrase: "be determined to", phraseMeaning: "决心做……" },
  { word: "essential", phonetic: "ɪˈsenʃl", partOfSpeech: "adj.", translation: "必要的、必不可少的", frequency: 337, phrase: "be essential to", phraseMeaning: "对……至关重要" },
  { word: "maintain", phonetic: "meɪnˈteɪn", partOfSpeech: "v.", translation: "保持、维持", frequency: 468, phrase: "maintain a balance", phraseMeaning: "保持平衡" },
  { word: "responsible", phonetic: "rɪˈspɒnsəbl", partOfSpeech: "adj.", translation: "负责的", frequency: 614, phrase: "be responsible for", phraseMeaning: "对……负责；是……的原因" }
];

const AI_SCENARIOS = {
  campus: {
    title: "校园生活",
    goal: "围绕校园日常自然交流，并学会补充理由。",
    opening: "Let’s talk about campus life. What is one part of your daily routine at school that you enjoy?"
  },
  travel: {
    title: "旅行出行",
    goal: "练习问路、交通、住宿等真实出行情景。",
    opening: "Imagine you are planning a short trip. Where would you like to go, and how would you travel there?"
  },
  interview: {
    title: "面试表达",
    goal: "清楚介绍自己，并用具体例子说明个人经历。",
    opening: "Welcome! Please introduce yourself and tell me about one strength that would help you in a student club."
  },
  technology: {
    title: "科技话题",
    goal: "围绕常见四级科技话题表达观点、理由与例子。",
    opening: "Technology has changed the way students learn. Which change has helped you the most, and why?"
  },
  free: {
    title: "自由畅聊",
    goal: "不设固定情景，跟随你感兴趣的话题自由交流。",
    opening: "This is an open conversation. What would you like to talk about today?"
  }
};

const defaultAIState = () => ({ scenario: "campus", mode: "text", sessions: {} });

const defaultState = () => ({
  version: 1,
  settings: {
    examDate: EXAM_DEFAULT,
    scoreGoal: 500,
    dailyTarget: 25,
    targetIsManual: false,
    targetManualDate: null,
    theme: "system",
    accent: "en-US",
    voiceURI: "",
    presumedKnown: 3000
  },
  wordStates: {},
  daily: {},
  completedListening: [],
  ai: defaultAIState(),
  lastBackupAt: null,
  createdAt: new Date().toISOString()
});

let state = loadState();
let words = [];
let listeningTracks = [];
let currentView = "today";
let studyMode = "screen";
let currentWordIndex = 0;
let currentWord = null;
let studyQueue = [];
let stableStudyHeight = 0;
let quizQueue = [];
let currentQuiz = null;
let currentTrack = null;
let objectAudioUrl = null;
let loopA = null;
let loopB = null;
const pronunciationCache = new Map();
const pronunciationAssetCache = new Map();
let pronunciationAudio = null;
let pronunciationRequestId = 0;
let pronunciationAudioContext = null;
let pronunciationAudioSource = null;
let aiPending = false;
let aiServiceStatus = "checking";
let aiServiceInfo = null;
let aiBackendAvailable = false;
let deviceAIConfig = loadDeviceAIConfig();
let aiTextSpeech = { utterance: null, messageIndex: null };
let voiceSession = {
  state: "idle",
  active: false,
  recognition: null,
  restartTimer: null,
  utterance: null,
  statusMessage: "准备开始语音练习",
  hintMessage: "点击开始，说一句英语；AI 会回答并由系统朗读。",
  transcript: ""
};
let textDictation = {
  recognition: null,
  listening: false,
  baseText: "",
  finalText: ""
};
let syncConfig = loadSyncConfig();
let cloudSync = {
  status: syncConfig.endpoint && syncConfig.token ? "connecting" : "unconfigured",
  detail: syncConfig.endpoint && syncConfig.token ? "等待连接 Cloudflare" : "填写地址和密码后连接",
  revision: 0,
  ready: false,
  busy: false,
  timer: null,
  pollTimer: null,
  lastSyncedAt: syncConfig.lastSyncedAt || null
};
let timer = {
  phase: "word",
  duration: WORD_PHASE_SECONDS,
  remaining: WORD_PHASE_SECONDS,
  running: false,
  interval: null,
  sessionSeconds: 0,
  warned45: false
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function normalizeState(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaultState();
  const base = defaultState();
  return {
    ...base,
    ...parsed,
    settings: { ...base.settings, ...(parsed.settings || {}) },
    wordStates: parsed.wordStates && typeof parsed.wordStates === "object" ? parsed.wordStates : {},
    daily: parsed.daily && typeof parsed.daily === "object" ? parsed.daily : {},
    completedListening: Array.isArray(parsed.completedListening) ? parsed.completedListening : [],
    ai: {
      ...base.ai,
      ...(parsed.ai || {}),
      sessions: { ...(parsed.ai?.sessions || {}) }
    }
  };
}

function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return defaultState();
  }
}

function loadSyncConfig() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SYNC_CONFIG_KEY));
    return {
      endpoint: String(parsed?.endpoint || DEFAULT_SYNC_ENDPOINT).replace(/\/+$/, ""),
      token: String(parsed?.token || ""),
      lastSyncedAt: parsed?.lastSyncedAt || null
    };
  } catch {
    return { endpoint: DEFAULT_SYNC_ENDPOINT, token: "", lastSyncedAt: null };
  }
}

function saveSyncConfig() {
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(syncConfig));
}

function loadDeviceAIConfig() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEVICE_AI_CONFIG_KEY));
    const model = ["glm-5.3-flash", "glm-5.3-flashx"].includes(parsed?.model) ? parsed.model : DEFAULT_ZHIPU_MODEL;
    return { apiKey: String(parsed?.apiKey || "").trim(), model };
  } catch {
    return { apiKey: "", model: DEFAULT_ZHIPU_MODEL };
  }
}

function saveDeviceAIConfig() {
  localStorage.setItem(DEVICE_AI_CONFIG_KEY, JSON.stringify(deviceAIConfig));
}

function syncDeviceId() {
  let value = localStorage.getItem(SYNC_DEVICE_KEY);
  if (value) return value;
  value = globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(SYNC_DEVICE_KEY, value);
  return value;
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  persistState();
  scheduleCloudSync();
}

function normalizeSyncEndpoint(value) {
  let endpoint = String(value || "").trim().replace(/\/+$/, "");
  if (endpoint.endsWith("/sync")) endpoint = endpoint.slice(0, -5);
  const url = new URL(endpoint);
  const local = ["127.0.0.1", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new Error("同步地址必须使用 HTTPS");
  return endpoint;
}

function itemTimestamp(item) {
  return Math.max(...[item?.lastReviewedAt, item?.learnedAt, item?.screenedAt, item?.completedAt]
    .map((value) => Date.parse(value || "") || 0));
}

function stateTimestamp(value) {
  return Date.parse(value?.updatedAt || value?.createdAt || "") || 0;
}

function mergeCloudStates(localState, remoteState) {
  const local = normalizeState(localState);
  const remote = normalizeState(remoteState);
  const localNewer = stateTimestamp(local) >= stateTimestamp(remote);
  const primary = localNewer ? local : remote;
  const secondary = localNewer ? remote : local;
  const wordStates = {};
  for (const word of new Set([...Object.keys(remote.wordStates), ...Object.keys(local.wordStates)])) {
    const localItem = local.wordStates[word];
    const remoteItem = remote.wordStates[word];
    if (!localItem) wordStates[word] = remoteItem;
    else if (!remoteItem) wordStates[word] = localItem;
    else wordStates[word] = itemTimestamp(localItem) >= itemTimestamp(remoteItem) ? localItem : remoteItem;
  }

  const daily = {};
  for (const date of new Set([...Object.keys(remote.daily), ...Object.keys(local.daily)])) {
    const left = remote.daily[date] || {};
    const right = local.daily[date] || {};
    daily[date] = { ...left, ...right };
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      if (typeof left[key] === "number" || typeof right[key] === "number") daily[date][key] = Math.max(Number(left[key]) || 0, Number(right[key]) || 0);
    }
  }

  const listening = new Map();
  [...remote.completedListening, ...local.completedListening].forEach((entry) => {
    if (!entry?.trackId) return;
    const key = `${entry.trackId}:${entry.date || ""}`;
    const previous = listening.get(key);
    if (!previous || itemTimestamp(entry) >= itemTimestamp(previous)) listening.set(key, entry);
  });

  const createdTimes = [local.createdAt, remote.createdAt].filter(Boolean).sort();
  const backupTimes = [local.lastBackupAt, remote.lastBackupAt].filter(Boolean).sort();
  const updatedTimes = [local.updatedAt, remote.updatedAt].filter(Boolean).sort();
  return normalizeState({
    ...secondary,
    ...primary,
    settings: primary.settings,
    wordStates,
    daily,
    completedListening: [...listening.values()],
    ai: primary.ai,
    createdAt: createdTimes[0] || new Date().toISOString(),
    lastBackupAt: backupTimes.at(-1) || null,
    updatedAt: updatedTimes.at(-1) || new Date().toISOString()
  });
}

function scheduleCloudSync(delay = 1200) {
  if (!cloudSync.ready || !syncConfig.endpoint || !syncConfig.token) return;
  clearTimeout(cloudSync.timer);
  cloudSync.timer = window.setTimeout(() => { void syncNow(); }, delay);
}

async function cloudSyncRequest(method, payload) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${syncConfig.endpoint}/sync`, {
      method,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${syncConfig.token}`,
        ...(payload ? { "Content-Type": "application/json" } : {})
      },
      body: payload ? JSON.stringify(payload) : undefined
    });
    let data = {};
    try { data = await response.json(); } catch {}
    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

function setSyncStatus(status, detail) {
  cloudSync.status = status;
  cloudSync.detail = detail;
  renderSyncStatus();
}

async function syncNow({ notify = false } = {}) {
  if (cloudSync.busy) return;
  if (!syncConfig.endpoint || !syncConfig.token) {
    setSyncStatus("unconfigured", "填写地址和密码后连接");
    return;
  }
  cloudSync.busy = true;
  setSyncStatus("syncing", "正在与 Cloudflare 合并学习记录…");
  try {
    let { response, data: remote } = await cloudSyncRequest("GET");
    if (response.status === 401) throw new Error("同步密码不正确");
    if (!response.ok) throw new Error(remote.error || `同步服务返回 ${response.status}`);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      cloudSync.revision = Number(remote.revision) || 0;
      const merged = remote.state ? mergeCloudStates(state, remote.state) : normalizeState(state);
      const localChanged = JSON.stringify(merged) !== JSON.stringify(state);
      const remoteChanged = !remote.state || JSON.stringify(merged) !== JSON.stringify(normalizeState(remote.state));
      state = merged;
      persistState();
      if (localChanged) {
        applyTheme();
        renderAll();
      }
      if (!remoteChanged) break;

      const result = await cloudSyncRequest("PUT", { baseRevision: cloudSync.revision, deviceId: syncDeviceId(), state });
      if (result.response.status === 409 && attempt === 0) {
        remote = result.data;
        continue;
      }
      if (result.response.status === 401) throw new Error("同步密码不正确");
      if (!result.response.ok) throw new Error(result.data.error || `同步服务返回 ${result.response.status}`);
      remote = result.data;
      cloudSync.revision = Number(remote.revision) || cloudSync.revision;
      if (remote.state) {
        state = mergeCloudStates(state, remote.state);
        persistState();
      }
      break;
    }

    cloudSync.lastSyncedAt = new Date().toISOString();
    syncConfig.lastSyncedAt = cloudSync.lastSyncedAt;
    saveSyncConfig();
    setSyncStatus("synced", `云端版本 ${cloudSync.revision} · 已自动同步`);
    if (notify) toast("同步完成", "手机和电脑现在会自动合并学习进度。" );
  } catch (error) {
    const offline = !navigator.onLine || error?.name === "AbortError" || error instanceof TypeError;
    setSyncStatus(offline ? "offline" : "error", offline ? "当前离线，记录已安全保存在本机" : (error.message || "同步失败，请稍后重试"));
    if (notify) toast(offline ? "暂时无法连接云端" : "同步未完成", cloudSync.detail);
  } finally {
    cloudSync.busy = false;
    renderSyncStatus();
  }
}

async function initializeCloudSync() {
  cloudSync.ready = true;
  clearInterval(cloudSync.pollTimer);
  cloudSync.pollTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") void syncNow();
  }, SYNC_POLL_MS);
  if (syncConfig.endpoint && syncConfig.token) await syncNow();
  else renderSyncStatus();
}

function storageScopeInfo() {
  const { origin, hostname } = window.location;
  if (origin === STABLE_LOCAL_ORIGIN) {
    return {
      label: "本机固定入口 · 4174",
      hint: syncConfig.endpoint && syncConfig.token ? "本机 AI 可用；学习记录同时由 Cloudflare 自动同步。" : "这是固定的本地入口。连接 Cloudflare 后可与手机自动同步。",
      warning: false
    };
  }
  if (hostname.endsWith(".ts.net")) {
    return {
      label: "Tailscale 私人入口",
      hint: "通过自己的电脑安全访问本地 AI；学习记录仍由 Cloudflare 自动同步。",
      warning: false
    };
  }
  if (hostname === "maiguojun.github.io") {
    return {
      label: "GitHub Pages 在线应用",
      hint: syncConfig.endpoint && syncConfig.token ? "已连接 Cloudflare，手机和电脑会读取同一份学习记录。" : "学习记录保存在当前浏览器；可在下方单独配置手机 AI。",
      warning: false
    };
  }
  if (["127.0.0.1", "localhost"].includes(hostname)) {
    return {
      label: `临时本机入口 · ${window.location.port || "默认端口"}`,
      hint: "当前端口不是固定入口。换端口会看到另一份存档；建议改用 127.0.0.1:4174，或先导出备份。",
      warning: true
    };
  }
  return {
    label: origin === "null" ? "临时文件地址" : origin,
    hint: "这是一个独立存档空间。切换到其他网址前，请先导出备份。",
    warning: true
  };
}

function renderStorageScope() {
  const scope = storageScopeInfo();
  const container = $("#storageScope");
  container.classList.toggle("warning", scope.warning);
  $("#storageOrigin").textContent = scope.label;
  $("#storageOrigin").title = window.location.origin;
  $("#storageScopeHint").textContent = scope.hint;
  $("#storageSummary").textContent = `当前地址已记录 ${Object.keys(state.wordStates).length} 个词 · ${learningDates().length} 个学习日`;
}

function warnTemporaryStorageScope() {
  const scope = storageScopeInfo();
  if (!scope.warning) return;
  const warningKey = `${STORAGE_KEY}-scope-warning`;
  if (sessionStorage.getItem(warningKey) === window.location.origin) return;
  sessionStorage.setItem(warningKey, window.location.origin);
  toast("当前是独立存档空间", "切换网址或端口前，请在设置页导出备份。" );
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateString, amount) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

function todayRecord() {
  const key = localDateKey();
  state.daily[key] ||= { screened: 0, learned: 0, quizCorrect: 0, quizTotal: 0, focusSeconds: 0, target: state.settings.dailyTarget };
  state.daily[key].target ||= state.settings.dailyTarget;
  return state.daily[key];
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function formatClock(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function daysUntilExam() {
  const exam = new Date(`${state.settings.examDate || EXAM_DEFAULT}T09:00:00`);
  const now = new Date();
  return Math.max(0, Math.ceil((exam - now) / 86400000));
}

function getWordState(word) {
  return state.wordStates[word.word] || null;
}

function stateCounts() {
  const counts = { known: 0, fuzzy: 0, unknown: 0, mastered: 0, screened: 0, unclassified: words.length };
  words.forEach((word) => {
    const item = state.wordStates[word.word];
    if (!item || !item.status) return;
    counts.screened += 1;
    counts.unclassified = Math.max(0, counts.unclassified - 1);
    if (item.status in counts) counts[item.status] += 1;
    if (item.audioVerified && item.status === "known") counts.mastered += 1;
  });
  return counts;
}

function recentMissedDebt() {
  let debt = 0;
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const record = state.daily[localDateKey(date)];
    if (!record) continue;
    debt += Math.max(0, (record.target || 20) - (record.learned || 0));
  }
  return debt;
}

function recommendedDailyTarget() {
  if (!words.length) return 25;
  const counts = stateCounts();
  const assumedRemaining = Math.max(0, words.length - Math.max(counts.known, state.settings.presumedKnown || 0));
  const explicitLearning = counts.fuzzy + counts.unknown;
  const remaining = Math.max(assumedRemaining, explicitLearning);
  const days = Math.max(1, daysUntilExam() - 1);
  const base = Math.max(20, Math.min(50, Math.ceil(remaining / days)));
  const makeup = Math.min(5, Math.ceil(recentMissedDebt() / 7));
  return Math.min(50, base + makeup);
}

function applyRecommendedTarget() {
  if (state.settings.targetManualDate !== localDateKey()) {
    state.settings.targetIsManual = false;
    state.settings.targetManualDate = null;
  }
  if (!state.settings.targetIsManual) {
    state.settings.dailyTarget = recommendedDailyTarget();
    const current = state.daily[localDateKey()];
    if (current) current.target = state.settings.dailyTarget;
  }
}

function toast(title, detail = "") {
  const item = document.createElement("div");
  item.className = "toast";
  item.innerHTML = `<strong>${escapeHtml(title)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ""}`;
  $("#toastRegion").append(item);
  window.setTimeout(() => item.classList.add("out"), 3500);
  window.setTimeout(() => item.remove(), 3750);
}

function replayMotion(element, className) {
  if (!element || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function applyTheme() {
  const theme = state.settings.theme;
  const resolved = theme === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : theme;
  document.documentElement.dataset.theme = resolved;
  $("meta[name='theme-color']")?.setAttribute("content", resolved === "light" ? "#edf6fb" : "#07111f");
}

async function loadContent() {
  const [wordResult, trackResult] = await Promise.allSettled([
    fetch("./data/words.json?v=10").then((response) => {
      if (!response.ok) throw new Error("word data unavailable");
      return response.json();
    }),
    fetch("./data/listening.json?v=6").then((response) => {
      if (!response.ok) throw new Error("listening data unavailable");
      return response.json();
    })
  ]);
  words = wordResult.status === "fulfilled" && wordResult.value.length ? wordResult.value : fallbackWords;
  listeningTracks = trackResult.status === "fulfilled" ? trackResult.value : [];
  listeningTracks.push(...(await getAllLocalTracks()));
  applyRecommendedTarget();
  saveState();
}

function renderNavigation() {
  $$("[data-view]").forEach((view) => {
    const active = view.dataset.view === currentView;
    view.hidden = !active;
    view.classList.toggle("active", active);
  });
  $$("[data-view-target]").forEach((button) => {
    const active = button.dataset.viewTarget === currentView;
    button.classList.toggle("active", active);
    if (button.classList.contains("nav-item")) active ? button.setAttribute("aria-current", "page") : button.removeAttribute("aria-current");
  });
  if (currentView === "progress") renderProgress();
  if (currentView === "listening") renderTrackList();
  if (currentView === "ai") renderAI();
}

function renderHeader() {
  const dateText = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
  $("#todayDate").textContent = dateText;
  $$('[data-countdown]').forEach((node) => { node.textContent = daysUntilExam(); });
}

function dueWords() {
  const today = localDateKey();
  return words.filter((word) => {
    const item = getWordState(word);
    return item?.learnedAt && item.due && item.due <= today;
  });
}

function unscreenedWords() {
  return words.filter((word) => !getWordState(word));
}

function newLearningWords() {
  return words.filter((word) => {
    const item = getWordState(word);
    return !item || (!item.learnedAt && ["unknown", "fuzzy"].includes(item.status));
  });
}

function renderToday() {
  const record = todayRecord();
  const counts = stateCounts();
  const due = dueWords().length;
  const target = state.settings.dailyTarget;
  const quizDone = record.quizTotal >= Math.min(10, target);
  const listened = state.completedListening.some((entry) => entry.date === localDateKey());
  const screenedGoal = Math.min(500, Math.max(0, words.length - counts.screened));
  const screeningActive = counts.screened < words.length && record.screened < screenedGoal;
  const learningProgress = Math.min(1, record.learned / Math.max(1, target));
  const finishedParts = Number(due === 0) + learningProgress + Number(quizDone) + Number(listened);
  const percent = Math.round((finishedParts / 4) * 100);

  $("#todayTarget").textContent = target;
  $("#settingsTargetOutput").textContent = target;
  $("#dailyTargetInput").value = target;
  $("#targetReason").textContent = state.settings.targetIsManual ? "已手动调整（20–50）" : `按剩余词量推荐 ${recommendedDailyTarget()} 个`;
  $("#dueCount").textContent = `${due} 个`;
  $("#newCount").textContent = record.learned > target ? `${target} / ${target} · 加练 ${record.learned - target}` : `${record.learned} / ${target}`;
  $("#quizCount").textContent = record.quizTotal ? `${record.quizCorrect} / ${record.quizTotal}` : "未开始";
  $("#listenCount").textContent = listened ? "已完成" : "未开始";
  $("#dailyOrbit").style.setProperty("--progress", `${percent}%`);
  $("#dailyPercent").textContent = `${percent}%`;
  $("#screenedStat").textContent = counts.screened;
  $("#learnedTodayStat").textContent = record.learned;
  $("#minutesTodayStat").textContent = Math.floor(record.focusSeconds / 60);

  if (screeningActive) {
    $("#missionTitle").textContent = `快速筛查 ${Math.max(0, screenedGoal - record.screened)} 个词`;
    $("#missionDetail").textContent = `已建立 ${counts.screened} 个词的基线。筛查用于找回原有进度，不占今日新词额度。`;
    $("#startMission").textContent = "继续快速筛查";
    $("#switchStudyMode").hidden = false;
  } else if (record.learned < target) {
    $("#missionTitle").textContent = `完成今日 ${target - record.learned} 个新词`;
    $("#missionDetail").textContent = `先处理 ${due} 个到期词，再完成新词与听音复核。`;
    $("#startMission").textContent = "开始今日单词";
    $("#switchStudyMode").hidden = true;
  } else if (!quizDone) {
    $("#missionTitle").textContent = "用抽测确认不是“看着眼熟”";
    $("#missionDetail").textContent = "完成看词辨义、听音选词和短语填空，把视觉记忆接到听觉上。";
    $("#startMission").textContent = "开始抽测";
    $("#switchStudyMode").hidden = true;
  } else if (!listened) {
    $("#missionTitle").textContent = "最后15分钟：完成一篇精听";
    $("#missionDetail").textContent = "先盲听，再查看原文，利用变速与 A–B 循环解决听不清的片段。";
    $("#startMission").textContent = "进入听力";
    $("#switchStudyMode").hidden = true;
  } else {
    $("#missionTitle").textContent = "今天的学习闭环完成了";
    $("#missionDetail").textContent = "新词、抽测和精听都已记录。可以继续加练，也可以安心收工。";
    $("#startMission").textContent = "再复习一组";
    $("#switchStudyMode").hidden = true;
  }

  updateStageStates(record, due, quizDone, listened);
}

function updateStageStates(record, due, quizDone, listened) {
  const values = [due === 0, record.learned >= state.settings.dailyTarget, quizDone, listened];
  $$(".stage").forEach((stage, index) => {
    stage.classList.toggle("done", values[index]);
    stage.classList.toggle("active", !values[index] && values.slice(0, index).every(Boolean));
  });
}

function startMissionFromState() {
  const counts = stateCounts();
  const record = todayRecord();
  if (counts.screened < words.length && record.screened < Math.min(500, words.length - counts.screened)) return openStudy("screen");
  if (record.learned < state.settings.dailyTarget) return openStudy("learn");
  if (record.quizTotal < Math.min(10, state.settings.dailyTarget)) return openStudy("quiz");
  currentView = "listening";
  renderNavigation();
}

function openStudy(mode) {
  stopAITextSpeech();
  studyMode = mode;
  $("#studyPanel").hidden = false;
  $$("[data-study-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.studyMode === mode);
    button.setAttribute("aria-selected", button.dataset.studyMode === mode ? "true" : "false");
  });
  currentWordIndex = 0;
  studyQueue = createStudyQueue(mode);
  stableStudyHeight = 0;
  $("#wordWorkspace").style.removeProperty("min-height");
  if (mode === "quiz") prepareQuiz();
  else renderCurrentWord();
  $("#studyPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function createStudyQueue(mode = studyMode) {
  if (mode === "screen") return unscreenedWords().slice(0, 500);
  if (mode !== "learn") return [];
  const due = dueWords();
  const dueNames = new Set(due.map((word) => word.word));
  const fresh = newLearningWords().filter((word) => !dueNames.has(word.word));
  const remainingNewWords = Math.max(0, state.settings.dailyTarget - todayRecord().learned);
  return [...due, ...fresh.slice(0, remainingNewWords)];
}

function wordSenseRows(word) {
  const senses = Array.isArray(word?.senses) ? word.senses.filter((sense) => sense?.meaning) : [];
  if (senses.length) return senses;
  return [{
    partOfSpeech: word?.partOfSpeech || "词义",
    meaning: word?.translation || "暂无释义",
    stars: 3
  }];
}

function frequencyStars(value) {
  const score = Math.max(1, Math.min(3, Number(value) || 1));
  const label = Number.isInteger(score) ? String(score) : score.toFixed(1);
  const stars = [1, 2, 3].map((position) => {
    const className = score >= position ? "full" : score >= position - 0.5 ? "half" : "empty";
    return `<span class="frequency-star ${className}" aria-hidden="true">★</span>`;
  }).join("");
  return `<span class="sense-stars" role="img" aria-label="考试常用度 ${label} 星" title="考试常用度 ${label} / 3 星">${stars}</span>`;
}

function renderWordLevel(word) {
  const badge = $("#wordLevel");
  if (!badge) return;
  const isCET6 = Boolean(word?.isCET6Supplement || word?.level === "CET6");
  badge.hidden = !word;
  badge.textContent = isCET6 ? "六级补充" : "四级";
  badge.classList.toggle("cet6", isCET6);
  $("#meaningTitle").textContent = isCET6 ? "六级补充词义" : "四级考频义项";
}

function renderWordMeanings(word) {
  $("#wordMeanings").innerHTML = wordSenseRows(word).map((sense) => `
    <li class="meaning-item">
      <span class="sense-pos">${escapeHtml(sense.partOfSpeech || "词义")}</span>
      <span class="sense-text">${escapeHtml(sense.meaning)}</span>
      ${frequencyStars(sense.stars)}
    </li>
  `).join("");
}

function wordPhraseRows(word) {
  const phrases = Array.isArray(word?.phrases) ? word.phrases.filter((item) => item?.text) : [];
  if (phrases.length) return phrases;
  return word?.phrase ? [{ text: word.phrase, meaning: word.phraseMeaning || "" }] : [];
}

function renderWordPhrases(word) {
  const phrases = wordPhraseRows(word);
  $("#phraseBox").hidden = !phrases.length;
  $("#wordPhrases").innerHTML = phrases.map((item) => `
    <li><strong>${escapeHtml(item.text)}</strong>${item.meaning ? `<p>${escapeHtml(item.meaning)}</p>` : ""}</li>
  `).join("");
}

function stabilizeStudyWorkspace() {
  const workspace = $("#wordWorkspace");
  stableStudyHeight = Math.max(stableStudyHeight, Math.ceil(workspace.getBoundingClientRect().height));
  workspace.style.minHeight = `${stableStudyHeight}px`;
}

function renderCurrentWord() {
  stopPronunciationAudio();
  resetNativePronunciationPlayer();
  renderPronunciationSource(null);
  if (!studyQueue.length || currentWordIndex >= studyQueue.length) {
    renderEmptyStudy();
    return;
  }
  currentWord = studyQueue[currentWordIndex];
  renderWordLevel(currentWord);
  setPronunciationButton("idle");
  const item = getWordState(currentWord);
  $("#wordText").textContent = currentWord.word;
  $("#wordPhonetic").textContent = currentWord.phonetic ? `/${currentWord.phonetic.replace(/^\/?|\/?$/g, "")}/` : "";
  renderWordMeanings(currentWord);
  $("#wordRank").textContent = `词频 #${currentWord.rank || currentWord.frequency || "—"}`;
  $("#wordStatus").textContent = item ? ({ known: "认识", fuzzy: "模糊", unknown: "不认识" }[item.status] || "待复习") : "未分类";
  $("#studyPosition").textContent = `${currentWordIndex + 1} / ${studyQueue.length}`;
  $("#wordReveal").hidden = true;
  $("#ratingActions").hidden = true;
  $("#quizOptions").hidden = true;
  $("#revealWord").hidden = false;
  $("#revealWord").textContent = "显示释义";
  renderWordPhrases(currentWord);
  void prepareCurrentPronunciation(currentWord.word);
  replayMotion($("#wordWorkspace"), "word-enter");
}

function renderEmptyStudy() {
  stopPronunciationAudio();
  resetNativePronunciationPlayer();
  renderPronunciationSource(null);
  currentWord = null;
  renderWordLevel(null);
  $("#wordText").textContent = "完成";
  $("#wordPhonetic").textContent = "这一组已经没有待处理单词";
  $("#wordReveal").hidden = true;
  $("#ratingActions").hidden = true;
  $("#quizOptions").hidden = true;
  $("#revealWord").hidden = true;
  $("#studyPosition").textContent = "✓";
  $("#wordMeanings").replaceChildren();
  $("#wordPhrases").replaceChildren();
  $("#phraseBox").hidden = true;
  setPronunciationButton("idle");
}

function revealCurrentWord() {
  if (!currentWord) return;
  $("#wordReveal").hidden = false;
  $("#ratingActions").hidden = false;
  $("#revealWord").hidden = true;
  replayMotion($("#wordReveal"), "reveal-enter");
  replayMotion($("#ratingActions"), "reveal-enter");
  stabilizeStudyWorkspace();
}

function rateCurrentWord(rating) {
  if (!currentWord) return;
  const date = localDateKey();
  const previous = getWordState(currentWord);
  const isFreshLearning = studyMode === "learn" && !previous?.learnedAt && (!previous || ["unknown", "fuzzy"].includes(previous.status));
  const schedule = { unknown: 0, fuzzy: 1, known: 3 };
  state.wordStates[currentWord.word] = {
    ...(previous || {}),
    status: rating,
    screenedAt: previous?.screenedAt || new Date().toISOString(),
    learnedAt: studyMode === "learn" ? (previous?.learnedAt || new Date().toISOString()) : previous?.learnedAt,
    due: addDays(date, schedule[rating]),
    reviewStep: rating === "known" ? Math.max(1, previous?.reviewStep || 0) : 0,
    audioVerified: previous?.audioVerified || false,
    lastReviewedAt: new Date().toISOString()
  };
  if (studyMode === "screen") todayRecord().screened += 1;
  if (isFreshLearning) todayRecord().learned += 1;
  saveState();
  currentWordIndex += 1;
  renderCurrentWord();
  renderToday();
}

function reviewDueDate(item, correct) {
  if (!correct) return localDateKey();
  const statusIntervals = {
    unknown: [0, 1, 3, 7],
    fuzzy: [1, 3, 7, 14],
    known: [3, 7, 14, 30]
  };
  const intervals = statusIntervals[item.status] || statusIntervals.fuzzy;
  const step = Math.min((item.reviewStep || 0) + 1, intervals.length - 1);
  item.reviewStep = step;
  return addDays(localDateKey(), intervals[step]);
}

function prepareQuiz() {
  const eligible = words.filter((word) => getWordState(word));
  const pool = eligible.length >= 4 ? eligible : words;
  quizQueue = shuffle([...pool]).slice(0, Math.min(10, pool.length)).map((word, index) => ({
    word,
    type: word.phrase && index % 3 === 2 ? "phrase" : index % 3 === 1 ? "audio" : "meaning"
  }));
  quizQueue.filter((question) => question.type === "audio").forEach((question) => {
    void getPronunciationAsset(question.word.word);
  });
  currentWordIndex = 0;
  renderQuizQuestion();
}

function renderQuizQuestion() {
  stopPronunciationAudio();
  resetNativePronunciationPlayer();
  renderPronunciationSource(null);
  if (!quizQueue.length || currentWordIndex >= quizQueue.length) {
    currentQuiz = null;
    renderEmptyStudy();
    toast("抽测完成", `本轮答对 ${todayRecord().quizCorrect} / ${todayRecord().quizTotal}`);
    renderToday();
    return;
  }
  currentQuiz = quizQueue[currentWordIndex];
  currentWord = currentQuiz.word;
  renderWordLevel(currentWord);
  setPronunciationButton("idle");
  const shuffledWords = shuffle(words.filter((word) => word.word !== currentWord.word));
  const otherWords = shuffledWords.slice(0, 3);
  let options;
  $("#wordReveal").hidden = true;
  $("#ratingActions").hidden = true;
  $("#revealWord").hidden = true;
  $("#quizOptions").hidden = false;
  $("#wordRank").textContent = ({ meaning: "看词辨义", audio: "听音选词", phrase: "短语填空" })[currentQuiz.type];
  $("#wordStatus").textContent = `第 ${currentWordIndex + 1} 题`;
  $("#studyPosition").textContent = `${currentWordIndex + 1} / ${quizQueue.length}`;
  $("#wordPhonetic").textContent = "";

  if (currentQuiz.type === "meaning") {
    $("#wordText").textContent = currentWord.word;
    const usedMeanings = new Set([currentWord.translation]);
    const meaningDistractors = shuffledWords.filter((word) => {
      const meaning = word.translation || word.word;
      if (usedMeanings.has(meaning)) return false;
      usedMeanings.add(meaning);
      return true;
    }).slice(0, 3);
    options = shuffle([currentWord, ...meaningDistractors]).map((word) => ({
      value: word.word,
      label: `${word.partOfSpeech ? `${word.partOfSpeech} ` : ""}${word.translation || word.word}`
    }));
  } else if (currentQuiz.type === "audio") {
    $("#wordText").textContent = "听发音，选单词";
    options = shuffle([currentWord, ...otherWords]).map((word) => ({ value: word.word, label: word.word }));
    const quizWord = currentWord.word;
    window.setTimeout(() => {
      if (currentQuiz?.word.word === quizWord) void speak(quizWord);
    }, 250);
  } else {
    $("#wordText").textContent = currentWord.phrase.replace(new RegExp(currentWord.word, "i"), "____");
    options = shuffle([currentWord, ...otherWords]).map((word) => ({ value: word.word, label: word.word }));
  }
  $("#quizOptions").innerHTML = options.map((option) => `<button class="quiz-option" type="button" data-answer="${escapeHtml(option.value)}">${escapeHtml(option.label)}</button>`).join("");
  void prepareCurrentPronunciation(currentWord.word);
  replayMotion($("#wordWorkspace"), "word-enter");
}

function answerQuiz(answer, button) {
  if (!currentQuiz || button.disabled) return;
  const correct = answer === currentQuiz.word.word;
  todayRecord().quizTotal += 1;
  if (correct) todayRecord().quizCorrect += 1;
  const item = state.wordStates[currentQuiz.word.word] || { status: "fuzzy", reviewStep: 0 };
  item.due = reviewDueDate(item, correct);
  item.lastReviewedAt = new Date().toISOString();
  if (currentQuiz.type === "audio" && correct) item.audioVerified = true;
  if (!correct) item.status = "unknown";
  state.wordStates[currentQuiz.word.word] = item;
  $$(".quiz-option").forEach((option) => {
    option.disabled = true;
    if (option.dataset.answer === currentQuiz.word.word) option.classList.add("correct");
  });
  if (!correct) button.classList.add("wrong");
  saveState();
  window.setTimeout(() => {
    currentWordIndex += 1;
    renderQuizQuestion();
  }, 850);
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [items[index], items[target]] = [items[target], items[index]];
  }
  return items;
}

function normalizePronunciationUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value).startsWith("//") ? `https:${value}` : value, window.location.origin);
    const isSameOrigin = url.origin === window.location.origin;
    const allowedRemoteHost = url.hostname === "api.dictionaryapi.dev"
      || url.hostname.endsWith(".dictionaryapi.dev")
      || url.hostname === "upload.wikimedia.org"
      || url.hostname.endsWith(".wikimedia.org")
      || url.hostname.endsWith(".wiktionary.org");
    return isSameOrigin || (url.protocol === "https:" && allowedRemoteHost) ? url.href : "";
  } catch {
    return "";
  }
}

function pronunciationAccent(phonetic) {
  const clue = [phonetic.audio, phonetic.sourceUrl, phonetic.text].filter(Boolean).join(" ").toLowerCase();
  if (/(?:^|[\/_-])(us|usa|american)(?:[\/_.-]|$)/.test(clue)) return "en-US";
  if (/(?:^|[\/_-])(uk|gb|british)(?:[\/_.-]|$)/.test(clue)) return "en-GB";
  if (/(?:^|[\/_-])(au|australia)(?:[\/_.-]|$)/.test(clue)) return "en-AU";
  return "";
}

function choosePronunciationClip(entries) {
  const preferredAccent = state.settings.accent || "en-US";
  const clips = (Array.isArray(entries) ? entries : []).flatMap((entry) => (
    Array.isArray(entry?.phonetics) ? entry.phonetics : []
  )).map((phonetic) => ({
    audio: normalizePronunciationUrl(phonetic.audio),
    sourceUrl: normalizePronunciationUrl(phonetic.sourceUrl),
    licenseName: typeof phonetic.license?.name === "string" ? phonetic.license.name : "",
    accent: pronunciationAccent(phonetic)
  })).filter((clip) => clip.audio);
  clips.sort((left, right) => {
    const score = (clip) => clip.accent === preferredAccent ? 3 : clip.accent ? 1 : 2;
    return score(right) - score(left);
  });
  return clips[0] || null;
}

async function fetchPronunciationJson(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchDictionaryPronunciation(word) {
  const data = await fetchPronunciationJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, 5000);
  return choosePronunciationClip(data);
}

async function fetchLocalPronunciation(word) {
  const params = new URLSearchParams({ word, accent: state.settings.accent || "en-US" });
  const data = await fetchPronunciationJson(`/api/pronunciation?${params}`, 10000);
  if (!data) return null;
  const audio = normalizePronunciationUrl(data.audio);
  if (!audio) return null;
  return {
    audio,
    sourceUrl: normalizePronunciationUrl(data.sourceUrl),
    licenseName: typeof data.licenseName === "string" ? data.licenseName : "",
    accent: data.accent === "en-GB" ? "en-GB" : data.accent === "en-US" ? "en-US" : ""
  };
}

function chooseWikimediaClip(data, word, accentCode) {
  const pages = Array.isArray(data?.query?.pages) ? data.query.pages : [];
  const normalizedWord = word.replace(/_/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const base = `en-${accentCode}-${normalizedWord}`;
  const suffixPattern = /^-(stressed|unstressed|noun|verb|adjective|adverb|1|2)$/;
  const candidates = pages.map((page) => {
    const info = page?.imageinfo?.[0];
    const title = String(page?.title || "").replace(/^File:/i, "");
    const stem = title.replace(/\.(ogg|oga|wav|mp3)$/i, "").replace(/_/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    const suffix = stem.startsWith(base) ? stem.slice(base.length) : "invalid";
    if (stem !== base && !suffixPattern.test(suffix)) return null;
    return {
      audio: normalizePronunciationUrl(info?.url),
      sourceUrl: normalizePronunciationUrl(info?.descriptionshorturl || info?.descriptionurl),
      licenseName: typeof info?.extmetadata?.LicenseShortName?.value === "string" ? info.extmetadata.LicenseShortName.value : "",
      accent: accentCode === "us" ? "en-US" : "en-GB",
      exact: stem === base
    };
  }).filter((clip) => clip?.audio);
  candidates.sort((left, right) => Number(right.exact) - Number(left.exact));
  return candidates[0] || null;
}

async function fetchWikimediaAccent(word, accentCode) {
  if (!/^[a-z][a-z' -]{0,60}$/i.test(word)) return null;
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `intitle:\"En-${accentCode}-${word}\"`,
    gsrnamespace: "6",
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    format: "json",
    formatversion: "2",
    origin: "*"
  });
  const data = await fetchPronunciationJson(`https://commons.wikimedia.org/w/api.php?${params}`, 5000);
  return chooseWikimediaClip(data, word, accentCode);
}

async function fetchWikimediaPronunciation(word) {
  const preferred = state.settings.accent === "en-GB" ? "uk" : "us";
  const alternate = preferred === "us" ? "uk" : "us";
  const preferredRequest = fetchWikimediaAccent(word, preferred);
  const alternateRequest = fetchWikimediaAccent(word, alternate);
  return (await preferredRequest) || (await alternateRequest);
}

function firstAvailablePronunciation(requests) {
  return new Promise((resolve) => {
    let pending = requests.length;
    let resolved = false;
    requests.forEach((request) => Promise.resolve(request).then((clip) => {
      if (clip && !resolved) {
        resolved = true;
        resolve(clip);
        return;
      }
      pending -= 1;
      if (!pending && !resolved) resolve(null);
    }).catch(() => {
      pending -= 1;
      if (!pending && !resolved) resolve(null);
    }));
  });
}

async function getPronunciationClip(text) {
  const word = String(text || "").trim().toLowerCase();
  if (!word) return null;
  const key = `${state.settings.accent || "en-US"}:${word}`;
  if (pronunciationCache.has(key)) return pronunciationCache.get(key);
  const isLocalApp = ["127.0.0.1", "localhost"].includes(window.location.hostname);
  const request = isLocalApp
    ? fetchLocalPronunciation(word)
    : firstAvailablePronunciation([fetchDictionaryPronunciation(word), fetchWikimediaPronunciation(word)]);
  pronunciationCache.set(key, request);
  const clip = await request;
  if (clip) pronunciationCache.set(key, clip);
  else pronunciationCache.delete(key);
  return clip;
}

function pronunciationCacheKey(text) {
  return `${state.settings.accent || "en-US"}:${String(text || "").trim().toLowerCase()}`;
}

function preparedPronunciationAsset(text) {
  const cached = pronunciationAssetCache.get(pronunciationCacheKey(text));
  return cached && typeof cached.then !== "function" ? cached : null;
}

async function getPronunciationAsset(text) {
  const key = pronunciationCacheKey(text);
  const cached = pronunciationAssetCache.get(key);
  if (cached) return cached;
  const request = (async () => {
    const clip = await getPronunciationClip(text);
    if (!clip) return null;
    const audio = new Audio(clip.audio);
    audio.preload = "auto";
    const ready = await new Promise((resolve) => {
      if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return resolve(true);
      const finish = (result) => {
        window.clearTimeout(timeout);
        audio.removeEventListener("canplay", onReady);
        audio.removeEventListener("error", onError);
        resolve(result);
      };
      const onReady = () => finish(true);
      const onError = () => finish(false);
      const timeout = window.setTimeout(() => finish(false), 12000);
      audio.addEventListener("canplay", onReady, { once: true });
      audio.addEventListener("error", onError, { once: true });
      audio.load();
    });
    return ready ? { clip, audio } : null;
  })();
  pronunciationAssetCache.set(key, request);
  const asset = await request;
  if (asset) {
    pronunciationAssetCache.set(key, asset);
    while (pronunciationAssetCache.size > 24) pronunciationAssetCache.delete(pronunciationAssetCache.keys().next().value);
  } else {
    pronunciationAssetCache.delete(key);
  }
  return asset;
}

async function prepareCurrentPronunciation(text) {
  if (!text || currentWord?.word !== text) return;
  setPronunciationButton("preparing", text);
  const clip = await getPronunciationClip(text);
  if (currentWord?.word !== text || pronunciationAudio || pronunciationAudioSource) return;
  if (clip) {
    showNativePronunciationPlayer({ clip }, text);
    void getPronunciationAsset(text);
  } else {
    setPronunciationButton("fallback", text);
  }
}

function resetNativePronunciationPlayer() {
  const player = $("#wordPronunciationPlayer");
  const button = $("#speakWord");
  if (!player || !button) return;
  delete player.dataset.word;
  player.pause();
  player.removeAttribute("src");
  player.load();
  player.hidden = true;
  button.hidden = false;
}

function showNativePronunciationPlayer(asset, text) {
  if (!asset || currentWord?.word !== text) return;
  const player = $("#wordPronunciationPlayer");
  const button = $("#speakWord");
  player.dataset.word = text;
  player.src = asset.clip.audio;
  player.hidden = false;
  button.hidden = true;
  player.load();
  renderPronunciationSource(asset.clip);
}

function stopPronunciationAudio(invalidate = true) {
  if (invalidate) pronunciationRequestId += 1;
  if (pronunciationAudio) {
    pronunciationAudio.pause();
    try { pronunciationAudio.currentTime = 0; } catch {}
    pronunciationAudio = null;
  }
  if (pronunciationAudioSource) {
    try { pronunciationAudioSource.stop(); } catch {}
    try { pronunciationAudioSource.disconnect(); } catch {}
    pronunciationAudioSource = null;
  }
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

function activatePronunciationAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  pronunciationAudioContext ||= new AudioContextClass();
  const ready = pronunciationAudioContext.state === "suspended"
    ? pronunciationAudioContext.resume().catch(() => {})
    : Promise.resolve();
  return { context: pronunciationAudioContext, ready };
}

function setPronunciationButton(status, text = currentWord?.word) {
  const button = $("#speakWord");
  if (!button) return;
  const matchesCurrentWord = Boolean(text && currentWord?.word === text);
  const waiting = ["loading", "preparing"].includes(status) && matchesCurrentWord;
  button.disabled = !currentWord || (status === "preparing" && matchesCurrentWord);
  button.classList.toggle("loading", waiting);
  button.setAttribute("aria-busy", waiting ? "true" : "false");
  button.textContent = status === "preparing" && matchesCurrentWord
    ? "准备真人发音…"
    : status === "fallback" && matchesCurrentWord
      ? "▶ 设备发音"
    : status === "loading" && matchesCurrentWord
      ? "获取真人发音…"
      : status === "playing" && matchesCurrentWord
        ? "正在播放…"
        : "▶ 真人发音";
}

function renderPronunciationSource(clip) {
  const container = $("#pronunciationSource");
  if (!container) return;
  container.replaceChildren();
  if (!clip) {
    container.hidden = false;
    container.classList.add("empty");
    container.setAttribute("aria-hidden", "true");
    return;
  }
  container.classList.remove("empty");
  container.removeAttribute("aria-hidden");
  const label = document.createElement("span");
  const accent = clip.accent === "en-US" ? "美音" : clip.accent === "en-GB" ? "英音" : "";
  label.textContent = clip.fallback ? "设备备用发音" : `真人录音${accent ? ` · ${accent}` : ""}`;
  container.append(label);
  if (!clip.fallback && clip.sourceUrl) {
    const source = document.createElement("a");
    source.href = clip.sourceUrl;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    source.textContent = "查看来源 ↗";
    container.append(source);
  }
  if (!clip.fallback && clip.licenseName) {
    const license = document.createElement("small");
    license.textContent = clip.licenseName;
    container.append(license);
  }
  container.hidden = false;
}

function speakWithSystemVoice(text) {
  if (!("speechSynthesis" in window) || !text) return false;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = state.settings.accent || "en-US";
  const selected = speechSynthesis.getVoices().find((voice) => voice.voiceURI === state.settings.voiceURI);
  if (selected) utterance.voice = selected;
  utterance.rate = 0.88;
  speechSynthesis.speak(utterance);
  return true;
}

async function speak(text, { notifyFallback = false } = {}) {
  if (!text) return;
  stopPronunciationAudio(false);
  const requestId = ++pronunciationRequestId;
  const prepared = preparedPronunciationAsset(text);
  if (prepared) {
    const { clip, audio } = prepared;
    pronunciationAudio = audio;
    audio.currentTime = 0;
    let failed = false;
    const fallback = (reason) => {
      if (failed || requestId !== pronunciationRequestId) return;
      failed = true;
      if (pronunciationAudio === audio) pronunciationAudio = null;
      renderPronunciationSource({ fallback: true });
      setPronunciationButton("idle", text);
      const spoke = speakWithSystemVoice(text);
      if (notifyFallback) {
        const detail = reason?.name === "NotAllowedError"
          ? "浏览器阻止了音频播放，请在地址栏允许声音后重试。"
          : spoke ? "已改用设备备用发音，请稍后再试。" : "请联网或更换浏览器后重试。";
        toast(reason?.name === "NotAllowedError" ? "浏览器阻止了真人录音" : spoke ? "真人录音暂时无法播放" : "当前无法播放发音", detail);
      }
    };
    audio.onended = () => {
      if (pronunciationAudio === audio) pronunciationAudio = null;
      if (requestId === pronunciationRequestId) setPronunciationButton("idle", text);
    };
    audio.onerror = () => fallback(audio.error);
    const playback = audio.play();
    renderPronunciationSource(clip);
    setPronunciationButton("playing", text);
    try {
      await playback;
    } catch (error) {
      fallback(error);
    }
    return;
  }
  const webAudio = notifyFallback ? activatePronunciationAudio() : pronunciationAudioContext?.state === "running"
    ? { context: pronunciationAudioContext, ready: Promise.resolve() }
    : null;
  setPronunciationButton("loading", text);
  const clip = await getPronunciationClip(text);
  if (requestId !== pronunciationRequestId) return;

  if (clip && webAudio) {
    try {
      await webAudio.ready;
      if (webAudio.context.state !== "running") throw new Error("audio context unavailable");
      const response = await fetch(clip.audio, { cache: "force-cache" });
      if (!response.ok) throw new Error(`audio status ${response.status}`);
      const buffer = await webAudio.context.decodeAudioData(await response.arrayBuffer());
      if (requestId !== pronunciationRequestId) return;
      const source = webAudio.context.createBufferSource();
      source.buffer = buffer;
      source.connect(webAudio.context.destination);
      pronunciationAudioSource = source;
      source.addEventListener("ended", () => {
        if (pronunciationAudioSource === source) pronunciationAudioSource = null;
        try { source.disconnect(); } catch {}
        if (requestId === pronunciationRequestId) setPronunciationButton("idle", text);
      }, { once: true });
      source.start();
      renderPronunciationSource(clip);
      setPronunciationButton("playing", text);
      return;
    } catch {
      if (requestId !== pronunciationRequestId) return;
    }
  }

  if (clip) {
    const audio = new Audio(clip.audio);
    pronunciationAudio = audio;
    audio.preload = "auto";
    audio.addEventListener("ended", () => {
      if (pronunciationAudio === audio) pronunciationAudio = null;
      if (requestId === pronunciationRequestId) setPronunciationButton("idle", text);
    }, { once: true });
    try {
      await audio.play();
      if (requestId !== pronunciationRequestId) return;
      renderPronunciationSource(clip);
      setPronunciationButton("playing", text);
      return;
    } catch {
      if (pronunciationAudio === audio) pronunciationAudio = null;
    }
  }

  renderPronunciationSource({ fallback: true });
  setPronunciationButton("idle", text);
  const spoke = speakWithSystemVoice(text);
  if (notifyFallback) toast(spoke ? "真人录音暂时无法播放" : "当前无法播放发音", spoke ? "已改用设备备用发音，请稍后再试。" : "请联网或更换支持发音的浏览器后重试。");
}

function renderVoices() {
  if (!("speechSynthesis" in window)) return;
  const select = $("#voiceSelect");
  const voices = speechSynthesis.getVoices().filter((voice) => /^en[-_]/i.test(voice.lang));
  select.innerHTML = `<option value="">真人录音不可用时使用设备默认声音</option>${voices.map((voice) => `<option value="${escapeHtml(voice.voiceURI)}">${escapeHtml(voice.name)} · ${escapeHtml(voice.lang)}${voice.localService ? " · 本地" : ""}</option>`).join("")}`;
  select.value = state.settings.voiceURI || "";
}

function setDailyTarget(value, manual = true) {
  state.settings.dailyTarget = Math.max(20, Math.min(50, Number(value) || 20));
  state.settings.targetIsManual = manual;
  state.settings.targetManualDate = manual ? localDateKey() : null;
  todayRecord().target = state.settings.dailyTarget;
  saveState();
  renderToday();
  renderSettings();
}

function renderTimer() {
  $(".timer-card").classList.toggle("running", timer.running);
  $("#timerPhase").textContent = timer.phase === "word" ? "单词阶段" : "听力阶段";
  $("#timerDisplay").textContent = formatClock(timer.remaining);
  $("#timerStatus").textContent = timer.running ? "专注中" : timer.remaining === 0 ? "已完成" : "未开始";
  $("#timerToggle").textContent = timer.running ? "暂停" : timer.remaining === 0 ? "继续15分钟" : "开始";
  $("#timerNext").textContent = timer.phase === "word" ? "切到听力" : "切到单词";
  const progress = ((timer.duration - timer.remaining) / timer.duration) * 100;
  $("#timerBar").style.width = `${Math.max(0, Math.min(100, progress))}%`;
}

function timerTick() {
  if (!timer.running) return;
  timer.remaining -= 1;
  timer.sessionSeconds += 1;
  todayRecord().focusSeconds += 1;
  if (timer.sessionSeconds >= 45 * 60 && !timer.warned45) {
    timer.warned45 = true;
    toast("已经专注45分钟", "可以继续，但建议先起身活动一下。近期学习记录会继续保存。");
  }
  if (timer.sessionSeconds % 10 === 0) saveState();
  if (timer.remaining <= 0) {
    timer.remaining = 0;
    timer.running = false;
    clearInterval(timer.interval);
    timer.interval = null;
    saveState();
    toast(`${timer.phase === "word" ? "单词" : "听力"}阶段完成`, "可以切换阶段，或继续加练15分钟。" );
  }
  renderTimer();
  if (timer.sessionSeconds % 5 === 0) renderToday();
}

function toggleTimer() {
  if (timer.remaining === 0) {
    timer.duration = 15 * 60;
    timer.remaining = timer.duration;
  }
  timer.running = !timer.running;
  if (timer.running) timer.interval = window.setInterval(timerTick, 1000);
  else {
    clearInterval(timer.interval);
    timer.interval = null;
    saveState();
  }
  renderTimer();
}

function switchTimerPhase() {
  clearInterval(timer.interval);
  timer.interval = null;
  timer.running = false;
  timer.phase = timer.phase === "word" ? "listen" : "word";
  timer.duration = timer.phase === "word" ? WORD_PHASE_SECONDS : LISTEN_PHASE_SECONDS;
  timer.remaining = timer.duration;
  renderTimer();
  if (timer.phase === "listen") {
    currentView = "listening";
    renderNavigation();
  }
}

function resetTimer() {
  clearInterval(timer.interval);
  timer.interval = null;
  timer.running = false;
  timer.duration = timer.phase === "word" ? WORD_PHASE_SECONDS : LISTEN_PHASE_SECONDS;
  timer.remaining = timer.duration;
  renderTimer();
}

function renderTrackList() {
  const list = $("#trackList");
  if (!listeningTracks.length) {
    list.innerHTML = `<div class="track-item"><strong>还没有听力材料</strong><small>导入本地音频后即可开始</small></div>`;
    return;
  }
  list.innerHTML = listeningTracks.map((track, index) => {
    const complete = state.completedListening.some((entry) => entry.trackId === track.id);
    return `<button class="track-item ${currentTrack?.id === track.id ? "active" : ""}" type="button" data-track-id="${escapeHtml(track.id)}"><span class="track-number">${String(index + 1).padStart(2, "0")} ${complete ? "· 已完成" : ""}</span><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.duration || (track.local ? "本地材料" : "短篇精听"))}</small></button>`;
  }).join("");
  if (!currentTrack && listeningTracks[0]) selectTrack(listeningTracks[0].id);
}

async function selectTrack(id) {
  const track = listeningTracks.find((item) => item.id === id);
  if (!track) return;
  currentTrack = track;
  loopA = null;
  loopB = null;
  if (objectAudioUrl) URL.revokeObjectURL(objectAudioUrl);
  objectAudioUrl = null;
  const audio = $("#audioPlayer");
  audio.pause();
  if (track.local) {
    const blob = await getLocalAudio(track.id);
    if (blob) {
      objectAudioUrl = URL.createObjectURL(blob);
      audio.src = objectAudioUrl;
    } else {
      audio.removeAttribute("src");
      toast("找不到本地音频", "备份文件不包含音频，请在这台设备重新导入。" );
    }
  } else {
    audio.src = track.audio;
  }
  $("#trackSource").textContent = track.source || (track.local ? "本地材料" : "VOA Learning English");
  $("#trackSourceLink").hidden = !track.sourceUrl;
  $("#trackSourceLink").href = track.sourceUrl || "#";
  $("#trackTitle").textContent = track.title;
  $("#trackByline").textContent = track.byline || (track.local ? "只保存在当前设备" : "");
  $("#transcript").textContent = track.transcript || "这篇材料还没有原文。可以重新导入并粘贴原文。";
  $("#transcript").hidden = true;
  $("#transcriptToggle").textContent = "显示原文";
  $("#transcriptToggle").setAttribute("aria-expanded", "false");
  $("#loopStatus").textContent = "A–B 循环未设置";
  renderTrackList();
}

function updateAudioTime() {
  const audio = $("#audioPlayer");
  $("#audioCurrent").textContent = formatClock(audio.currentTime);
  $("#audioDuration").textContent = Number.isFinite(audio.duration) ? formatClock(audio.duration) : "0:00";
  $("#audioSeek").value = Number.isFinite(audio.duration) && audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  if (loopA !== null && loopB !== null && audio.currentTime >= loopB) audio.currentTime = loopA;
}

function toggleAudio() {
  const audio = $("#audioPlayer");
  if (!audio.src) return toast("请先选择或导入一篇材料");
  if (audio.paused) audio.play().catch(() => toast("音频暂时无法播放", "请检查网络或重新选择本地文件。"));
  else audio.pause();
}

function updateAudioButton() {
  $("#audioToggle").textContent = $("#audioPlayer").paused ? "▶" : "Ⅱ";
}

function setLoopPoint(which) {
  const audio = $("#audioPlayer");
  if (which === "A") {
    loopA = audio.currentTime;
    if (loopB !== null && loopB <= loopA) loopB = null;
  } else {
    if (loopA === null) return toast("请先设置 A 点");
    loopB = audio.currentTime;
    if (loopB <= loopA) return toast("B 点需要在 A 点之后");
  }
  $("#loopStatus").textContent = loopA === null ? "A–B 循环未设置" : `A ${formatClock(loopA)}${loopB === null ? " · 等待 B 点" : ` — B ${formatClock(loopB)}`}`;
}

function completeListening() {
  if (!currentTrack) return;
  const today = localDateKey();
  if (!state.completedListening.some((entry) => entry.trackId === currentTrack.id && entry.date === today)) {
    state.completedListening.push({ trackId: currentTrack.id, date: today, completedAt: new Date().toISOString() });
    saveState();
    toast("精听已记录", "今天的听力环节完成了。" );
  } else toast("今天已经记录过这篇材料");
  renderTrackList();
  renderToday();
}

function openAudioDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("tracks")) db.createObjectStore("tracks", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveLocalTrack(track, file) {
  const db = await openAudioDB();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction("tracks", "readwrite");
    transaction.objectStore("tracks").put({ ...track, audioBlob: file });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function getAllLocalTracks() {
  if (!("indexedDB" in window)) return [];
  try {
    const db = await openAudioDB();
    const records = await new Promise((resolve, reject) => {
      const request = db.transaction("tracks", "readonly").objectStore("tracks").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return records.map(({ audioBlob, ...metadata }) => ({ ...metadata, local: true }));
  } catch {
    return [];
  }
}

async function getLocalAudio(id) {
  const db = await openAudioDB();
  const record = await new Promise((resolve, reject) => {
    const request = db.transaction("tracks", "readonly").objectStore("tracks").get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return record?.audioBlob || null;
}

async function importAudio(event) {
  event.preventDefault();
  const file = $("#importAudioFile").files[0];
  const title = $("#importTrackTitle").value.trim();
  if (!file || !title) return;
  const track = {
    id: `local-${Date.now()}`,
    title,
    transcript: $("#importTranscript").value.trim(),
    source: "本地材料",
    byline: "只保存在当前设备",
    duration: "本地音频",
    local: true,
    addedAt: new Date().toISOString()
  };
  try {
    await saveLocalTrack(track, file);
    listeningTracks.push(track);
    $("#audioImportDialog").close();
    event.target.reset();
    renderTrackList();
    await selectTrack(track.id);
    toast("听力材料已保存", "音频没有上传，只存放在当前浏览器。" );
  } catch {
    toast("保存失败", "浏览器存储空间不足，或当前模式不允许保存文件。" );
  }
}

function ensureAIState() {
  if (!state.ai || typeof state.ai !== "object") state.ai = defaultAIState();
  if (!AI_SCENARIOS[state.ai.scenario]) state.ai.scenario = "campus";
  if (!['text', 'voice'].includes(state.ai.mode)) state.ai.mode = "text";
  if (!state.ai.sessions || typeof state.ai.sessions !== "object" || Array.isArray(state.ai.sessions)) state.ai.sessions = {};
}

function currentAISession() {
  ensureAIState();
  const scenario = state.ai.scenario;
  if (!Array.isArray(state.ai.sessions[scenario]) || state.ai.sessions[scenario].length === 0) {
    state.ai.sessions[scenario] = [{
      role: "assistant",
      content: AI_SCENARIOS[scenario].opening,
      feedback: [],
      vocabulary: [],
      createdAt: new Date().toISOString()
    }];
    saveState();
  }
  return state.ai.sessions[scenario];
}

function renderAIFeedback(feedback = []) {
  const items = Array.isArray(feedback) ? feedback.slice(0, 2) : [];
  if (!items.length) return "";
  return `<div class="ai-feedback">${items.map((item) => `
    <div class="ai-feedback-card">
      ${item.original ? `<del>${escapeHtml(item.original)}</del>` : ""}
      <strong>${escapeHtml(item.correction || "")}</strong>
      <p>${escapeHtml(item.reason || "")}</p>
    </div>`).join("")}</div>`;
}

function renderAIVocabulary(vocabulary = []) {
  const items = Array.isArray(vocabulary) ? vocabulary.slice(0, 2) : [];
  if (!items.length) return "";
  return `<div class="ai-vocabulary">${items.map((item) => `
    <div class="ai-vocab-card">
      <strong>${escapeHtml(item.word || "")}</strong><span>${escapeHtml(item.meaning || "")}</span>
      ${item.example ? `<p>${escapeHtml(item.example)}</p>` : ""}
    </div>`).join("")}</div>`;
}

function renderAI() {
  const messages = currentAISession();
  const scenario = AI_SCENARIOS[state.ai.scenario];
  $("#aiScenarioTitle").textContent = scenario.title;
  $("#aiScenarioGoal").textContent = scenario.goal;
  $("#aiTurnCount").textContent = `${messages.filter((message) => message.role === "user").length} 轮`;
  $$('[data-ai-scenario]').forEach((button) => button.classList.toggle("active", button.dataset.aiScenario === state.ai.scenario));
  $$('[data-ai-mode]').forEach((button) => {
    const active = button.dataset.aiMode === state.ai.mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $("#aiTextPanel").hidden = state.ai.mode !== "text";
  $("#aiVoicePanel").hidden = state.ai.mode !== "voice";

  const status = $("#aiStatus");
  status.classList.toggle("ready", aiServiceStatus === "ready");
  status.classList.toggle("offline", aiServiceStatus === "offline");
  const providerName = aiServiceInfo?.provider === "zhipu"
    ? aiServiceInfo?.transport === "direct" ? "智谱直连" : "智谱"
    : aiServiceInfo?.provider === "ollama" ? "本地" : "AI";
  const modelName = String(aiServiceInfo?.model || "").replace(/^glm-/i, "GLM-");
  status.textContent = aiServiceStatus === "ready"
    ? `${providerName} ${modelName} 已就绪`.replace(/\s+/g, " ")
    : aiServiceStatus === "offline" ? "需要启动 AI 服务" : "正在检查 AI 服务";

  $("#aiMessages").innerHTML = messages.map((message, index) => `
    <div class="ai-message ${message.role === "user" ? "user" : "assistant"} ${index === messages.length - 1 ? "latest" : ""}">
      <div class="ai-message-label-row">
        <div class="ai-message-label">${message.role === "user" ? "YOU" : "AI TUTOR"}</div>
        ${message.role === "assistant" ? `<button class="ai-message-speak" type="button" data-ai-speak-index="${index}" aria-label="朗读这条 AI 回复" aria-pressed="${aiTextSpeech.messageIndex === index ? "true" : "false"}">${aiTextSpeech.messageIndex === index ? "■ 停止" : "▶ 朗读"}</button>` : ""}
      </div>
      <div class="ai-bubble">${escapeHtml(message.content || "")}</div>
      ${message.role === "assistant" ? renderAIFeedback(message.feedback) + renderAIVocabulary(message.vocabulary) : ""}
    </div>`).join("") + (aiPending ? `
    <div class="ai-message assistant latest" aria-label="AI 正在回复">
      <div class="ai-message-label-row"><div class="ai-message-label">AI TUTOR</div></div>
      <div class="ai-bubble ai-typing"><i></i><i></i><i></i></div>
    </div>` : "");
  $("#aiSend").disabled = aiPending;
  $("#aiInput").disabled = aiPending;
  renderTextDictation();
  renderVoiceUI();
  requestAnimationFrame(() => { $("#aiMessages").scrollTop = $("#aiMessages").scrollHeight; });
}

function selectAIScenario(scenario) {
  if (!AI_SCENARIOS[scenario] || aiPending) return;
  if (isVoiceActive()) return toast("请先结束语音对话", "结束后再切换练习情景。" );
  stopAITextSpeech();
  if (textDictation.listening) stopTextDictation(true);
  state.ai.scenario = scenario;
  currentAISession();
  saveState();
  $("#aiError").hidden = true;
  renderAI();
}

function resetAIConversation() {
  if (isVoiceActive()) return toast("请先结束语音对话");
  if (textDictation.listening) stopTextDictation(true);
  stopAITextSpeech();
  const messages = currentAISession();
  if (messages.length > 1 && !window.confirm("重新开始会清空这个情景的对话记录，确认继续吗？")) return;
  state.ai.sessions[state.ai.scenario] = [];
  currentAISession();
  saveState();
  $("#aiError").hidden = true;
  renderAI();
  $("#aiInput").focus();
}

function isVoiceActive() {
  return voiceSession.active;
}

function renderVoiceUI() {
  const stage = $("#aiVoiceStage");
  if (!stage) return;
  const labels = {
    idle: [voiceSession.statusMessage, voiceSession.hintMessage],
    connecting: ["正在启动语音练习…", "首次使用时，请允许浏览器访问麦克风。"],
    listening: ["正在听你说…", "说完一句后停顿一下，AI 会开始回答。"],
    thinking: ["AI 正在思考…", "在线回答可能需要等待十几秒。"],
    speaking: ["AI 正在朗读回答…", "朗读结束后会自动继续听你说。"],
    error: [voiceSession.statusMessage, voiceSession.hintMessage]
  };
  const [status, hint] = labels[voiceSession.state] || labels.idle;
  stage.dataset.state = voiceSession.state;
  $("#aiVoiceStatus").textContent = status;
  $("#aiVoiceHint").textContent = hint;
  $("#aiVoiceTranscript p").textContent = voiceSession.transcript || "开始后，这里会显示识别到的话和 AI 的英文回复。";
  const toggle = $("#aiVoiceToggle");
  const active = isVoiceActive();
  toggle.textContent = active ? "结束语音练习" : "开始语音练习";
  toggle.classList.toggle("live", active);
  toggle.disabled = voiceSession.state === "connecting";
}

function closeVoiceResources() {
  clearTimeout(voiceSession.restartTimer);
  voiceSession.restartTimer = null;
  const recognition = voiceSession.recognition;
  voiceSession.recognition = null;
  try { recognition?.abort(); } catch {}
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  voiceSession.utterance = null;
}

function settleVoiceSession(message = "本次语音练习已结束") {
  closeVoiceResources();
  voiceSession.active = false;
  voiceSession.state = "idle";
  voiceSession.statusMessage = message;
  voiceSession.hintMessage = "点击开始，可以继续当前情景。";
  renderVoiceUI();
}

function failVoiceSession(message, hint = "请检查麦克风权限与 AI 配置后重试。") {
  closeVoiceResources();
  voiceSession.active = false;
  voiceSession.state = "error";
  voiceSession.statusMessage = message;
  voiceSession.hintMessage = hint;
  renderVoiceUI();
}

function setAIMode(mode) {
  if (!["text", "voice"].includes(mode) || state.ai.mode === mode) return;
  if (mode === "text" && isVoiceActive()) stopVoiceImmediately();
  if (mode === "voice") {
    if (textDictation.listening) stopTextDictation(true);
    stopAITextSpeech();
  }
  state.ai.mode = mode;
  saveState();
  renderAI();
}

function speechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function renderTextDictation() {
  const button = $("#aiDictation");
  if (!button) return;
  button.disabled = aiPending || state.ai.mode !== "text";
  button.classList.toggle("listening", textDictation.listening);
  button.setAttribute("aria-pressed", String(textDictation.listening));
  button.textContent = textDictation.listening ? "停止听写" : "语音输入";
}

function joinDictationText(baseText, spokenText) {
  const base = baseText.trim();
  const spoken = spokenText.trim();
  if (!base) return spoken.slice(0, 1000);
  if (!spoken) return base.slice(0, 1000);
  const separator = /[\s\n]$/.test(base) || /^[,.;!?，。！？]/.test(spoken) ? "" : " ";
  return `${base}${separator}${spoken}`.slice(0, 1000);
}

function stopTextDictation(abort = false) {
  const recognition = textDictation.recognition;
  textDictation.recognition = null;
  textDictation.listening = false;
  renderTextDictation();
  if (!recognition) return;
  try {
    if (abort) recognition.abort();
    else recognition.stop();
  } catch {
    // The browser may have already ended the recognition session.
  }
}

function startTextDictation() {
  if (aiPending) return;
  const Recognition = speechRecognitionConstructor();
  if (!Recognition) return toast("当前浏览器不支持语音输入", "请使用最新版 Chrome 或 Edge，也可以继续键盘输入。" );

  const input = $("#aiInput");
  const recognition = new Recognition();
  textDictation.recognition = recognition;
  textDictation.listening = true;
  textDictation.baseText = input.value.trim();
  textDictation.finalText = "";
  recognition.lang = state.settings.accent || "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;
  renderTextDictation();

  recognition.addEventListener("result", (event) => {
    if (textDictation.recognition !== recognition) return;
    let interimText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0]?.transcript || "";
      if (event.results[index].isFinal) textDictation.finalText += transcript;
      else interimText += transcript;
    }
    input.value = joinDictationText(textDictation.baseText, `${textDictation.finalText} ${interimText}`);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });
  recognition.addEventListener("error", (event) => {
    if (textDictation.recognition !== recognition || event.error === "aborted") return;
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      toast("没有获得麦克风权限", "请在浏览器地址栏旁允许麦克风，然后重新点击语音输入。" );
    } else if (event.error === "no-speech") {
      toast("没有听清", "请靠近麦克风后再试一次。" );
    } else if (event.error === "network") {
      toast("语音识别联网失败", "请检查网络，或用最新版 Chrome / Edge 打开本应用后重试。" );
    } else {
      toast("语音输入暂时不可用", `浏览器返回：${event.error || "unknown"}`);
    }
  });
  recognition.addEventListener("end", () => {
    if (textDictation.recognition !== recognition) return;
    textDictation.recognition = null;
    textDictation.listening = false;
    renderTextDictation();
    input.focus();
  });

  try {
    recognition.start();
  } catch (error) {
    textDictation.recognition = null;
    textDictation.listening = false;
    renderTextDictation();
    toast("无法启动语音输入", error.message || "请重新点击语音输入。" );
  }
}

function toggleTextDictation() {
  if (textDictation.listening) stopTextDictation();
  else startTextDictation();
}

function renderAITextSpeechButtons() {
  $$("[data-ai-speak-index]").forEach((button) => {
    const speaking = Number(button.dataset.aiSpeakIndex) === aiTextSpeech.messageIndex;
    button.classList.toggle("speaking", speaking);
    button.setAttribute("aria-pressed", String(speaking));
    button.setAttribute("aria-label", speaking ? "停止朗读这条 AI 回复" : "朗读这条 AI 回复");
    button.textContent = speaking ? "■ 停止" : "▶ 朗读";
  });
}

function stopAITextSpeech(shouldRender = true) {
  if ("speechSynthesis" in window && aiTextSpeech.utterance) speechSynthesis.cancel();
  aiTextSpeech = { utterance: null, messageIndex: null };
  if (shouldRender) renderAITextSpeechButtons();
}

function toggleAITextSpeech(messageIndex) {
  const messages = currentAISession();
  const message = messages[messageIndex];
  if (!message || message.role !== "assistant" || !message.content) return;
  if (!("speechSynthesis" in window)) return toast("当前浏览器不支持朗读", "请使用最新版 Chrome 或 Edge。" );
  if (aiTextSpeech.messageIndex === messageIndex) {
    stopAITextSpeech();
    return;
  }
  if (textDictation.listening) stopTextDictation(true);
  stopPronunciationAudio();
  stopAITextSpeech(false);
  const utterance = new SpeechSynthesisUtterance(message.content);
  utterance.lang = state.settings.accent || "en-US";
  utterance.rate = 0.88;
  const selected = speechSynthesis.getVoices().find((voice) => voice.voiceURI === state.settings.voiceURI);
  if (selected) utterance.voice = selected;
  aiTextSpeech = { utterance, messageIndex };
  const finish = () => {
    if (aiTextSpeech.utterance !== utterance) return;
    aiTextSpeech = { utterance: null, messageIndex: null };
    renderAITextSpeechButtons();
  };
  utterance.addEventListener("end", finish, { once: true });
  utterance.addEventListener("error", finish, { once: true });
  renderAITextSpeechButtons();
  speechSynthesis.speak(utterance);
}

function scheduleVoiceListening(delay = 450) {
  clearTimeout(voiceSession.restartTimer);
  if (!voiceSession.active) return;
  voiceSession.restartTimer = window.setTimeout(beginVoiceListening, delay);
}

function beginVoiceListening() {
  if (!voiceSession.active || voiceSession.recognition) return;
  const Recognition = speechRecognitionConstructor();
  if (!Recognition) return failVoiceSession("当前浏览器不支持语音识别", "请使用最新版 Chrome 或 Edge，也可以继续使用文字对话。" );

  const recognition = new Recognition();
  voiceSession.recognition = recognition;
  recognition.lang = state.settings.accent || "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;
  let finalText = "";

  recognition.addEventListener("start", () => {
    if (!voiceSession.active) return;
    voiceSession.state = "listening";
    renderVoiceUI();
  });
  recognition.addEventListener("result", (event) => {
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const text = event.results[index][0]?.transcript || "";
      if (event.results[index].isFinal) finalText += text;
      else interim += text;
    }
    voiceSession.transcript = `你：${(finalText || interim).trim()}`;
    renderVoiceUI();
  });
  recognition.addEventListener("error", (event) => {
    if (["aborted", "no-speech"].includes(event.error)) return;
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      failVoiceSession("没有获得麦克风权限", "请在浏览器地址栏旁允许麦克风，然后重新开始。" );
    } else {
      failVoiceSession("语音识别暂时不可用", `浏览器返回：${event.error || "unknown"}`);
    }
  });
  recognition.addEventListener("end", () => {
    if (voiceSession.recognition !== recognition) return;
    voiceSession.recognition = null;
    const content = finalText.trim();
    if (content && voiceSession.active) submitVoiceTurn(content);
    else if (voiceSession.active && voiceSession.state === "listening") scheduleVoiceListening();
  });

  try {
    recognition.start();
  } catch (error) {
    voiceSession.recognition = null;
    failVoiceSession("无法启动语音识别", error.message || "请重新开始语音练习。" );
  }
}

function speakVoiceReply(text) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window) || !text || !voiceSession.active) return resolve();
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    voiceSession.utterance = utterance;
    utterance.lang = state.settings.accent || "en-US";
    utterance.rate = 0.88;
    const selected = speechSynthesis.getVoices().find((voice) => voice.voiceURI === state.settings.voiceURI);
    if (selected) utterance.voice = selected;
    utterance.addEventListener("start", () => {
      if (!voiceSession.active) return;
      voiceSession.state = "speaking";
      renderVoiceUI();
    });
    const finish = () => {
      if (voiceSession.utterance === utterance) voiceSession.utterance = null;
      resolve();
    };
    utterance.addEventListener("end", finish, { once: true });
    utterance.addEventListener("error", finish, { once: true });
    speechSynthesis.speak(utterance);
  });
}

function buildTutorInstructions(scenario) {
  const current = AI_SCENARIOS[scenario] || AI_SCENARIOS.campus;
  return `You are the private English tutor inside 蘑菇酱四级 for one Chinese learner preparing for CET-4 and aiming for 500+. The learner is around B1 and wants practical conversation plus gentle correction. The current scenario is ${current.title}: ${current.goal}

Keep the conversation natural and encouraging, but do not give empty praise. Reply mainly in simple, natural English suitable for CET-4. If the learner writes Chinese, help them express that idea in English and continue the conversation. Correct only the one or two mistakes that matter most. Use two to four short sentences, keep the reply under 70 English words, and end directly with exactly one useful follow-up question. Do not introduce the question with labels such as "Ask:" or "Question:".

Return only a valid JSON object with this shape: {"reply":"English reply","feedback":[{"original":"learner wording","correction":"natural correction","reason":"brief Chinese explanation"}],"vocabulary":[{"word":"useful word or phrase","meaning":"brief Chinese meaning","example":"short English example"}]}. Use empty arrays when there is nothing useful to add. Include at most two feedback items and two vocabulary items.`;
}

function parseDirectTutorReply(text) {
  const cleaned = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(cleaned);
    return {
      reply: typeof parsed.reply === "string" ? parsed.reply.trim() : "",
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback.slice(0, 2) : [],
      vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary.slice(0, 2) : []
    };
  } catch {
    return { reply: cleaned, feedback: [], vocabulary: [] };
  }
}

async function requestDirectZhipu({ scenario, history, message }) {
  if (!deviceAIConfig.apiKey) throw new Error("请先在设置中保存智谱 API Key。");
  const safeHistory = Array.isArray(history) ? history.slice(-12).flatMap((item) => {
    const role = item?.role === "assistant" ? "assistant" : item?.role === "user" ? "user" : null;
    const content = typeof item?.content === "string" ? item.content.trim().slice(0, 1200) : "";
    return role && content ? [{ role, content }] : [];
  }) : [];
  const response = await fetch(ZHIPU_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${deviceAIConfig.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: deviceAIConfig.model,
      messages: [{ role: "system", content: buildTutorInstructions(scenario) }, ...safeHistory, { role: "user", content: message }],
      stream: false,
      thinking: { type: "enabled", clear_thinking: false },
      response_format: { type: "json_object" },
      temperature: 1,
      top_p: 0.95,
      max_tokens: 2048
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if ([401, 403].includes(response.status)) throw new Error("智谱 API Key 无效或无权使用该模型，请重新填写。");
    if (response.status === 429) throw new Error("智谱请求过多或额度不足，请稍后再试。");
    throw new Error(data?.error?.message || `智谱暂时无法连接（${response.status}）。`);
  }
  const raw = data?.choices?.[0]?.message?.content;
  const content = Array.isArray(raw)
    ? raw.map((item) => typeof item === "string" ? item : String(item?.text || item?.content || "")).join("")
    : raw;
  const result = parseDirectTutorReply(content);
  if (!result.reply) throw new Error("智谱没有生成有效回复，请再试一次。");
  return { ...result, provider: "zhipu", model: String(data?.model || deviceAIConfig.model), transport: "direct" };
}

async function requestAIReply(payload) {
  let backendError = null;
  if (aiBackendAvailable) {
    try {
      const response = await fetch("./api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "AI 暂时无法回复，请稍后重试。");
      return result;
    } catch (error) {
      backendError = error;
    }
  }
  if (deviceAIConfig.apiKey) return requestDirectZhipu(payload);
  throw backendError || new Error("请先在设置中配置手机 AI，或在电脑上启动本机服务。");
}

async function submitVoiceTurn(content) {
  if (!voiceSession.active || aiPending) return;
  const messages = currentAISession();
  const history = messages.slice(-12).map(({ role, content: text }) => ({ role, content: text }));
  messages.push({ role: "user", content, createdAt: new Date().toISOString() });
  if (messages.length > 40) messages.splice(1, messages.length - 40);
  saveState();
  aiPending = true;
  voiceSession.state = "thinking";
  voiceSession.transcript = `你：${content}\nAI：正在生成回答…`;
  renderAI();

  try {
    const result = await requestAIReply({ scenario: state.ai.scenario, history, message: content });
    if (result.provider) aiServiceInfo = { provider: result.provider, model: result.model || "", transport: result.transport || "backend" };
    const reply = String(result.reply || "Could you tell me a little more?");
    messages.push({
      role: "assistant",
      content: reply,
      feedback: Array.isArray(result.feedback) ? result.feedback.slice(0, 2) : [],
      vocabulary: Array.isArray(result.vocabulary) ? result.vocabulary.slice(0, 2) : [],
      createdAt: new Date().toISOString()
    });
    voiceSession.transcript = `你：${content}\nAI：${reply}`;
    aiServiceStatus = "ready";
    saveState();
    renderAI();
    await speakVoiceReply(reply);
    if (voiceSession.active) scheduleVoiceListening(300);
  } catch (error) {
    failVoiceSession("AI 没有成功回答", error.message || "请检查 AI 配置后重试。" );
  } finally {
    aiPending = false;
    renderAI();
  }
}

function startVoiceConversation() {
  if (aiServiceStatus !== "ready") {
    return failVoiceSession("AI 尚未就绪", "请先在设置中配置手机 AI，或在电脑上启动本机服务。" );
  }
  if (!speechRecognitionConstructor()) {
    return failVoiceSession("当前浏览器不支持语音识别", "请使用最新版 Chrome 或 Edge，也可以继续使用文字对话。" );
  }
  closeVoiceResources();
  voiceSession.active = true;
  voiceSession.state = "connecting";
  voiceSession.transcript = "";
  renderVoiceUI();
  beginVoiceListening();
}

function finishVoiceConversation() {
  if (!isVoiceActive()) return;
  settleVoiceSession();
}

function stopVoiceImmediately(shouldRender = true) {
  closeVoiceResources();
  voiceSession.active = false;
  voiceSession.state = "idle";
  voiceSession.statusMessage = "本次语音练习已结束";
  voiceSession.hintMessage = "点击开始，可以继续当前情景。";
  if (shouldRender) renderVoiceUI();
}

function toggleVoiceConversation() {
  if (isVoiceActive()) finishVoiceConversation();
  else startVoiceConversation();
}

async function checkAIStatus() {
  aiBackendAvailable = false;
  try {
    const response = await fetch("./api/ai-status", { cache: "no-store" });
    if (!response.ok) throw new Error("status unavailable");
    const result = await response.json();
    aiBackendAvailable = Boolean(result.configured);
    aiServiceInfo = aiBackendAvailable
      ? result
      : deviceAIConfig.apiKey ? { provider: "zhipu", model: deviceAIConfig.model, transport: "direct" } : result;
    aiServiceStatus = aiBackendAvailable || deviceAIConfig.apiKey ? "ready" : "offline";
  } catch {
    aiServiceInfo = deviceAIConfig.apiKey
      ? { provider: "zhipu", model: deviceAIConfig.model, transport: "direct" }
      : null;
    aiServiceStatus = deviceAIConfig.apiKey ? "ready" : "offline";
  }
  renderAI();
}

async function sendAIMessage(event) {
  event.preventDefault();
  if (aiPending) return;
  stopAITextSpeech();
  if (textDictation.listening) stopTextDictation(true);
  const input = $("#aiInput");
  const content = input.value.trim();
  if (!content) return;

  const messages = currentAISession();
  const history = messages.slice(-12).map(({ role, content: text }) => ({ role, content: text }));
  messages.push({ role: "user", content, createdAt: new Date().toISOString() });
  if (messages.length > 40) messages.splice(1, messages.length - 40);
  saveState();
  input.value = "";
  aiPending = true;
  $("#aiError").hidden = true;
  renderAI();

  try {
    const result = await requestAIReply({ scenario: state.ai.scenario, history, message: content });
    if (result.provider) aiServiceInfo = { provider: result.provider, model: result.model || "", transport: result.transport || "backend" };
    messages.push({
      role: "assistant",
      content: String(result.reply || "Let’s try another way. Could you tell me a little more?"),
      feedback: Array.isArray(result.feedback) ? result.feedback.slice(0, 2) : [],
      vocabulary: Array.isArray(result.vocabulary) ? result.vocabulary.slice(0, 2) : [],
      createdAt: new Date().toISOString()
    });
    aiServiceStatus = "ready";
    saveState();
  } catch (error) {
    const errorBox = $("#aiError");
    errorBox.textContent = error.message || "AI 暂时无法回复，请稍后重试。";
    errorBox.hidden = false;
  } finally {
    aiPending = false;
    renderAI();
    input.focus();
  }
}

function learningDates() {
  return Object.entries(state.daily).filter(([, value]) => (value.focusSeconds || 0) > 0 || (value.learned || 0) > 0 || (value.screened || 0) > 0).map(([date]) => date).sort();
}

function calculateStreak() {
  const set = new Set(learningDates());
  let cursor = new Date();
  if (!set.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (set.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function renderProgress() {
  const counts = stateCounts();
  $(".score-target strong").textContent = `${state.settings.scoreGoal}+`;
  $("#masteredMetric").innerHTML = `${counts.mastered}<small>词</small>`;
  $("#masteredSub").textContent = `已筛查 ${counts.screened} / ${words.length || "—"}`;
  $("#streakMetric").innerHTML = `${calculateStreak()}<small>天</small>`;
  $("#listeningMetric").innerHTML = `${state.completedListening.length}<small>篇</small>`;
  $("#vocabTotal").textContent = words.length ? `${words.length} 词` : "—";

  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = localDateKey(date);
    days.push({ key, label: ["日", "一", "二", "三", "四", "五", "六"][date.getDay()], minutes: Math.round((state.daily[key]?.focusSeconds || 0) / 60) });
  }
  const maxMinutes = Math.max(30, ...days.map((day) => day.minutes));
  $("#weekMinutes").textContent = `${days.reduce((total, day) => total + day.minutes, 0)} 分钟`;
  $("#weekChart").innerHTML = days.map((day) => `<div class="bar-column" title="周${day.label} ${day.minutes}分钟"><div class="bar" style="height:${Math.max(2, (day.minutes / maxMinutes) * 100)}%"></div><span>周${day.label}</span></div>`).join("");

  const rows = [
    ["未分类", counts.unclassified],
    ["认识", counts.known],
    ["模糊", counts.fuzzy],
    ["不认识", counts.unknown]
  ];
  $("#vocabBreakdown").innerHTML = rows.map(([label, value]) => `<div class="breakdown-row"><span>${label}</span><div class="breakdown-track"><i style="width:${words.length ? (value / words.length) * 100 : 0}%"></i></div><strong>${value}</strong></div>`).join("");
}

function renderSettings() {
  $("#examDateInput").value = state.settings.examDate;
  $("#scoreGoalInput").value = state.settings.scoreGoal;
  $("#dailyTargetInput").value = state.settings.dailyTarget;
  $("#settingsTargetOutput").textContent = state.settings.dailyTarget;
  $("#accentSelect").value = state.settings.accent;
  $("#themeSelect").value = state.settings.theme;
  $("#recommendedTargetText").textContent = `当前系统建议 ${recommendedDailyTarget()} 个；你可在20–50之间调整。`;
  $("#lastBackup").textContent = state.lastBackupAt ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(state.lastBackupAt)) : "从未备份";
  $("#restoreRecovery").hidden = !localStorage.getItem(`${STORAGE_KEY}-recovery`);
  renderStorageScope();
  renderSyncStatus();
  renderDeviceAISettings();
  renderVoices();
}

function renderDeviceAISettings() {
  const pill = $("#deviceAIStatus");
  if (!pill) return;
  const configured = Boolean(deviceAIConfig.apiKey);
  pill.dataset.state = configured ? "synced" : "unconfigured";
  $("span", pill).textContent = configured ? "此设备已保存" : "尚未配置";
  $("#deviceAIModelSelect").value = deviceAIConfig.model || DEFAULT_ZHIPU_MODEL;
  $("#deviceAIKeyInput").placeholder = configured ? "已保存；如不修改可留空" : "只保存在这台设备的浏览器中";
  $("#clearDeviceAI").disabled = !configured;
}

async function configureDeviceAI() {
  const input = $("#deviceAIKeyInput");
  const apiKey = input.value.trim() || deviceAIConfig.apiKey;
  if (apiKey.length < 20) return toast("请填写有效的 API Key", "从智谱开放平台复制完整密钥后再保存。" );
  deviceAIConfig = {
    apiKey,
    model: $("#deviceAIModelSelect").value || DEFAULT_ZHIPU_MODEL
  };
  saveDeviceAIConfig();
  input.value = "";
  await checkAIStatus();
  renderSettings();
  toast("手机 AI 已配置", "现在可以回到 AI 对话直接使用智谱。" );
}

async function clearDeviceAIConfig() {
  if (!deviceAIConfig.apiKey || !window.confirm("移除只保存在此设备上的智谱 API Key？")) return;
  localStorage.removeItem(DEVICE_AI_CONFIG_KEY);
  deviceAIConfig = loadDeviceAIConfig();
  $("#deviceAIKeyInput").value = "";
  await checkAIStatus();
  renderSettings();
  toast("已移除手机 AI 密钥");
}

function renderSyncStatus() {
  const pill = $("#syncStatus");
  if (!pill) return;
  const labels = {
    unconfigured: "尚未配置",
    connecting: "正在连接",
    syncing: "正在同步",
    synced: "已同步",
    offline: "离线待同步",
    error: "需要处理"
  };
  pill.dataset.state = cloudSync.status;
  $("span", pill).textContent = labels[cloudSync.status] || labels.unconfigured;
  $("#syncDetail").textContent = cloudSync.detail;
  $("#syncLastTime").textContent = cloudSync.lastSyncedAt
    ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(cloudSync.lastSyncedAt))
    : "尚未同步";
  if (document.activeElement !== $("#syncEndpointInput")) $("#syncEndpointInput").value = syncConfig.endpoint;
  $("#syncTokenInput").placeholder = syncConfig.token ? "已保存；如不修改可留空" : "首次连接时输入；只保存在本设备";
  $("#syncNow").disabled = cloudSync.busy || !syncConfig.endpoint || !syncConfig.token;
  $("#connectSync").disabled = cloudSync.busy;
  $("#disconnectSync").disabled = cloudSync.busy || !syncConfig.token;
}

async function connectCloudSync() {
  try {
    const endpoint = normalizeSyncEndpoint($("#syncEndpointInput").value || syncConfig.endpoint);
    const token = $("#syncTokenInput").value || syncConfig.token;
    if (!token || token.length < 8) throw new Error("同步密码至少需要 8 个字符");
    syncConfig = { endpoint, token, lastSyncedAt: syncConfig.lastSyncedAt || null };
    saveSyncConfig();
    $("#syncTokenInput").value = "";
    cloudSync.ready = true;
    cloudSync.revision = 0;
    await syncNow({ notify: true });
  } catch (error) {
    setSyncStatus("error", error.message || "同步配置不正确");
    toast("无法连接同步", cloudSync.detail);
  }
}

function disconnectCloudSync() {
  if (!window.confirm("断开后不会删除本机或云端记录，但此设备将停止自动同步。确认断开吗？")) return;
  clearTimeout(cloudSync.timer);
  syncConfig = { endpoint: syncConfig.endpoint, token: "", lastSyncedAt: syncConfig.lastSyncedAt };
  saveSyncConfig();
  cloudSync.revision = 0;
  setSyncStatus("unconfigured", "此设备已断开；本机记录保持不变");
  renderStorageScope();
  toast("已停止自动同步", "重新输入同步密码即可继续，不会丢失记录。" );
}

function exportData() {
  state.lastBackupAt = new Date().toISOString();
  saveState();
  const payload = {
    app: "蘑菇酱四级",
    exportedAt: state.lastBackupAt,
    note: "本地导入的音频文件不包含在此 JSON 备份中。",
    state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mogu-cet4-backup-${localDateKey()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  renderSettings();
  toast("备份已导出", "文件包含学习记录和设置，不包含你导入的音频。" );
}

async function importDataFile(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const nextState = parsed.state || parsed;
    if (!nextState.settings || !nextState.wordStates) throw new Error("invalid backup");
    if (!window.confirm("导入会替换当前学习记录。系统会先保留一份可恢复副本，确认继续吗？")) return;
    localStorage.setItem(`${STORAGE_KEY}-recovery`, JSON.stringify(state));
    state = { ...defaultState(), ...nextState, settings: { ...defaultState().settings, ...nextState.settings } };
    saveState();
    applyTheme();
    applyRecommendedTarget();
    renderAll();
    toast("备份已导入", "导入前的数据已保留为浏览器内恢复副本。" );
  } catch {
    toast("无法导入", "请选择由“蘑菇酱四级”导出的 JSON 备份文件。" );
  }
}

function restoreRecovery() {
  try {
    const recovery = JSON.parse(localStorage.getItem(`${STORAGE_KEY}-recovery`));
    if (!recovery?.settings || !recovery?.wordStates) throw new Error("missing recovery");
    const current = JSON.stringify(state);
    state = { ...defaultState(), ...recovery, settings: { ...defaultState().settings, ...recovery.settings } };
    localStorage.setItem(`${STORAGE_KEY}-recovery`, current);
    saveState();
    applyTheme();
    renderAll();
    toast("已恢复导入前的数据", "刚才的数据也保留为恢复副本，可以再次切换。" );
  } catch {
    toast("没有可恢复的数据");
  }
}

function checkBackupReminder() {
  if (syncConfig.endpoint && syncConfig.token) return;
  if (!state.lastBackupAt) return toast("记得备份学习进度", "设置页可以导出 JSON；清理浏览器数据会删除本机记录。" );
  const elapsed = Date.now() - new Date(state.lastBackupAt).getTime();
  if (elapsed > 7 * 86400000) toast("距离上次备份已超过7天", "完成今天学习后，记得在设置页导出一份备份。" );
}

function bindEvents() {
  $$("[data-view-target]").forEach((button) => button.addEventListener("click", () => {
    if (currentView === "ai" && button.dataset.viewTarget !== "ai") {
      if (isVoiceActive()) stopVoiceImmediately();
      if (textDictation.listening) stopTextDictation(true);
      stopAITextSpeech();
    }
    if (currentView === "today" && button.dataset.viewTarget !== "today") stopPronunciationAudio();
    currentView = button.dataset.viewTarget;
    renderNavigation();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
  $("#startMission").addEventListener("click", startMissionFromState);
  $("#switchStudyMode").addEventListener("click", () => openStudy("learn"));
  $$("[data-study-mode]").forEach((button) => button.addEventListener("click", () => openStudy(button.dataset.studyMode)));
  $("#revealWord").addEventListener("click", revealCurrentWord);
  $("#speakWord").addEventListener("click", () => { void speak(currentWord?.word, { notifyFallback: true }); });
  const nativePronunciation = $("#wordPronunciationPlayer");
  nativePronunciation.addEventListener("play", () => {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    if (pronunciationAudio && pronunciationAudio !== nativePronunciation) pronunciationAudio.pause();
    if (pronunciationAudioSource) {
      try { pronunciationAudioSource.stop(); } catch {}
      try { pronunciationAudioSource.disconnect(); } catch {}
      pronunciationAudioSource = null;
    }
    pronunciationAudio = nativePronunciation;
  });
  nativePronunciation.addEventListener("pause", () => {
    if (pronunciationAudio === nativePronunciation) pronunciationAudio = null;
  });
  nativePronunciation.addEventListener("ended", () => {
    if (pronunciationAudio === nativePronunciation) pronunciationAudio = null;
  });
  nativePronunciation.addEventListener("error", () => {
    const word = nativePronunciation.dataset.word;
    if (!word || currentWord?.word !== word) return;
    resetNativePronunciationPlayer();
    renderPronunciationSource({ fallback: true });
    setPronunciationButton("fallback", word);
  });
  $$("[data-rating]").forEach((button) => button.addEventListener("click", () => rateCurrentWord(button.dataset.rating)));
  $("#quizOptions").addEventListener("click", (event) => {
    const button = event.target.closest("[data-answer]");
    if (button) answerQuiz(button.dataset.answer, button);
  });
  $("#targetMinus").addEventListener("click", () => setDailyTarget(state.settings.dailyTarget - 1));
  $("#targetPlus").addEventListener("click", () => setDailyTarget(state.settings.dailyTarget + 1));
  $("#timerToggle").addEventListener("click", toggleTimer);
  $("#timerNext").addEventListener("click", switchTimerPhase);
  $("#timerReset").addEventListener("click", resetTimer);

  $("#trackList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-track-id]");
    if (button) selectTrack(button.dataset.trackId);
  });
  $("#audioToggle").addEventListener("click", toggleAudio);
  $("#audioBack").addEventListener("click", () => { $("#audioPlayer").currentTime = Math.max(0, $("#audioPlayer").currentTime - 5); });
  $("#audioForward").addEventListener("click", () => { $("#audioPlayer").currentTime = Math.min($("#audioPlayer").duration || Infinity, $("#audioPlayer").currentTime + 5); });
  $("#audioPlayer").addEventListener("timeupdate", updateAudioTime);
  $("#audioPlayer").addEventListener("loadedmetadata", updateAudioTime);
  $("#audioPlayer").addEventListener("play", updateAudioButton);
  $("#audioPlayer").addEventListener("pause", updateAudioButton);
  $("#audioSeek").addEventListener("input", (event) => {
    const audio = $("#audioPlayer");
    if (Number.isFinite(audio.duration)) audio.currentTime = (Number(event.target.value) / 100) * audio.duration;
  });
  $$("[data-speed]").forEach((button) => button.addEventListener("click", () => {
    $("#audioPlayer").playbackRate = Number(button.dataset.speed);
    $$("[data-speed]").forEach((item) => item.classList.toggle("active", item === button));
  }));
  $("#loopA").addEventListener("click", () => setLoopPoint("A"));
  $("#loopB").addEventListener("click", () => setLoopPoint("B"));
  $("#clearLoop").addEventListener("click", () => { loopA = null; loopB = null; $("#loopStatus").textContent = "A–B 循环未设置"; });
  $("#transcriptToggle").addEventListener("click", () => {
    const transcript = $("#transcript");
    transcript.hidden = !transcript.hidden;
    $("#transcriptToggle").textContent = transcript.hidden ? "显示原文" : "隐藏原文";
    $("#transcriptToggle").setAttribute("aria-expanded", transcript.hidden ? "false" : "true");
  });
  $("#completeListening").addEventListener("click", completeListening);
  $("#openImportAudio").addEventListener("click", () => $("#audioImportDialog").showModal());
  $("#audioImportForm").addEventListener("submit", importAudio);

  $$('[data-ai-scenario]').forEach((button) => button.addEventListener("click", () => selectAIScenario(button.dataset.aiScenario)));
  $$('[data-ai-mode]').forEach((button) => button.addEventListener("click", () => setAIMode(button.dataset.aiMode)));
  $("#aiReset").addEventListener("click", resetAIConversation);
  $("#aiMessages").addEventListener("click", (event) => {
    const button = event.target.closest("[data-ai-speak-index]");
    if (button) toggleAITextSpeech(Number(button.dataset.aiSpeakIndex));
  });
  $("#aiDictation").addEventListener("click", toggleTextDictation);
  $("#aiVoiceToggle").addEventListener("click", toggleVoiceConversation);
  $("#aiForm").addEventListener("submit", sendAIMessage);
  $("#aiInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      $("#aiForm").requestSubmit();
    }
  });

  $("#dailyTargetInput").addEventListener("input", (event) => {
    $("#settingsTargetOutput").textContent = event.target.value;
  });
  $("#dailyTargetInput").addEventListener("change", (event) => setDailyTarget(event.target.value));
  $("#examDateInput").addEventListener("change", (event) => { state.settings.examDate = event.target.value || EXAM_DEFAULT; state.settings.targetIsManual = false; applyRecommendedTarget(); saveState(); renderAll(); });
  $("#scoreGoalInput").addEventListener("change", (event) => { state.settings.scoreGoal = Math.max(425, Math.min(710, Number(event.target.value) || 500)); saveState(); renderProgress(); });
  $("#accentSelect").addEventListener("change", (event) => {
    state.settings.accent = event.target.value;
    stopPronunciationAudio();
    resetNativePronunciationPlayer();
    renderPronunciationSource(null);
    if (currentWord) void prepareCurrentPronunciation(currentWord.word);
    saveState();
  });
  $("#voiceSelect").addEventListener("change", (event) => { state.settings.voiceURI = event.target.value; saveState(); });
  $("#themeSelect").addEventListener("change", (event) => { state.settings.theme = event.target.value; saveState(); applyTheme(); });
  $("#themeQuick").addEventListener("click", () => { state.settings.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; saveState(); applyTheme(); renderSettings(); });
  $("#saveDeviceAI").addEventListener("click", () => { void configureDeviceAI(); });
  $("#clearDeviceAI").addEventListener("click", () => { void clearDeviceAIConfig(); });
  $("#connectSync").addEventListener("click", () => { void connectCloudSync(); });
  $("#syncNow").addEventListener("click", () => { void syncNow({ notify: true }); });
  $("#disconnectSync").addEventListener("click", disconnectCloudSync);
  $("#exportData").addEventListener("click", exportData);
  $("#importData").addEventListener("click", () => $("#importDataInput").click());
  $("#restoreRecovery").addEventListener("click", restoreRecovery);
  $("#importDataInput").addEventListener("change", (event) => { if (event.target.files[0]) importDataFile(event.target.files[0]); event.target.value = ""; });

  document.addEventListener("keydown", (event) => {
    if (currentView !== "today" || $("#studyPanel").hidden || studyMode === "quiz") return;
    if (event.key === " " && $("#wordReveal").hidden) { event.preventDefault(); revealCurrentWord(); }
    if (!$("#ratingActions").hidden && ["1", "2", "3"].includes(event.key)) {
      rateCurrentWord({ "1": "unknown", "2": "fuzzy", "3": "known" }[event.key]);
    }
  });
  window.addEventListener("beforeunload", () => { stopPronunciationAudio(); stopAITextSpeech(false); stopTextDictation(true); stopVoiceImmediately(false); persistState(); });
  window.addEventListener("online", () => scheduleCloudSync(100));
  window.addEventListener("offline", () => setSyncStatus("offline", "当前离线，记录已安全保存在本机"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleCloudSync(250);
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    state = loadState();
    renderAll();
    toast("存档已同步", "检测到同一网址下的其他页面更新了学习记录。" );
  });
  matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => { if (state.settings.theme === "system") applyTheme(); });
}

function renderAll() {
  renderHeader();
  renderToday();
  renderTimer();
  renderAI();
  renderProgress();
  renderSettings();
  renderNavigation();
}

function registerWebMCP() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const register = (tool) => {
    try {
      Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
    } catch {
      // WebMCP is progressive enhancement; the visible app remains fully usable.
    }
  };

  register({
    name: "get_today_plan",
    title: "读取今日四级计划",
    description: "读取今天的新词目标、完成量、到期复习量、筛查进度和考试倒计时，不修改学习数据。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute() {
      const record = todayRecord();
      return {
        date: localDateKey(),
        daysUntilExam: daysUntilExam(),
        newWordTarget: state.settings.dailyTarget,
        newWordsLearned: record.learned,
        dueReviews: dueWords().length,
        screenedToday: record.screened,
        focusMinutes: Math.floor(record.focusSeconds / 60)
      };
    }
  });

  register({
    name: "set_daily_word_target",
    title: "设置今日新词数量",
    description: "把今天的新词目标调整到20至50之间，并立即更新可见的今日学习界面。",
    inputSchema: {
      type: "object",
      properties: { target: { type: "integer", minimum: 20, maximum: 50 } },
      required: ["target"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      const target = Number(input?.target);
      if (!Number.isInteger(target) || target < 20 || target > 50) throw new TypeError("target must be an integer from 20 to 50");
      setDailyTarget(target, true);
      return { date: localDateKey(), newWordTarget: state.settings.dailyTarget };
    }
  });

  register({
    name: "start_study_mode",
    title: "打开学习模式",
    description: "在今日页面打开快速筛查、单词学习或抽测，并显示对应的当前任务。",
    inputSchema: {
      type: "object",
      properties: { mode: { type: "string", enum: ["screen", "learn", "quiz"] } },
      required: ["mode"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      if (!["screen", "learn", "quiz"].includes(input?.mode)) throw new TypeError("mode must be screen, learn, or quiz");
      currentView = "today";
      renderNavigation();
      openStudy(input.mode);
      return { view: currentView, studyMode: input.mode, currentWord: currentWord?.word || null };
    }
  });
}

async function init() {
  applyTheme();
  bindEvents();
  await loadContent();
  renderAll();
  void initializeCloudSync();
  checkAIStatus();
  renderVoices();
  if ("speechSynthesis" in window) speechSynthesis.addEventListener?.("voiceschanged", renderVoices);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js?v=32", { updateViaCache: "none" }).catch(() => {});
  registerWebMCP();
  warnTemporaryStorageScope();
  window.setTimeout(checkBackupReminder, 900);
}

init();
