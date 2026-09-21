"use strict";

const STORAGE_KEY = "mogu-cet4-state-v1";
const DB_NAME = "mogu-cet4-audio";
const DB_VERSION = 1;
const STABLE_LOCAL_ORIGIN = "http://127.0.0.1:4174";
const WORD_PHASE_SECONDS = 15 * 60;
const LISTEN_PHASE_SECONDS = 15 * 60;
const EXAM_DEFAULT = "2026-12-12";

const fallbackWords = [
  { word: "access", phonetic: "ˈækses", translation: "n. 进入；使用权 v. 访问", frequency: 86, phrase: "have access to", phraseMeaning: "有权使用；可以接近" },
  { word: "available", phonetic: "əˈveɪləbl", translation: "adj. 可获得的；有空的", frequency: 121, phrase: "be available to", phraseMeaning: "可被……获得或使用" },
  { word: "approach", phonetic: "əˈprəʊtʃ", translation: "n. 方法；接近 v. 靠近", frequency: 174, phrase: "an approach to", phraseMeaning: "处理……的方法" },
  { word: "benefit", phonetic: "ˈbenɪfɪt", translation: "n. 好处 v. 受益", frequency: 193, phrase: "benefit from", phraseMeaning: "从……中受益" },
  { word: "concern", phonetic: "kənˈsɜːn", translation: "n. 担忧；事项 v. 涉及", frequency: 212, phrase: "be concerned about", phraseMeaning: "担心；关注" },
  { word: "contribute", phonetic: "kənˈtrɪbjuːt", translation: "v. 贡献；促成", frequency: 286, phrase: "contribute to", phraseMeaning: "有助于；促成" },
  { word: "determine", phonetic: "dɪˈtɜːmɪn", translation: "v. 决定；查明", frequency: 302, phrase: "be determined to", phraseMeaning: "决心做……" },
  { word: "essential", phonetic: "ɪˈsenʃl", translation: "adj. 必不可少的 n. 要素", frequency: 337, phrase: "be essential to", phraseMeaning: "对……至关重要" },
  { word: "maintain", phonetic: "meɪnˈteɪn", translation: "v. 维持；保养；坚持", frequency: 468, phrase: "maintain a balance", phraseMeaning: "保持平衡" },
  { word: "responsible", phonetic: "rɪˈspɒnsəbl", translation: "adj. 负责的；作为原因的", frequency: 614, phrase: "be responsible for", phraseMeaning: "对……负责；是……的原因" }
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
  }
};

const defaultAIState = () => ({ scenario: "campus", sessions: {} });

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
let quizQueue = [];
let currentQuiz = null;
let currentTrack = null;
let objectAudioUrl = null;
let loopA = null;
let loopB = null;
let aiPending = false;
let aiServiceStatus = "checking";
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

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || typeof parsed !== "object") return defaultState();
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      wordStates: parsed.wordStates || {},
      daily: parsed.daily || {},
      completedListening: parsed.completedListening || [],
      ai: {
        ...base.ai,
        ...(parsed.ai || {}),
        sessions: { ...(parsed.ai?.sessions || {}) }
      }
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function storageScopeInfo() {
  const { origin, hostname } = window.location;
  if (origin === STABLE_LOCAL_ORIGIN) {
    return {
      label: "本机固定入口 · 4174",
      hint: "这是固定的本地开发地址。以后继续使用这个地址，就会读取同一份学习记录。",
      warning: false
    };
  }
  if (hostname === "maiguojun.github.io") {
    return {
      label: "GitHub Pages 线上存档",
      hint: "线上网址拥有独立存档，与本机预览互不覆盖。重新发布到相同网址后仍会读取这份记录。",
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
  Object.values(state.wordStates).forEach((item) => {
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
  window.setTimeout(() => item.remove(), 3800);
}

function applyTheme() {
  const theme = state.settings.theme;
  const resolved = theme === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : theme;
  document.documentElement.dataset.theme = resolved;
  $("meta[name='theme-color']")?.setAttribute("content", resolved === "light" ? "#edf6fb" : "#07111f");
}

async function loadContent() {
  const [wordResult, trackResult] = await Promise.allSettled([
    fetch("./data/words.json?v=6").then((response) => {
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
    return item?.due && item.due <= today;
  });
}

function unscreenedWords() {
  return words.filter((word) => !getWordState(word));
}

function newLearningWords() {
  return words.filter((word) => {
    const item = getWordState(word);
    return !item || ["unknown", "fuzzy"].includes(item.status);
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
  $("#newCount").textContent = `${record.learned} / ${target}`;
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
  studyMode = mode;
  $("#studyPanel").hidden = false;
  $$("[data-study-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.studyMode === mode);
    button.setAttribute("aria-selected", button.dataset.studyMode === mode ? "true" : "false");
  });
  currentWordIndex = 0;
  if (mode === "quiz") prepareQuiz();
  else renderCurrentWord();
  $("#studyPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function currentStudyQueue() {
  if (studyMode === "screen") return unscreenedWords().slice(0, 500);
  const due = dueWords();
  const dueNames = new Set(due.map((word) => word.word));
  const fresh = newLearningWords().filter((word) => !dueNames.has(word.word));
  return [...due, ...fresh].slice(0, Math.max(state.settings.dailyTarget + due.length, 1));
}

function renderCurrentWord() {
  const queue = currentStudyQueue();
  if (!queue.length) {
    renderEmptyStudy();
    return;
  }
  currentWordIndex %= queue.length;
  currentWord = queue[currentWordIndex];
  const item = getWordState(currentWord);
  $("#wordText").textContent = currentWord.word;
  $("#wordPhonetic").textContent = currentWord.phonetic ? `/${currentWord.phonetic.replace(/^\/?|\/?$/g, "")}/` : "";
  $("#wordTranslation").textContent = currentWord.translation || "暂无释义";
  $("#wordRank").textContent = `词频 #${currentWord.rank || currentWord.frequency || "—"}`;
  $("#wordStatus").textContent = item ? ({ known: "认识", fuzzy: "模糊", unknown: "不认识" }[item.status] || "待复习") : "未分类";
  $("#studyPosition").textContent = `${currentWordIndex + 1} / ${queue.length}`;
  $("#wordReveal").hidden = true;
  $("#ratingActions").hidden = true;
  $("#quizOptions").hidden = true;
  $("#revealWord").hidden = false;
  $("#revealWord").textContent = "显示释义";
  const hasPhrase = Boolean(currentWord.phrase);
  $("#phraseBox").hidden = !hasPhrase;
  $("#wordPhrase").textContent = currentWord.phrase || "";
  $("#phraseMeaning").textContent = currentWord.phraseMeaning || "";
}

function renderEmptyStudy() {
  currentWord = null;
  $("#wordText").textContent = "完成";
  $("#wordPhonetic").textContent = "这一组已经没有待处理单词";
  $("#wordReveal").hidden = true;
  $("#ratingActions").hidden = true;
  $("#quizOptions").hidden = true;
  $("#revealWord").hidden = true;
  $("#studyPosition").textContent = "✓";
}

function revealCurrentWord() {
  if (!currentWord) return;
  $("#wordReveal").hidden = false;
  $("#ratingActions").hidden = false;
  $("#revealWord").hidden = true;
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
  currentWordIndex = 0;
  renderQuizQuestion();
}

function renderQuizQuestion() {
  if (!quizQueue.length || currentWordIndex >= quizQueue.length) {
    currentQuiz = null;
    renderEmptyStudy();
    toast("抽测完成", `本轮答对 ${todayRecord().quizCorrect} / ${todayRecord().quizTotal}`);
    renderToday();
    return;
  }
  currentQuiz = quizQueue[currentWordIndex];
  currentWord = currentQuiz.word;
  const otherWords = shuffle(words.filter((word) => word.word !== currentWord.word)).slice(0, 3);
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
    options = shuffle([currentWord, ...otherWords]).map((word) => ({ value: word.word, label: word.translation || word.word }));
  } else if (currentQuiz.type === "audio") {
    $("#wordText").textContent = "听发音，选单词";
    options = shuffle([currentWord, ...otherWords]).map((word) => ({ value: word.word, label: word.word }));
    window.setTimeout(() => speak(currentWord.word), 250);
  } else {
    $("#wordText").textContent = currentWord.phrase.replace(new RegExp(currentWord.word, "i"), "____");
    options = shuffle([currentWord, ...otherWords]).map((word) => ({ value: word.word, label: word.word }));
  }
  $("#quizOptions").innerHTML = options.map((option) => `<button class="quiz-option" type="button" data-answer="${escapeHtml(option.value)}">${escapeHtml(option.label)}</button>`).join("");
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

function speak(text) {
  if (!("speechSynthesis" in window) || !text) return toast("当前浏览器不支持系统发音");
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = state.settings.accent || "en-US";
  const selected = speechSynthesis.getVoices().find((voice) => voice.voiceURI === state.settings.voiceURI);
  if (selected) utterance.voice = selected;
  utterance.rate = 0.88;
  speechSynthesis.speak(utterance);
}

function renderVoices() {
  if (!("speechSynthesis" in window)) return;
  const select = $("#voiceSelect");
  const voices = speechSynthesis.getVoices().filter((voice) => /^en[-_]/i.test(voice.lang));
  select.innerHTML = `<option value="">使用设备默认英文声音</option>${voices.map((voice) => `<option value="${escapeHtml(voice.voiceURI)}">${escapeHtml(voice.name)} · ${escapeHtml(voice.lang)}${voice.localService ? " · 本地" : ""}</option>`).join("")}`;
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

  const status = $("#aiStatus");
  status.classList.toggle("ready", aiServiceStatus === "ready");
  status.classList.toggle("offline", aiServiceStatus === "offline");
  status.textContent = aiServiceStatus === "ready" ? "AI 服务已就绪" : aiServiceStatus === "offline" ? "需要配置 AI 服务" : "正在检查 AI 服务";

  $("#aiMessages").innerHTML = messages.map((message) => `
    <div class="ai-message ${message.role === "user" ? "user" : "assistant"}">
      <div class="ai-message-label">${message.role === "user" ? "YOU" : "AI TUTOR"}</div>
      <div class="ai-bubble">${escapeHtml(message.content || "")}</div>
      ${message.role === "assistant" ? renderAIFeedback(message.feedback) + renderAIVocabulary(message.vocabulary) : ""}
    </div>`).join("") + (aiPending ? `
    <div class="ai-message assistant" aria-label="AI 正在回复">
      <div class="ai-message-label">AI TUTOR</div>
      <div class="ai-bubble ai-typing"><i></i><i></i><i></i></div>
    </div>` : "");
  $("#aiSend").disabled = aiPending;
  $("#aiInput").disabled = aiPending;
  requestAnimationFrame(() => { $("#aiMessages").scrollTop = $("#aiMessages").scrollHeight; });
}

function selectAIScenario(scenario) {
  if (!AI_SCENARIOS[scenario] || aiPending) return;
  state.ai.scenario = scenario;
  currentAISession();
  saveState();
  $("#aiError").hidden = true;
  renderAI();
}

function resetAIConversation() {
  const messages = currentAISession();
  if (messages.length > 1 && !window.confirm("重新开始会清空这个情景的对话记录，确认继续吗？")) return;
  state.ai.sessions[state.ai.scenario] = [];
  currentAISession();
  saveState();
  $("#aiError").hidden = true;
  renderAI();
  $("#aiInput").focus();
}

async function checkAIStatus() {
  try {
    const response = await fetch("./api/ai-status", { cache: "no-store" });
    if (!response.ok) throw new Error("status unavailable");
    const result = await response.json();
    aiServiceStatus = result.configured ? "ready" : "offline";
  } catch {
    aiServiceStatus = "offline";
  }
  renderAI();
}

async function sendAIMessage(event) {
  event.preventDefault();
  if (aiPending) return;
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
    const response = await fetch("./api/ai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: state.ai.scenario, history, message: content })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "AI 暂时无法回复，请稍后重试。");
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
  renderVoices();
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
  if (!state.lastBackupAt) return toast("记得备份学习进度", "设置页可以导出 JSON；清理浏览器数据会删除本机记录。" );
  const elapsed = Date.now() - new Date(state.lastBackupAt).getTime();
  if (elapsed > 7 * 86400000) toast("距离上次备份已超过7天", "完成今天学习后，记得在设置页导出一份备份。" );
}

function bindEvents() {
  $$("[data-view-target]").forEach((button) => button.addEventListener("click", () => {
    currentView = button.dataset.viewTarget;
    renderNavigation();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
  $("#startMission").addEventListener("click", startMissionFromState);
  $("#switchStudyMode").addEventListener("click", () => openStudy("learn"));
  $$("[data-study-mode]").forEach((button) => button.addEventListener("click", () => openStudy(button.dataset.studyMode)));
  $("#revealWord").addEventListener("click", revealCurrentWord);
  $("#speakWord").addEventListener("click", () => speak(currentWord?.word));
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
  $("#aiReset").addEventListener("click", resetAIConversation);
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
  $("#accentSelect").addEventListener("change", (event) => { state.settings.accent = event.target.value; saveState(); });
  $("#voiceSelect").addEventListener("change", (event) => { state.settings.voiceURI = event.target.value; saveState(); });
  $("#themeSelect").addEventListener("change", (event) => { state.settings.theme = event.target.value; saveState(); applyTheme(); });
  $("#themeQuick").addEventListener("click", () => { state.settings.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; saveState(); applyTheme(); renderSettings(); });
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
  window.addEventListener("beforeunload", saveState);
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
  checkAIStatus();
  renderVoices();
  if ("speechSynthesis" in window) speechSynthesis.addEventListener?.("voiceschanged", renderVoices);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js?v=6", { updateViaCache: "none" }).catch(() => {});
  registerWebMCP();
  warnTemporaryStorageScope();
  window.setTimeout(checkBackupReminder, 900);
}

init();
