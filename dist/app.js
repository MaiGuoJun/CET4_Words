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
const ZHIPU_ASR_URL = "https://open.bigmodel.cn/api/paas/v4/audio/transcriptions";
const ZHIPU_TTS_URL = "https://open.bigmodel.cn/api/paas/v4/audio/speech";
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

const WORD_PREFIXES = [
  ["counter", "counter-", "反；对抗"], ["under", "under-", "在下；不足"], ["super", "super-", "在上；超越"],
  ["inter", "inter-", "在……之间"], ["trans", "trans-", "横跨；转移"], ["extra", "extra-", "在外；超出"],
  ["micro", "micro-", "微小"], ["multi", "multi-", "多"], ["post", "post-", "在……之后"],
  ["semi", "semi-", "半"], ["anti", "anti-", "反对；抗"], ["auto", "auto-", "自己；自动"],
  ["over", "over-", "过度；在上"], ["pre", "pre-", "在……之前"], ["sub", "sub-", "在下；次级"],
  ["non", "non-", "非；不"], ["mis", "mis-", "错误地"], ["dis", "dis-", "否定；分开"],
  ["re", "re-", "再次；返回"], ["un", "un-", "不；相反"], ["de", "de-", "去除；向下"],
  ["im", "im-", "进入/使；也可表否定"], ["in", "in-", "进入/在内；也可表否定"], ["ir", "ir-", "不"], ["il", "il-", "不"]
].map(([form, label, meaning]) => ({ form, label, meaning }));

const WORD_SUFFIXES = [
  ["ization", "-ization", "构成名词：过程或结果"], ["ification", "-ification", "构成名词：使……化"],
  ["ability", "-ability", "构成名词：能力或性质"], ["ibility", "-ibility", "构成名词：能力或性质"],
  ["ation", "-ation", "构成名词：过程或结果"], ["ition", "-ition", "构成名词：过程或结果"],
  ["sion", "-sion", "构成名词：行为或结果"], ["tion", "-tion", "构成名词：行为或结果"],
  ["ment", "-ment", "构成名词：行为、状态或结果"], ["ness", "-ness", "构成名词：性质或状态"],
  ["ance", "-ance", "构成名词：状态或行为"], ["ence", "-ence", "构成名词：状态或性质"],
  ["ship", "-ship", "构成名词：关系或身份"], ["hood", "-hood", "构成名词：时期或状态"],
  ["ism", "-ism", "构成名词：主义或现象"], ["ist", "-ist", "构成人：从事者"],
  ["ative", "-ative", "构成形容词：具有……性质"], ["ive", "-ive", "构成形容词：有……倾向"],
  ["able", "-able", "构成形容词：可以……的"], ["ible", "-ible", "构成形容词：可以……的"],
  ["ical", "-ical", "构成形容词：与……有关"], ["ous", "-ous", "构成形容词：充满或具有"],
  ["ful", "-ful", "构成形容词：充满……的"], ["less", "-less", "构成形容词：缺少……的"],
  ["ize", "-ize", "构成动词：使……化"], ["ise", "-ise", "构成动词：使……化"],
  ["ify", "-ify", "构成动词：使成为"], ["ly", "-ly", "常构成副词"],
  ["er", "-er", "构成人或工具"], ["or", "-or", "构成人或工具"], ["age", "-age", "构成名词：状态或集合"]
].map(([form, label, meaning]) => ({ form, label, meaning }));

const WORD_ROOTS = [
  [["spect"], "spect", "看"], [["script", "scrib"], "scrib / script", "写"], [["struct"], "struct", "建造"],
  [["tract"], "tract", "拉；引"], [["duct"], "duc / duct", "引导"], [["dict"], "dict", "说；断言"],
  [["ject"], "ject", "投；抛"], [["port"], "port", "携带；运输"], [["form"], "form", "形状；形成"],
  [["press"], "press", "压"], [["rupt"], "rupt", "破裂"], [["cept", "ceive"], "cept / ceive", "拿；接受"],
  [["cred"], "cred", "相信"], [["memor", "memori"], "memor", "记忆"], [["graph", "gram"], "graph / gram", "写；记录"],
  [["phon"], "phon", "声音"], [["photo"], "photo", "光"], [["psych"], "psych", "心智"],
  [["chron"], "chron", "时间"], [["therm"], "therm", "热"], [["terr"], "terr", "土地"],
  [["aqua"], "aqua", "水"], [["astro"], "astro", "星"], [["geo"], "geo", "地球"],
  [["scope"], "scope", "看；观察工具"], [["meter"], "meter", "测量"], [["cycle", "cycl"], "cycl", "圆；循环"],
  [["quest"], "quest", "寻求；询问"], [["termin"], "termin", "界限；终点"], [["creat"], "creat", "创造"],
  [["equ"], "equ", "相等"], [["gener", "gen"], "gen", "产生；出生"], [["liber"], "liber", "自由"],
  [["loc"], "loc", "地方"], [["mort"], "mort", "死亡"], [["natur", "nat"], "nat", "出生；自然"],
  [["scien"], "sci", "知道；知识"], [["veri"], "ver", "真实"], [["vita", "vivi"], "vit / viv", "生命"],
  [["sect"], "sect", "切；分"], [["sens"], "sens", "感觉"], [["vision", "video"], "vid / vis", "看"],
  [["vocat", "voice"], "voc", "声音；呼叫"], [["bene"], "bene", "好"], [["aud"], "aud", "听"]
].map(([forms, label, meaning]) => ({ forms, label, meaning }));

const DERIVATION_SUFFIX_RULES = [
  ["ization", ["ize"]], ["isation", ["ise"]], ["ification", ["ify"]], ["ability", ["able"]], ["ibility", ["ible"]],
  ["ation", ["ate", "e", ""]], ["ition", ["e", ""]], ["sion", ["de", "d", ""]], ["tion", ["t", "te", ""]],
  ["iness", ["y"]], ["ness", [""]], ["ance", ["ant", ""]], ["ence", ["ent", ""]], ["ment", [""]],
  ["ative", ["ate", ""]], ["ive", ["e", ""]], ["ity", ["e", ""]], ["able", ["e", ""]], ["ible", ["e", ""]],
  ["ical", ["y", "ic", ""]], ["ous", [""]], ["ful", [""]], ["less", [""]], ["ship", [""]], ["hood", [""]],
  ["ism", [""]], ["ist", [""]], ["ize", [""]], ["ise", [""]], ["ify", [""]], ["age", [""]], ["ly", [""]],
  ["er", [""]], ["or", [""]]
].map(([suffix, replacements]) => ({ suffix, replacements }));
const PRODUCTIVE_DERIVATION_SUFFIXES = new Set(["ness", "ful", "less", "ize", "ise", "ify"]);

const CONFUSABLE_GROUPS = [
  ["accept", "except"], ["access", "assess"], ["adapt", "adopt"], ["advice", "advise"], ["affect", "effect"],
  ["allusion", "illusion"], ["assure", "ensure", "insure"], ["beside", "besides"], ["complement", "compliment"],
  ["conscience", "conscious"], ["desert", "dessert"], ["economic", "economical"], ["emigrate", "immigrate"],
  ["historic", "historical"], ["industrial", "industrious"], ["later", "latter", "latest"], ["lie", "lay"],
  ["loose", "lose"], ["personal", "personnel"], ["precede", "proceed"], ["principal", "principle"],
  ["quiet", "quite"], ["raise", "rise", "arise"], ["respectful", "respective"], ["sensible", "sensitive"],
  ["stationary", "stationery"], ["weather", "whether"], ["worth", "worthy"]
];

const AI_SCENARIOS = {
  campus: {
    title: "校园生活",
    goal: "围绕校园日常自然交流，并学会补充理由。",
    opening: "Let’s talk about campus life. What is one part of your daily routine at school that you enjoy?",
    openingTranslation: "我们来聊聊校园生活吧。你在学校的日常生活中，最喜欢哪一部分？"
  },
  travel: {
    title: "旅行出行",
    goal: "练习问路、交通、住宿等真实出行情景。",
    opening: "Imagine you are planning a short trip. Where would you like to go, and how would you travel there?",
    openingTranslation: "假设你正在计划一次短途旅行。你想去哪里，又会选择怎样的交通方式？"
  },
  interview: {
    title: "面试表达",
    goal: "清楚介绍自己，并用具体例子说明个人经历。",
    opening: "Welcome! Please introduce yourself and tell me about one strength that would help you in a student club.",
    openingTranslation: "欢迎！请介绍一下自己，并说说你的一项优点，这项优点能如何帮助你参加学生社团。"
  },
  technology: {
    title: "科技话题",
    goal: "围绕常见四级科技话题表达观点、理由与例子。",
    opening: "Technology has changed the way students learn. Which change has helped you the most, and why?",
    openingTranslation: "科技改变了学生的学习方式。哪一种变化对你的帮助最大？为什么？"
  },
  free: {
    title: "自由畅聊",
    goal: "不设固定情景，跟随你感兴趣的话题自由交流。",
    opening: "This is an open conversation. What would you like to talk about today?",
    openingTranslation: "这是一次自由对话。今天你想聊些什么？"
  }
};

const SPEAKING_PHASES = [
  { id: "warmup", label: "英语热身", short: "2 分钟", seconds: 120, kind: "WARM UP" },
  { id: "translation", label: "中译英", short: "4 分钟", seconds: 240, kind: "THINK IN ENGLISH" },
  { id: "scenario", label: "情景对话", short: "5 分钟", seconds: 300, kind: "CONVERSATION" },
  { id: "shadowing", label: "针对性跟读", short: "3 分钟", seconds: 180, kind: "SHADOWING" },
  { id: "recap", label: "复盘", short: "1 分钟", seconds: 60, kind: "RECAP" }
];

const SPEAKING_TRANSLATION_TASKS = [
  { prompt: "我过去总担心在课堂上说错英语，但现在我愿意先把意思表达出来。", keywords: "used to · worry about · be willing to", skeleton: "I used to ..., but now I am willing to ...", model: "I used to worry about making mistakes in class, but now I am willing to express my ideas first." },
  { prompt: "如果每天坚持练习十五分钟，我就能更自然地用英语组织想法。", keywords: "keep practicing · every day · organize my thoughts", skeleton: "If I keep ..., I will be able to ...", model: "If I keep practicing for fifteen minutes every day, I will be able to organize my thoughts more naturally in English." },
  { prompt: "与其逐字翻译，我更想先抓住核心意思，再选择自然的英语表达。", keywords: "rather than · word for word · main idea", skeleton: "Rather than ..., I would like to ... first and then ...", model: "Rather than translate word for word, I would like to grasp the main idea first and then choose a natural English expression." },
  { prompt: "参加社团不仅让我认识了新朋友，也让我更有信心公开表达观点。", keywords: "not only · make friends · express opinions", skeleton: "Joining ... not only ..., but also ...", model: "Joining a student club not only helped me make new friends, but also made me more confident about expressing my opinions in public." },
  { prompt: "虽然旅行计划临时改变了，我们还是找到了一种更方便的交通方式。", keywords: "although · change unexpectedly · convenient", skeleton: "Although ..., we still found ...", model: "Although our travel plan changed unexpectedly, we still found a more convenient way to travel." },
  { prompt: "科技能提高学习效率，但我们也需要避免过度依赖它。", keywords: "improve efficiency · avoid · depend too much on", skeleton: "Technology can ..., but we also need to ...", model: "Technology can improve learning efficiency, but we also need to avoid depending on it too much." }
];

const defaultAIState = () => ({ scenario: "campus", mode: "text", sessions: {}, writingReviews: [], speakingSessions: [] });
const defaultVocabAssessment = () => ({
  status: "idle",
  version: 1,
  questions: [],
  answers: [],
  currentIndex: 0,
  startedAt: null,
  completedAt: null,
  result: null
});

const defaultState = () => ({
  version: 1,
  settings: {
    examDate: EXAM_DEFAULT,
    scoreGoal: 500,
    dailyTarget: 25,
    dailyTargets: { cet4: 25, cet6: 25 },
    course: "cet4",
    targetIsManual: false,
    targetManualDate: null,
    theme: "system",
    accent: "en-US",
    voiceURI: "",
    presumedKnown: 3000
  },
  wordStates: {},
  pronunciationScores: {},
  listeningWordStates: {},
  listeningProgress: {},
  daily: {},
  completedListening: [],
  ai: defaultAIState(),
  vocabAssessment: defaultVocabAssessment(),
  vocabAssessments: { cet4: defaultVocabAssessment(), cet6: defaultVocabAssessment() },
  lastBackupAt: null,
  createdAt: new Date().toISOString()
});

let state = loadState();
let allWords = [];
let words = [];
let listeningTracks = [];
let currentView = "today";
let wordLibraryState = { status: "all", level: "all", query: "", page: 1, pageSize: 80 };
let studyMode = "screen";
let currentWordIndex = 0;
let currentWord = null;
let studyQueue = [];
let screeningSessionOffset = 0;
let stableStudyHeight = 0;
let libraryStudySnapshot = null;
let activeWordTool = "similar";
let wordLookup = new Map();
let wordFamilyIndex = new Map();
let confusableIndex = new Map();
let wordSpellingBuckets = new Map();
const wordInsightCache = new Map();
let quizQueue = [];
let currentQuiz = null;
let currentTrack = null;
let objectAudioUrl = null;
let loopA = null;
let loopB = null;
let dictationState = { sentences: [], index: 0, result: null };
const pronunciationCache = new Map();
const pronunciationAssetCache = new Map();
const pronunciationBlobCache = new Map();
const cloudPronunciationAssetCache = new Map();
let pronunciationAudio = null;
let pronunciationRequestId = 0;
let pronunciationAudioContext = null;
let pronunciationAudioSource = null;
let activeWordLibrarySpeakButton = null;
let aiPending = false;
let translationPromptPending = false;
let aiServiceStatus = "checking";
let aiServiceInfo = null;
let aiBackendAvailable = false;
let deviceAIConfig = loadDeviceAIConfig();
let aiTextSpeech = { utterance: null, audio: null, objectUrl: null, loading: false, messageIndex: null };
let zhipuSpeechUnavailableUntil = 0;
let zhipuSpeechFailureReason = "";
let shadowingState = { messageIndex: null, status: "idle", recognition: null, mediaRecorder: null, mediaStream: null, mediaChunks: [], stopTimer: null, abortRecording: false, recognized: "", textScore: null, soundScore: null, rhythmScore: null, score: null, error: "" };
let wordPronunciationAssessment = { word: "", status: "idle", mediaRecorder: null, mediaStream: null, mediaChunks: [], stopTimer: null, abortRecording: false, recognized: "", textScore: null, soundScore: null, rhythmScore: null, score: null, provider: "", phonemes: [], errorType: "", error: "" };
const ttsAssessmentCache = new Map();
const visibleAITranslations = new Set();
let voiceSession = {
  state: "idle",
  active: false,
  recognition: null,
  mediaRecorder: null,
  mediaStream: null,
  mediaChunks: [],
  stopTimer: null,
  abortRecording: false,
  restartTimer: null,
  utterance: null,
  audio: null,
  objectUrl: null,
  doubao: null,
  doubaoUserText: "",
  doubaoReplyText: "",
  doubaoTurnSaved: false,
  statusMessage: "准备开始语音练习",
  hintMessage: "点击开始，说一句英语；AI 会回答并由系统朗读。",
  transcript: ""
};
let speakingSession = freshSpeakingSession();
let textDictation = {
  recognition: null,
  mediaRecorder: null,
  mediaStream: null,
  mediaChunks: [],
  stopTimer: null,
  abortRecording: false,
  listening: false,
  starting: false,
  processing: false,
  mode: null,
  statusMessage: "",
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
  const selectedCourse = parsed.settings?.course === "cet6" ? "cet6" : "cet4";
  const normalizeAssessment = (value) => ({
    ...defaultVocabAssessment(),
    ...(value || {}),
    questions: Array.isArray(value?.questions) ? value.questions : [],
    answers: Array.isArray(value?.answers) ? value.answers : []
  });
  const legacyAssessment = normalizeAssessment(parsed.vocabAssessment);
  const vocabAssessments = {
    cet4: normalizeAssessment(parsed.vocabAssessments?.cet4 || legacyAssessment),
    cet6: normalizeAssessment(parsed.vocabAssessments?.cet6)
  };
  return {
    ...base,
    ...parsed,
    settings: {
      ...base.settings,
      ...(parsed.settings || {}),
      course: selectedCourse,
      dailyTarget: Number(parsed.settings?.dailyTargets?.[selectedCourse]) || Number(parsed.settings?.dailyTarget) || 25,
      dailyTargets: {
        cet4: Number(parsed.settings?.dailyTargets?.cet4) || Number(parsed.settings?.dailyTarget) || 25,
        cet6: Number(parsed.settings?.dailyTargets?.cet6) || 25
      }
    },
    wordStates: parsed.wordStates && typeof parsed.wordStates === "object" ? parsed.wordStates : {},
    pronunciationScores: parsed.pronunciationScores && typeof parsed.pronunciationScores === "object" ? parsed.pronunciationScores : {},
    listeningWordStates: parsed.listeningWordStates && typeof parsed.listeningWordStates === "object" ? parsed.listeningWordStates : {},
    listeningProgress: parsed.listeningProgress && typeof parsed.listeningProgress === "object" ? parsed.listeningProgress : {},
    daily: parsed.daily && typeof parsed.daily === "object" ? parsed.daily : {},
    completedListening: Array.isArray(parsed.completedListening) ? parsed.completedListening : [],
    ai: {
      ...base.ai,
      ...(parsed.ai || {}),
      sessions: { ...(parsed.ai?.sessions || {}) },
      writingReviews: Array.isArray(parsed.ai?.writingReviews) ? parsed.ai.writingReviews : [],
      speakingSessions: Array.isArray(parsed.ai?.speakingSessions) ? parsed.ai.speakingSessions.slice(0, 30) : []
    },
    vocabAssessment: vocabAssessments[selectedCourse],
    vocabAssessments
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
    const speechInput = ["glm-asr", "browser"].includes(parsed?.speechInput) ? parsed.speechInput : "glm-asr";
    const speechVoice = parsed?.speechVoice === "system" ? "system" : "glm-tts";
    return { apiKey: String(parsed?.apiKey || "").trim(), model, speechInput, speechVoice };
  } catch {
    return { apiKey: "", model: DEFAULT_ZHIPU_MODEL, speechInput: "glm-asr", speechVoice: "glm-tts" };
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
  state.vocabAssessments ||= { cet4: defaultVocabAssessment(), cet6: defaultVocabAssessment() };
  state.vocabAssessments[activeCourse()] = state.vocabAssessment;
  state.settings.dailyTargets ||= { cet4: 25, cet6: 25 };
  state.settings.dailyTargets[activeCourse()] = state.settings.dailyTarget;
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
  return Math.max(...[item?.updatedAt, item?.assessedAt, item?.lastReviewedAt, item?.learnedAt, item?.screenedAt, item?.completedAt]
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

  const listeningWordStates = {};
  for (const word of new Set([...Object.keys(remote.listeningWordStates), ...Object.keys(local.listeningWordStates)])) {
    const localItem = local.listeningWordStates[word];
    const remoteItem = remote.listeningWordStates[word];
    if (!localItem) listeningWordStates[word] = remoteItem;
    else if (!remoteItem) listeningWordStates[word] = localItem;
    else listeningWordStates[word] = itemTimestamp(localItem) >= itemTimestamp(remoteItem) ? localItem : remoteItem;
  }

  const pronunciationScores = {};
  for (const word of new Set([...Object.keys(remote.pronunciationScores), ...Object.keys(local.pronunciationScores)])) {
    const localItem = local.pronunciationScores[word];
    const remoteItem = remote.pronunciationScores[word];
    if (!localItem) pronunciationScores[word] = remoteItem;
    else if (!remoteItem) pronunciationScores[word] = localItem;
    else pronunciationScores[word] = itemTimestamp(localItem) >= itemTimestamp(remoteItem) ? localItem : remoteItem;
  }

  const listeningProgress = {};
  for (const trackId of new Set([...Object.keys(remote.listeningProgress), ...Object.keys(local.listeningProgress)])) {
    const localItem = local.listeningProgress[trackId];
    const remoteItem = remote.listeningProgress[trackId];
    if (!localItem) listeningProgress[trackId] = remoteItem;
    else if (!remoteItem) listeningProgress[trackId] = localItem;
    else listeningProgress[trackId] = itemTimestamp(localItem) >= itemTimestamp(remoteItem) ? localItem : remoteItem;
  }

  const daily = {};
  for (const date of new Set([...Object.keys(remote.daily), ...Object.keys(local.daily)])) {
    const left = remote.daily[date] || {};
    const right = local.daily[date] || {};
    daily[date] = { ...left, ...right };
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      if (typeof left[key] === "number" || typeof right[key] === "number") daily[date][key] = Math.max(Number(left[key]) || 0, Number(right[key]) || 0);
    }
    const courses = {};
    for (const course of ["cet4", "cet6"]) {
      const leftCourse = courseDailyRecord(left, course, false) || {};
      const rightCourse = courseDailyRecord(right, course, false) || {};
      courses[course] = { ...leftCourse, ...rightCourse };
      for (const key of new Set([...Object.keys(leftCourse), ...Object.keys(rightCourse)])) {
        if (typeof leftCourse[key] === "number" || typeof rightCourse[key] === "number") {
          courses[course][key] = Math.max(Number(leftCourse[key]) || 0, Number(rightCourse[key]) || 0);
        }
      }
    }
    daily[date].courses = courses;
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
    pronunciationScores,
    listeningWordStates,
    listeningProgress,
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
      activateCourseWords();
      initializeWordInsightIndex();
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
        activateCourseWords();
        initializeWordInsightIndex();
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

function activeCourse() {
  return state.settings.course === "cet6" ? "cet6" : "cet4";
}

function courseLabel(course = activeCourse()) {
  return course === "cet6" ? "六级・考研英语" : "英语四级";
}

function emptyDailyRecord(target = state.settings.dailyTarget) {
  return { screened: 0, learned: 0, quizCorrect: 0, quizTotal: 0, focusSeconds: 0, target };
}

function courseDailyRecord(root, course = activeCourse(), create = false) {
  if (!root) return create ? emptyDailyRecord() : null;
  if (!root.courses) {
    root.courses = {
      cet4: {
        screened: Number(root.screened) || 0,
        learned: Number(root.learned) || 0,
        quizCorrect: Number(root.quizCorrect) || 0,
        quizTotal: Number(root.quizTotal) || 0,
        focusSeconds: Number(root.focusSeconds) || 0,
        target: Number(root.target) || Number(state.settings.dailyTargets?.cet4) || 25
      }
    };
  }
  if (create && !root.courses[course]) root.courses[course] = emptyDailyRecord(Number(state.settings.dailyTargets?.[course]) || 25);
  return root.courses[course] || null;
}

function todayRecord() {
  const key = localDateKey();
  state.daily[key] ||= { courses: {} };
  const record = courseDailyRecord(state.daily[key], activeCourse(), true);
  record.target ||= state.settings.dailyTarget;
  return record;
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
    const record = courseDailyRecord(state.daily[localDateKey(date)], activeCourse(), false);
    if (!record) continue;
    debt += Math.max(0, (record.target || 20) - (record.learned || 0));
  }
  return debt;
}

function recommendedDailyTarget() {
  if (!words.length) return 25;
  if (activeCourse() === "cet6") return Math.min(50, 25 + Math.min(5, Math.ceil(recentMissedDebt() / 7)));
  const counts = stateCounts();
  const presumedKnown = activeCourse() === "cet4" ? state.settings.presumedKnown || 0 : 0;
  const assumedRemaining = Math.max(0, words.length - Math.max(counts.known, presumedKnown));
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
    const current = courseDailyRecord(state.daily[localDateKey()], activeCourse(), false);
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
    fetch("./data/words.json?v=11").then((response) => {
      if (!response.ok) throw new Error("word data unavailable");
      return response.json();
    }),
    fetch("./data/listening.json?v=6").then((response) => {
      if (!response.ok) throw new Error("listening data unavailable");
      return response.json();
    })
  ]);
  allWords = wordResult.status === "fulfilled" && wordResult.value.length ? wordResult.value : fallbackWords;
  activateCourseWords();
  initializeWordInsightIndex();
  listeningTracks = trackResult.status === "fulfilled" ? trackResult.value : [];
  listeningTracks.push(...(await getAllLocalTracks()));
  applyRecommendedTarget();
  saveState();
}

function wordBelongsToCourse(word, course = activeCourse()) {
  if (course === "cet6") return word.course === "cet6" || word.level === "CET6" || word.level === "POSTGRAD" || word.isPostgradExtension;
  return word.course === "cet4" || (!word.course && word.level !== "CET6" && word.level !== "POSTGRAD" && !word.isCET6Supplement);
}

function activateCourseWords() {
  words = allWords.filter((word) => wordBelongsToCourse(word));
}

function switchCourse(nextCourse) {
  const next = nextCourse === "cet6" ? "cet6" : "cet4";
  const previous = activeCourse();
  if (next === previous) return;
  state.vocabAssessments[previous] = state.vocabAssessment;
  state.settings.dailyTargets[previous] = state.settings.dailyTarget;
  state.settings.course = next;
  state.settings.dailyTarget = Number(state.settings.dailyTargets[next]) || 25;
  state.settings.targetIsManual = false;
  state.settings.targetManualDate = null;
  state.vocabAssessment = state.vocabAssessments[next] || defaultVocabAssessment();
  state.vocabAssessments[next] = state.vocabAssessment;
  activateCourseWords();
  initializeWordInsightIndex();
  wordLibraryState = { ...wordLibraryState, level: "all", page: 1 };
  studyQueue = [];
  quizQueue = [];
  currentWord = null;
  currentQuiz = null;
  $("#studyPanel").hidden = true;
  applyRecommendedTarget();
  saveState();
  renderAll();
  toast(`已切换到${courseLabel(next)}`, `${words.length.toLocaleString("zh-CN")} 个词，学习进度与每日记录独立计算。`);
}

function renderNavigation() {
  $$("[data-view]").forEach((view) => {
    const active = view.dataset.view === currentView;
    view.hidden = !active;
    view.classList.toggle("active", active);
  });
  const navigationView = studyMode === "library" ? "words" : currentView;
  $$("[data-view-target]").forEach((button) => {
    const active = button.dataset.viewTarget === navigationView;
    button.classList.toggle("active", active);
    if (button.classList.contains("nav-item")) active ? button.setAttribute("aria-current", "page") : button.removeAttribute("aria-current");
  });
  if (currentView === "progress") renderProgress();
  if (currentView === "words") renderWordLibrary();
  if (currentView === "listening") renderTrackList();
  if (currentView === "ai") renderAI();
}

function renderHeader() {
  const dateText = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
  $("#todayDate").textContent = dateText;
  $$('[data-countdown]').forEach((node) => { node.textContent = daysUntilExam(); });
  $$('[data-course-select]').forEach((select) => { select.value = activeCourse(); });
  $$('[data-course-label]').forEach((node) => { node.textContent = activeCourse() === "cet6" ? "CET-6 / KY" : "CET-4"; });
  const levelSelect = $("#wordLibraryLevel");
  if (levelSelect && levelSelect.dataset.course !== activeCourse()) {
    levelSelect.dataset.course = activeCourse();
    levelSelect.innerHTML = activeCourse() === "cet6"
      ? '<option value="all">全部高级课程</option><option value="cet6">六级核心</option><option value="postgrad">考研英语扩展</option>'
      : '<option value="all">全部四级词汇</option>';
    wordLibraryState.level = "all";
  }
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
  const assessmentComplete = state.vocabAssessment.status === "complete";
  const screeningActive = !assessmentComplete && counts.screened < words.length && record.screened < screenedGoal;
  const learningProgress = Math.min(1, record.learned / Math.max(1, target));
  const finishedParts = Number(due === 0) + learningProgress + Number(quizDone) + Number(listened);
  const percent = Math.round((finishedParts / 4) * 100);

  $("#todayTarget").textContent = target;
  $("#settingsTargetOutput").textContent = target;
  $("#dailyTargetInput").value = target;
  $("#targetReason").textContent = state.settings.targetIsManual
    ? "已手动调整（20–50）"
    : activeCourse() === "cet6" ? `高级课程默认 ${recommendedDailyTarget()} 个` : `按剩余词量推荐 ${recommendedDailyTarget()} 个`;
  $("#dueCount").textContent = `${due} 个`;
  $("#newCount").textContent = record.learned > target ? `${target} / ${target} · 加练 ${record.learned - target}` : `${record.learned} / ${target}`;
  $("#quizCount").textContent = record.quizTotal ? `${record.quizCorrect} / ${record.quizTotal}` : "未开始";
  $("#listenCount").textContent = listened ? "已完成" : "未开始";
  $("#dailyOrbit").style.setProperty("--progress", `${percent}%`);
  $("#dailyPercent").textContent = `${percent}%`;
  $("#screenedStat").textContent = counts.screened;
  $("#learnedTodayStat").textContent = record.learned;
  $("#minutesTodayStat").textContent = Math.floor(record.focusSeconds / 60);
  $("#openVocabTest").textContent = state.vocabAssessment.status === "active"
    ? "继续词汇量测试"
    : assessmentComplete ? "查看测试结果" : "词汇量小测试";

  if (screeningActive) {
    $("#missionTitle").textContent = `快速筛查 ${Math.max(0, screenedGoal - record.screened)} 个词`;
    $("#missionDetail").textContent = `已建立 ${counts.screened} 个词的基线。筛查用于找回原有进度，不占今日新词额度。`;
    $("#startMission").textContent = "继续快速筛查";
    $("#switchStudyMode").hidden = false;
  } else if (record.learned < target) {
    $("#missionTitle").textContent = `完成今日 ${target - record.learned} 个新词`;
    const skipped = Number(state.vocabAssessment.result?.skipped) || 0;
    $("#missionDetail").textContent = skipped
      ? `小测试已保守跳过 ${skipped} 个简单词；先处理 ${due} 个到期词，再学习真正需要的词。`
      : `先处理 ${due} 个到期词，再完成新词与听音复核。`;
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

function placementWords() {
  return words;
}

function primaryTestMeaning(word) {
  const senses = wordSenseRows(word);
  const best = [...senses].sort((left, right) => (Number(right.stars) || 0) - (Number(left.stars) || 0))[0];
  const partOfSpeech = best?.partOfSpeech || word?.partOfSpeech || "";
  const meaning = best?.meaning || word?.translation || "暂无释义";
  return `${partOfSpeech} ${meaning}`.trim();
}

function createVocabAssessmentQuestions() {
  const pool = placementWords();
  const bucketCount = 8;
  const questionsPerBucket = 3;
  const bucketSize = Math.ceil(pool.length / bucketCount);
  const questions = [];

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = bucket * bucketSize;
    const bucketWords = pool.slice(start, Math.min(pool.length, start + bucketSize));
    const unclassified = bucketWords.filter((word) => !getWordState(word));
    const candidates = unclassified.length >= questionsPerBucket ? unclassified : bucketWords;
    const targets = shuffle([...candidates]).slice(0, questionsPerBucket);

    targets.forEach((target) => {
      const correct = primaryTestMeaning(target);
      const nearbyStart = Math.max(0, start - bucketSize);
      const nearbyEnd = Math.min(pool.length, start + bucketSize * 2);
      const used = new Set([correct]);
      const distractors = shuffle(pool.slice(nearbyStart, nearbyEnd).filter((word) => word.word !== target.word))
        .map(primaryTestMeaning)
        .filter((meaning) => {
          if (used.has(meaning)) return false;
          used.add(meaning);
          return true;
        })
        .slice(0, 3);
      questions.push({
        word: target.word,
        bucket,
        correct,
        options: shuffle([correct, ...distractors])
      });
    });
  }
  return questions;
}

function openVocabTest() {
  renderVocabTest();
  const dialog = $("#vocabTestDialog");
  if (!dialog.open) dialog.showModal();
}

function startVocabTest() {
  if (state.vocabAssessment.status === "idle") {
    const questions = createVocabAssessmentQuestions();
    if (questions.length < 24) {
      toast("暂时无法开始测试", "词库加载不完整，请刷新页面后再试。" );
      return;
    }
    state.vocabAssessment = {
      ...defaultVocabAssessment(),
      status: "active",
      questions,
      startedAt: new Date().toISOString()
    };
    saveState();
    renderToday();
  }
  renderVocabTest();
}

function renderVocabTest() {
  const assessment = state.vocabAssessment;
  const isActive = assessment.status === "active";
  const isComplete = assessment.status === "complete";
  $("#vocabTestIntro").hidden = isActive || isComplete;
  $("#vocabTestQuestion").hidden = !isActive;
  $("#vocabTestResult").hidden = !isComplete;

  if (isActive) {
    const total = assessment.questions.length;
    const index = Math.max(0, Math.min(Number(assessment.currentIndex) || 0, total));
    if (index >= total) {
      completeVocabAssessment();
      return;
    }
    const question = assessment.questions[index];
    const word = words.find((item) => item.word === question.word);
    if (!word || !Array.isArray(question.options) || question.options.length < 4) {
      state.vocabAssessment = defaultVocabAssessment();
      saveState();
      renderVocabTest();
      toast("测试题已更新", "请重新开始这次词汇量测试。" );
      return;
    }
    $("#vocabTestPosition").textContent = `${index + 1} / ${total}`;
    $("#vocabTestBar").style.width = `${Math.round((index / total) * 100)}%`;
    $("#vocabTestWord").textContent = word.word;
    $("#vocabTestPhonetic").textContent = word.phonetic ? `/${word.phonetic.replace(/^\/?|\/?$/g, "")}/` : "";
    $("#vocabTestOptions").innerHTML = question.options.map((option, optionIndex) => `
      <button type="button" data-vocab-answer-index="${optionIndex}">${escapeHtml(option)}</button>
    `).join("");
    replayMotion($("#vocabTestQuestion"), "word-enter");
  }

  if (isComplete) {
    const result = assessment.result || {};
    const total = Number(result.total) || 24;
    const correct = Number(result.correct) || 0;
    const skipped = Number(result.skipped) || 0;
    $("#vocabEstimatedKnown").textContent = `约 ${Number(result.estimatedKnown || 0).toLocaleString("zh-CN")}`;
    $("#vocabTestCorrect").textContent = `${correct} / ${total}`;
    $("#vocabTestSkipped").textContent = `${skipped.toLocaleString("zh-CN")} 词`;
    $("#vocabTestSummary").textContent = skipped
      ? `已按保守下限跳过 ${skipped.toLocaleString("zh-CN")} 个高频简单词，并保留 10% 安全余量。答错或不确定的 ${Number(result.missed) || 0} 个测试词已加入学习队列。`
      : `本次没有自动跳过整段词汇；答错或不确定的 ${Number(result.missed) || 0} 个测试词已加入学习队列，避免漏掉基础。`;
  }
}

function answerVocabTest(optionIndex) {
  const assessment = state.vocabAssessment;
  if (assessment.status !== "active") return;
  const index = Number(assessment.currentIndex) || 0;
  const question = assessment.questions[index];
  if (!question) return completeVocabAssessment();
  const selected = Number.isInteger(optionIndex) && optionIndex >= 0 ? question.options[optionIndex] : null;
  assessment.answers.push({
    word: question.word,
    bucket: question.bucket,
    correct: selected === question.correct,
    selected
  });
  assessment.currentIndex = index + 1;
  saveState();
  if (assessment.currentIndex >= assessment.questions.length) completeVocabAssessment();
  else renderVocabTest();
}

function completeVocabAssessment() {
  const assessment = state.vocabAssessment;
  if (assessment.status !== "active") return;
  const pool = placementWords();
  const answers = assessment.answers.slice(0, assessment.questions.length);
  const correct = answers.filter((answer) => answer.correct).length;
  const total = Math.max(1, assessment.questions.length);
  const estimatedKnown = Math.max(0, Math.min(pool.length, Math.round(((correct / total) * pool.length) / 50) * 50));
  const bucketScores = Array.from({ length: 8 }, (_, bucket) => answers.filter((answer) => answer.bucket === bucket && answer.correct).length);
  let passedBuckets = 0;
  while (passedBuckets < bucketScores.length && bucketScores[passedBuckets] >= 2) passedBuckets += 1;
  const conservativePrefix = Math.floor(((passedBuckets / bucketScores.length) * pool.length) * 0.9);
  const safeCutoff = Math.min(estimatedKnown, conservativePrefix);
  const testedWords = new Set(answers.map((answer) => answer.word));
  const timestamp = new Date().toISOString();
  let skipped = 0;

  pool.slice(0, safeCutoff).forEach((word) => {
    if (testedWords.has(word.word) || state.wordStates[word.word]) return;
    state.wordStates[word.word] = {
      status: "known",
      screenedAt: timestamp,
      due: null,
      reviewStep: 1,
      audioVerified: false,
      lastReviewedAt: timestamp,
      placementAssumed: true
    };
    skipped += 1;
  });

  answers.forEach((answer) => {
    if (state.wordStates[answer.word]) return;
    state.wordStates[answer.word] = {
      status: answer.correct ? "known" : "unknown",
      screenedAt: timestamp,
      due: answer.correct ? null : localDateKey(),
      reviewStep: answer.correct ? 1 : 0,
      audioVerified: false,
      lastReviewedAt: timestamp,
      placementTested: true
    };
  });

  assessment.status = "complete";
  assessment.currentIndex = total;
  assessment.completedAt = timestamp;
  assessment.result = {
    total,
    correct,
    missed: total - correct,
    estimatedKnown,
    skipped,
    safeCutoff,
    passedBuckets
  };
  state.settings.presumedKnown = estimatedKnown;
  applyRecommendedTarget();
  saveState();
  renderToday();
  renderVocabTest();
}

function finishVocabTest() {
  $("#vocabTestDialog").close();
  currentView = "today";
  renderNavigation();
  openStudy("learn");
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
  const listened = state.completedListening.some((entry) => entry.date === localDateKey());
  if (state.vocabAssessment.status !== "complete" && counts.screened < words.length && record.screened < Math.min(500, words.length - counts.screened)) return openStudy("screen");
  if (record.learned < state.settings.dailyTarget) return openStudy("learn");
  if (record.quizTotal < Math.min(10, state.settings.dailyTarget)) return openStudy("quiz");
  if (listened) return openStudy("review");
  currentView = "listening";
  renderNavigation();
}

function openStudy(mode) {
  if (studyMode === "library") restoreLibraryStudySession();
  stopAITextSpeech();
  studyMode = mode;
  $("#studyPanel").hidden = false;
  $$("[data-study-mode]").forEach((button) => {
    const active = button.dataset.studyMode === mode || (mode === "review" && button.dataset.studyMode === "learn");
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  currentWordIndex = 0;
  screeningSessionOffset = mode === "screen" ? todayRecord().screened : 0;
  studyQueue = createStudyQueue(mode);
  stableStudyHeight = 0;
  $("#wordWorkspace").style.removeProperty("min-height");
  if (mode === "quiz") prepareQuiz();
  else {
    renderCurrentWord();
    if (mode === "review" && studyQueue.length) toast("已生成复习组", `优先复习 ${studyQueue.length} 个薄弱或久未复习的单词。`);
  }
  $("#studyPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function createStudyQueue(mode = studyMode) {
  if (mode === "screen") {
    const remaining = Math.max(0, 500 - todayRecord().screened);
    return unscreenedWords().slice(0, remaining);
  }
  if (mode === "review") {
    const statusPriority = { unknown: 0, fuzzy: 1, known: 2 };
    return words.filter((word) => getWordState(word)?.learnedAt).sort((left, right) => {
      const leftState = getWordState(left);
      const rightState = getWordState(right);
      const statusDifference = (statusPriority[leftState?.status] ?? 3) - (statusPriority[rightState?.status] ?? 3);
      if (statusDifference) return statusDifference;
      const leftTime = Date.parse(leftState?.lastReviewedAt || leftState?.learnedAt || 0) || 0;
      const rightTime = Date.parse(rightState?.lastReviewedAt || rightState?.learnedAt || 0) || 0;
      return leftTime - rightTime;
    }).slice(0, 20);
  }
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
  const label = wordLevelLabel(word);
  const isAdvanced = label !== "四级";
  badge.hidden = !word;
  badge.textContent = label;
  badge.classList.toggle("cet6", isAdvanced);
  $("#meaningTitle").textContent = word?.isPostgradExtension || word?.level === "POSTGRAD" ? "考研英语常用义项" : isAdvanced ? "六级考频义项" : "四级考频义项";
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

function normalizedWordName(value) {
  return String(value || "").trim().toLocaleLowerCase("en-US");
}

function familyKeys(value) {
  const name = normalizedWordName(value);
  const keys = new Set([name]);
  if (!name || !/^[a-z-]+$/.test(name)) return [...keys];
  if (name.endsWith("e") && name.length > 4) keys.add(name.slice(0, -1));
  for (const rule of DERIVATION_SUFFIX_RULES) {
    if (rule.suffix.length < 4 && !PRODUCTIVE_DERIVATION_SUFFIXES.has(rule.suffix)) continue;
    if (!name.endsWith(rule.suffix) || name.length - rule.suffix.length < 2) continue;
    const stem = name.slice(0, -rule.suffix.length);
    rule.replacements.forEach((replacement) => keys.add(`${stem}${replacement}`));
  }
  for (const prefix of WORD_PREFIXES) {
    if (!name.startsWith(prefix.form) || name.length - prefix.form.length < 3) continue;
    const remainder = name.slice(prefix.form.length);
    if (wordLookup.has(remainder)) keys.add(remainder);
  }
  return [...keys].filter((key) => key && (key.length >= 4 || wordLookup.has(key)));
}

function initializeWordInsightIndex() {
  wordLookup = new Map(words.map((word) => [normalizedWordName(word.word), word]));
  wordFamilyIndex = new Map();
  confusableIndex = new Map();
  wordSpellingBuckets = new Map();
  wordInsightCache.clear();
  words.forEach((word) => {
    const name = normalizedWordName(word.word);
    const bucketKey = `${name[0] || ""}:${name.length}`;
    if (!wordSpellingBuckets.has(bucketKey)) wordSpellingBuckets.set(bucketKey, []);
    wordSpellingBuckets.get(bucketKey).push(word);
    familyKeys(word.word).forEach((key) => {
      if (!wordFamilyIndex.has(key)) wordFamilyIndex.set(key, []);
      wordFamilyIndex.get(key).push(word);
    });
  });
  CONFUSABLE_GROUPS.forEach((group) => {
    const available = group.map((name) => wordLookup.get(name)).filter(Boolean);
    available.forEach((word) => confusableIndex.set(normalizedWordName(word.word), available.filter((item) => item !== word)));
  });
}

function conciseWordMeaning(word) {
  const sense = [...wordSenseRows(word)].sort((a, b) => Number(b.stars || 0) - Number(a.stars || 0))[0];
  const parts = String(sense?.meaning || word?.brief || word?.translation || "暂无释义").split(/[；;]/).filter(Boolean);
  return parts.slice(0, 2).join("；");
}

function wordLevelLabel(word) {
  if (word?.isPostgradExtension || word?.level === "POSTGRAD") return "考研扩展";
  return word?.isCET6Supplement || word?.level === "CET6" ? "六级核心" : "四级";
}

function findWordRoots(value) {
  const name = normalizedWordName(value);
  return WORD_ROOTS.flatMap((root) => {
    const matched = root.forms.filter((form) => name.includes(form)).sort((a, b) => b.length - a.length)[0];
    if (!matched) return [];
    if (matched.length <= 3 && !(name.startsWith(matched) || name.endsWith(matched) || name.length <= matched.length + 5)) return [];
    return [{ ...root, matched }];
  }).sort((a, b) => b.matched.length - a.matched.length).slice(0, 2);
}

function findWordAffixes(value) {
  const name = normalizedWordName(value);
  const roots = findWordRoots(name);
  const keys = familyKeys(name);
  const relatedBase = keys.find((key) => key !== name && wordLookup.has(key));
  const prefix = [...WORD_PREFIXES]
    .sort((a, b) => b.form.length - a.form.length)
    .find((item) => {
      if (!name.startsWith(item.form) || name.length - item.form.length < 3) return false;
      const remainder = name.slice(item.form.length);
      return wordLookup.has(remainder) || findWordRoots(remainder).length || item.form.length >= 4;
    });
  const suffix = [...WORD_SUFFIXES]
    .sort((a, b) => b.form.length - a.form.length)
    .find((item) => {
      if (!name.endsWith(item.form) || name.length - item.form.length < 3) return false;
      return Boolean(relatedBase) || item.form.length >= 4 || roots.length > 0;
    });
  return [
    ...(prefix ? [{ ...prefix, kind: "前缀", split: `${prefix.form} + ${name.slice(prefix.form.length)}` }] : []),
    ...(suffix ? [{ ...suffix, kind: "后缀", split: `${name.slice(0, -suffix.form.length)} + ${suffix.form}` }] : [])
  ];
}

function findWordDerivatives(word) {
  const name = normalizedWordName(word?.word);
  const targetKeys = familyKeys(name);
  const scores = new Map();
  targetKeys.forEach((key) => {
    (wordFamilyIndex.get(key) || []).forEach((candidate) => {
      const candidateName = normalizedWordName(candidate.word);
      if (candidateName === name) return;
      const isDirectBase = targetKeys.includes(candidateName);
      const isDirectDerivedForm = familyKeys(candidateName).includes(name);
      if (!isDirectBase && !isDirectDerivedForm) return;
      const directBaseBonus = candidateName === key ? 1000 : 0;
      scores.set(candidateName, Math.max(scores.get(candidateName) || 0, key.length + directBaseBonus));
    });
  });
  return [...scores.entries()]
    .map(([candidateName, score]) => ({ word: wordLookup.get(candidateName), score }))
    .filter((item) => item.word)
    .sort((a, b) => b.score - a.score || Number(a.word.isCET6Supplement) - Number(b.word.isCET6Supplement) || Number(b.word.frequency || 0) - Number(a.word.frequency || 0))
    .slice(0, 4)
    .map((item) => item.word);
}

function editDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

function findSimilarWords(word, derivatives) {
  const name = normalizedWordName(word?.word);
  const derivativeNames = new Set(derivatives.map((item) => normalizedWordName(item.word)));
  const curated = confusableIndex.get(name) || [];
  const nearby = [name.length - 1, name.length, name.length + 1].flatMap((length) => wordSpellingBuckets.get(`${name[0] || ""}:${length}`) || []);
  const fallback = nearby
    .filter((candidate) => {
      const other = normalizedWordName(candidate.word);
      if (other === name || derivativeNames.has(other) || name.length < 4 || other.length < 4) return false;
      if (name[0] !== other[0] || Math.abs(name.length - other.length) > 1) return false;
      const distance = editDistance(name, other);
      return distance <= 1 || (distance <= 2 && name.slice(0, 2) === other.slice(0, 2));
    })
    .sort((a, b) => editDistance(name, normalizedWordName(a.word)) - editDistance(name, normalizedWordName(b.word)) || Number(a.isCET6Supplement) - Number(b.isCET6Supplement) || Number(b.frequency || 0) - Number(a.frequency || 0));
  const result = [];
  [...curated, ...fallback].forEach((candidate) => {
    if (!result.some((item) => normalizedWordName(item.word) === normalizedWordName(candidate.word))) result.push(candidate);
  });
  return result.slice(0, 4);
}

function buildWordInsight(word) {
  const key = normalizedWordName(word?.word);
  if (wordInsightCache.has(key)) return wordInsightCache.get(key);
  const roots = findWordRoots(key);
  const affixes = findWordAffixes(key);
  const derivatives = findWordDerivatives(word);
  const insight = { roots, affixes, derivatives, similar: [] };
  insight.similar = findSimilarWords(word, derivatives);
  wordInsightCache.set(key, insight);
  return insight;
}

function relatedWordsMarkup(items, emptyText) {
  if (!items.length) return `<p class="word-tool-empty">${escapeHtml(emptyText)}</p>`;
  return `<div class="related-word-list">${items.map((item) => `
    <article class="related-word-item">
      <div><strong>${escapeHtml(item.word)}</strong><span>${escapeHtml(item.partOfSpeech || "")}</span></div>
      <p>${escapeHtml(conciseWordMeaning(item))}</p>
      <small class="word-level-chip ${wordLevelLabel(item) !== "四级" ? "cet6" : ""}">${wordLevelLabel(item)}</small>
    </article>
  `).join("")}</div>`;
}

function renderWordInsights(word) {
  const tools = $("#wordTools");
  const panel = $("#wordToolContent");
  if (!word || !tools || !panel) return;
  tools.hidden = false;
  const insight = buildWordInsight(word);
  $$('[data-word-tool]', tools).forEach((button) => {
    const active = button.dataset.wordTool === activeWordTool;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  if (activeWordTool === "similar") {
    panel.innerHTML = `${relatedWordsMarkup(insight.similar, "当前词库里暂未找到可靠的相近或易混词。")}<p class="word-tool-note">优先展示考试中容易看错、拼错或混用的词。</p>`;
  } else if (activeWordTool === "derivatives") {
    panel.innerHTML = `${relatedWordsMarkup(insight.derivatives, "当前词库里暂未找到可靠的同族派生词。")}<p class="word-tool-note">优先匹配直接派生词，词库不足时补充同构词线索；六级词会单独标注。</p>`;
  } else if (activeWordTool === "affixes") {
    panel.innerHTML = insight.affixes.length ? `<div class="morpheme-list">${insight.affixes.map((item) => `
      <article class="morpheme-item"><small>${item.kind}</small><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.meaning)}</p><code>${escapeHtml(item.split)}</code></article>
    `).join("")}</div><p class="word-tool-note">这是便于备考的学习拆分；个别单词的严格词源可能更复杂。</p>` : `<p class="word-tool-empty">这个词没有适合直接拆出的常见词缀，整体记忆会更准确。</p>`;
  } else if (activeWordTool === "roots") {
    panel.innerHTML = insight.roots.length ? `<div class="morpheme-list">${insight.roots.map((item) => `
      <article class="morpheme-item"><small>词根线索</small><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.meaning)}</p><code>${escapeHtml(item.matched)}</code></article>
    `).join("")}</div><p class="word-tool-note">词根用于辅助联想，不建议用它代替单词在句子里的真实含义。</p>` : `<p class="word-tool-empty">这个词更适合整体记忆，不建议为了拆词而强行找词根。</p>`;
  }
}

function stabilizeStudyWorkspace() {
  const workspace = $("#wordWorkspace");
  stableStudyHeight = Math.max(stableStudyHeight, Math.ceil(workspace.getBoundingClientRect().height));
  workspace.style.minHeight = `${stableStudyHeight}px`;
}

function renderCurrentWord() {
  stopWordPronunciationAssessment(true, false);
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
  const savedPronunciation = state.pronunciationScores[currentWord.word];
  wordPronunciationAssessment = savedPronunciation
    ? { ...wordPronunciationAssessment, ...savedPronunciation, word: currentWord.word, status: "complete", error: "" }
    : { ...wordPronunciationAssessment, word: currentWord.word, status: "idle", recognized: "", textScore: null, soundScore: null, rhythmScore: null, score: null, provider: "", phonemes: [], errorType: "", error: "" };
  $("#wordText").textContent = currentWord.word;
  $("#wordPhonetic").textContent = currentWord.phonetic ? `/${currentWord.phonetic.replace(/^\/?|\/?$/g, "")}/` : "";
  renderWordMeanings(currentWord);
  $("#wordRank").textContent = `词频 #${currentWord.rank || currentWord.frequency || "—"}`;
  $("#wordStatus").textContent = item ? ({ known: "认识", fuzzy: "模糊", unknown: "不认识" }[item.status] || "待复习") : "未分类";
  const libraryDetail = studyMode === "library";
  if (libraryDetail) {
    $("#studyPosition").textContent = "单词详情";
  } else if (studyMode === "screen") {
    const total = Math.min(500, screeningSessionOffset + studyQueue.length);
    $("#studyPosition").textContent = `${screeningSessionOffset + currentWordIndex + 1} / ${total}`;
  } else {
    $("#studyPosition").textContent = `${currentWordIndex + 1} / ${studyQueue.length}`;
  }
  $("#wordReveal").hidden = !libraryDetail;
  $("#ratingActions").hidden = true;
  $("#quizOptions").hidden = true;
  $("#revealWord").hidden = libraryDetail;
  $("#revealWord").textContent = "显示释义";
  renderWordPhrases(currentWord);
  renderWordInsights(currentWord);
  void prepareCurrentPronunciation(currentWord.word);
  renderWordPronunciationAssessment();
  if (libraryDetail) stabilizeStudyWorkspace();
  replayMotion($("#wordWorkspace"), "word-enter");
}

function renderEmptyStudy() {
  stopWordPronunciationAssessment(true, false);
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
  $("#wordToolContent")?.replaceChildren();
  if ($("#wordTools")) $("#wordTools").hidden = true;
  setPronunciationButton("idle");
  renderWordPronunciationAssessment();
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

function applySRSReview(item, quality, date = localDateKey()) {
  const next = item || {};
  const score = Math.max(0, Math.min(5, Number(quality) || 0));
  const previousEase = Math.max(1.3, Number(next.ease) || 2.5);
  let repetitions = Math.max(0, Number(next.repetitions ?? next.reviewStep) || 0);
  let interval = Math.max(0, Number(next.interval) || ({ known: 3, fuzzy: 1, unknown: 0 }[next.status] || 0));
  if (score < 3) {
    repetitions = 0;
    interval = score <= 1 ? 0 : 1;
  } else {
    repetitions += 1;
    interval = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.max(1, Math.round(interval * previousEase));
  }
  const ease = Math.max(1.3, previousEase + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02)));
  next.ease = Math.round(ease * 100) / 100;
  next.repetitions = repetitions;
  next.interval = interval;
  next.reviewStep = repetitions;
  next.due = addDays(date, interval);
  next.lastReviewedAt = new Date().toISOString();
  return next;
}

function rateCurrentWord(rating) {
  if (!currentWord) return;
  const date = localDateKey();
  const previous = getWordState(currentWord);
  const isFreshLearning = studyMode === "learn" && !previous?.learnedAt && (!previous || ["unknown", "fuzzy"].includes(previous.status));
  const item = {
    ...(previous || {}),
    status: rating,
    screenedAt: previous?.screenedAt || new Date().toISOString(),
    learnedAt: studyMode === "learn" ? (previous?.learnedAt || new Date().toISOString()) : previous?.learnedAt,
    audioVerified: previous?.audioVerified || false
  };
  state.wordStates[currentWord.word] = applySRSReview(item, { unknown: 1, fuzzy: 3, known: 5 }[rating], date);
  if (studyMode === "screen") todayRecord().screened += 1;
  if (isFreshLearning) todayRecord().learned += 1;
  saveState();
  currentWordIndex += 1;
  renderCurrentWord();
  renderToday();
}

function reviewDueDate(item, correct) {
  applySRSReview(item, correct ? 4 : 1);
  return item.due;
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
    $("#wordPhonetic").textContent = `中文提示：${primaryTestMeaning(currentWord)}`;
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

function canUseCloudSpeech() {
  return Boolean(syncConfig.endpoint && syncConfig.token);
}

function trimCloudPronunciationCache() {
  while (cloudPronunciationAssetCache.size > 30) {
    const [key, asset] = cloudPronunciationAssetCache.entries().next().value;
    cloudPronunciationAssetCache.delete(key);
    if (asset && typeof asset.then !== "function" && asset.objectUrl) URL.revokeObjectURL(asset.objectUrl);
    pronunciationCache.delete(key);
    pronunciationAssetCache.delete(key);
    pronunciationBlobCache.delete(key);
  }
}

async function fetchCloudPronunciation(word) {
  if (!canUseCloudSpeech()) return null;
  const key = pronunciationCacheKey(word);
  if (cloudPronunciationAssetCache.has(key)) return cloudPronunciationAssetCache.get(key);
  const request = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6500);
    try {
      const params = new URLSearchParams({ word, accent: state.settings.accent || "en-US" });
      const response = await fetch(`${syncConfig.endpoint}/word-audio?${params}`, {
        headers: { Authorization: `Bearer ${syncConfig.token}` },
        signal: controller.signal
      });
      if (!response.ok || !String(response.headers.get("Content-Type") || "").toLowerCase().startsWith("audio/")) return null;
      const blob = await response.blob();
      if (!blob.size) return null;
      const objectUrl = URL.createObjectURL(blob);
      const kind = response.headers.get("X-Pronunciation-Kind") || "human";
      return {
        audio: objectUrl,
        objectUrl,
        blob,
        sourceUrl: normalizePronunciationUrl(response.headers.get("X-Pronunciation-Source")),
        licenseName: response.headers.get("X-Pronunciation-License") || "",
        accent: response.headers.get("X-Pronunciation-Accent") || state.settings.accent || "en-US",
        generated: kind !== "human"
      };
    } catch {
      return null;
    } finally {
      window.clearTimeout(timeout);
    }
  })();
  cloudPronunciationAssetCache.set(key, request);
  const result = await request;
  if (result) {
    cloudPronunciationAssetCache.set(key, result);
    trimCloudPronunciationCache();
  } else {
    cloudPronunciationAssetCache.delete(key);
  }
  return result;
}

async function fetchZhipuWordPronunciation(word) {
  if (!naturalSpeechEnabled()) return null;
  try {
    const blob = await requestAssessmentSpeech(word);
    const objectUrl = URL.createObjectURL(blob);
    const clip = {
      audio: objectUrl,
      objectUrl,
      blob,
      sourceUrl: "",
      licenseName: "",
      accent: state.settings.accent || "en-US",
      generated: true,
      generatedProvider: "zhipu"
    };
    cloudPronunciationAssetCache.set(pronunciationCacheKey(word), clip);
    trimCloudPronunciationCache();
    return clip;
  } catch {
    return null;
  }
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

function settleWithin(promise, timeoutMs, fallback = null) {
  return new Promise((resolve) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, timeoutMs);
    Promise.resolve(promise).then((value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(value);
    }).catch(() => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(fallback);
    });
  });
}

async function getPronunciationClip(text) {
  const word = String(text || "").trim().toLowerCase();
  if (!word) return null;
  const key = `${state.settings.accent || "en-US"}:${word}`;
  if (pronunciationCache.has(key)) return pronunciationCache.get(key);
  const isLocalApp = ["127.0.0.1", "localhost"].includes(window.location.hostname);
  const request = (async () => {
    const humanRequest = isLocalApp
      ? firstAvailablePronunciation([fetchLocalPronunciation(word), fetchCloudPronunciation(word)])
      : firstAvailablePronunciation([fetchCloudPronunciation(word), fetchDictionaryPronunciation(word), fetchWikimediaPronunciation(word)]);
    const human = await settleWithin(humanRequest, 7000, null);
    return human || settleWithin(fetchZhipuWordPronunciation(word), 7000, null);
  })();
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
    if (clip.blob && clip.audio) return { clip, audio: new Audio(clip.audio) };
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
      const timeout = window.setTimeout(() => finish(false), 6500);
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

async function getWordPronunciationBlob(text) {
  const key = pronunciationCacheKey(text);
  if (pronunciationBlobCache.has(key)) return pronunciationBlobCache.get(key);
  const request = (async () => {
    const clip = await getPronunciationClip(text);
    if (!clip?.audio) {
      if (deviceAIConfig.apiKey) return requestAssessmentSpeech(text);
      throw new Error("这个词暂时没有可用于纠音的标准录音。" );
    }
    if (clip.blob) return clip.blob;
    try {
      const response = await fetch(clip.audio, { cache: "force-cache" });
      if (!response.ok) throw new Error("audio unavailable");
      return await response.blob();
    } catch {
      const cloudClip = await fetchCloudPronunciation(text);
      if (cloudClip?.blob) return cloudClip.blob;
      if (deviceAIConfig.apiKey) return requestAssessmentSpeech(text);
      throw new Error("标准发音暂时无法读取。" );
    }
  })();
  pronunciationBlobCache.set(key, request);
  try {
    const blob = await request;
    pronunciationBlobCache.set(key, blob);
    return blob;
  } catch (error) {
    pronunciationBlobCache.delete(key);
    throw error;
  }
}

async function prepareCurrentPronunciation(text) {
  if (!text || currentWord?.word !== text) return;
  setPronunciationButton("idle", text);
  const clip = await settleWithin(getPronunciationClip(text), 6000, null);
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
  button.disabled = !currentWord;
  button.classList.toggle("loading", waiting);
  button.setAttribute("aria-busy", waiting ? "true" : "false");
  button.textContent = status === "preparing" && matchesCurrentWord
    ? "▶ 播放发音"
    : status === "fallback" && matchesCurrentWord
      ? "▶ 设备发音"
    : status === "loading" && matchesCurrentWord
      ? "获取真人发音…"
      : status === "playing" && matchesCurrentWord
        ? "正在播放…"
        : "▶ 播放发音";
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
  const generatedName = clip.generatedProvider === "zhipu" ? "智谱自然语音" : "自然语音";
  label.textContent = clip.fallback ? "设备备用发音" : clip.generated ? `${generatedName}${accent ? ` · ${accent}` : ""}` : `真人录音${accent ? ` · ${accent}` : ""}`;
  container.append(label);
  if (!clip.fallback && !clip.generated && clip.sourceUrl) {
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

function setWordLibrarySpeakButton(button, status, text = button?.dataset.wordListSpeak) {
  if (!button?.isConnected) return;
  const loading = status === "loading";
  const playing = status === "playing";
  button.classList.toggle("loading", loading);
  button.classList.toggle("playing", playing);
  button.disabled = loading;
  button.setAttribute("aria-busy", loading ? "true" : "false");
  button.setAttribute("aria-label", `${loading ? "正在获取发音" : playing ? "正在播放" : "朗读"} ${text || "单词"}`);
  button.innerHTML = loading
    ? '<span class="word-library-spinner" aria-hidden="true"></span>'
    : playing
      ? '<span class="word-library-wave" aria-hidden="true"><i></i><i></i><i></i></span>'
      : '<span class="word-library-speak-glyph" aria-hidden="true">▶</span>';
}

function resetActiveWordLibrarySpeakButton() {
  if (activeWordLibrarySpeakButton) setWordLibrarySpeakButton(activeWordLibrarySpeakButton, "idle");
  activeWordLibrarySpeakButton = null;
}

function speakWithSystemVoice(text, { onStart, onEnd } = {}) {
  if (!("speechSynthesis" in window) || !text) return false;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = state.settings.accent || "en-US";
  const selected = selectSystemEnglishVoice();
  if (selected) utterance.voice = selected;
  utterance.rate = 0.82;
  utterance.pitch = 0.96;
  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  speechSynthesis.speak(utterance);
  return true;
}

async function speak(text, { notifyFallback = false, triggerButton = null } = {}) {
  if (!text) return;
  resetActiveWordLibrarySpeakButton();
  const libraryButton = triggerButton?.matches?.("[data-word-list-speak]") ? triggerButton : null;
  if (libraryButton) {
    activeWordLibrarySpeakButton = libraryButton;
    setWordLibrarySpeakButton(libraryButton, "loading", text);
  }
  const setLibraryStatus = (status) => {
    if (!libraryButton || activeWordLibrarySpeakButton !== libraryButton) return;
    setWordLibrarySpeakButton(libraryButton, status, text);
    if (status === "idle") activeWordLibrarySpeakButton = null;
  };
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
      const spoke = speakWithSystemVoice(text, {
        onStart: () => setLibraryStatus("playing"),
        onEnd: () => setLibraryStatus("idle")
      });
      if (!spoke) setLibraryStatus("idle");
      if (notifyFallback) {
        const detail = reason?.name === "NotAllowedError"
          ? "浏览器阻止了音频播放，请在地址栏允许声音后重试。"
          : spoke ? "已改用设备备用发音，请稍后再试。" : "请联网或更换浏览器后重试。";
        toast(reason?.name === "NotAllowedError" ? "浏览器阻止了真人录音" : spoke ? "真人录音暂时无法播放" : "当前无法播放发音", detail);
      }
    };
    audio.onended = () => {
      if (pronunciationAudio === audio) pronunciationAudio = null;
      if (requestId === pronunciationRequestId) {
        setPronunciationButton("idle", text);
        setLibraryStatus("idle");
      }
    };
    audio.onerror = () => fallback(audio.error);
    const playback = audio.play();
    renderPronunciationSource(clip);
    setPronunciationButton("playing", text);
    setLibraryStatus("playing");
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
  const clip = await settleWithin(getPronunciationClip(text), 7000, null);
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
        if (requestId === pronunciationRequestId) {
          setPronunciationButton("idle", text);
          setLibraryStatus("idle");
        }
      }, { once: true });
      source.start();
      renderPronunciationSource(clip);
      setPronunciationButton("playing", text);
      setLibraryStatus("playing");
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
      if (requestId === pronunciationRequestId) {
        setPronunciationButton("idle", text);
        setLibraryStatus("idle");
      }
    }, { once: true });
    try {
      await audio.play();
      if (requestId !== pronunciationRequestId) return;
      renderPronunciationSource(clip);
      setPronunciationButton("playing", text);
      setLibraryStatus("playing");
      return;
    } catch {
      if (pronunciationAudio === audio) pronunciationAudio = null;
    }
  }

  renderPronunciationSource({ fallback: true });
  setPronunciationButton("idle", text);
  const spoke = speakWithSystemVoice(text, {
    onStart: () => setLibraryStatus("playing"),
    onEnd: () => setLibraryStatus("idle")
  });
  if (!spoke) setLibraryStatus("idle");
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
  state.settings.dailyTargets[activeCourse()] = state.settings.dailyTarget;
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

function splitTranscriptSentences(text) {
  return (String(text || "").replace(/\s+/g, " ").match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [])
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 8);
}

function normalizedEnglishWords(text) {
  return (String(text || "").toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []).map((word) => word.replace(/^'+|'+$/g, ""));
}

function lcsLength(left, right) {
  const previous = new Uint16Array(right.length + 1);
  const current = new Uint16Array(right.length + 1);
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) current[j] = left[i - 1] === right[j - 1] ? previous[j - 1] + 1 : Math.max(previous[j], current[j - 1]);
    previous.set(current);
    current.fill(0);
  }
  return previous[right.length];
}

function scoreTextMatch(target, attempt) {
  const expected = normalizedEnglishWords(target);
  const actual = normalizedEnglishWords(attempt);
  if (!expected.length) return { score: 0, matched: 0, expected, actual, missed: [] };
  const matched = lcsLength(expected, actual);
  const precision = actual.length ? matched / actual.length : 0;
  const recall = matched / expected.length;
  const score = Math.round((precision && recall ? (2 * precision * recall) / (precision + recall) : 0) * 100);
  const remaining = [...actual];
  const missed = expected.filter((word) => {
    const index = remaining.indexOf(word);
    if (index < 0) return true;
    remaining.splice(index, 1);
    return false;
  });
  return { score, matched, expected, actual, missed };
}

const LISTENING_STOPWORDS = new Set("the a an and or but of to in on at for from with is are was were be been being it this that these those i you he she we they my your his her our their do does did have has had can could will would should may might not no so as if then than there here what which who how when where why".split(" "));

function addMissedListeningWords(wordsMissed) {
  const now = new Date().toISOString();
  [...new Set(wordsMissed)].filter((word) => word.length >= 3 && !LISTENING_STOPWORDS.has(word)).slice(0, 8).forEach((word) => {
    const previous = state.listeningWordStates[word] || {};
    state.listeningWordStates[word] = {
      ...previous,
      word,
      sourceTrackId: currentTrack?.id || previous.sourceTrackId || "",
      sourceTitle: currentTrack?.title || previous.sourceTitle || "听写材料",
      misses: (Number(previous.misses) || 0) + 1,
      due: localDateKey(),
      learnedAt: previous.learnedAt || now,
      lastReviewedAt: now
    };
  });
}

function dueListeningWords() {
  const today = localDateKey();
  return Object.values(state.listeningWordStates || {}).filter((item) => item?.word && (!item.due || item.due <= today)).sort((left, right) => (Date.parse(left.lastReviewedAt || 0) || 0) - (Date.parse(right.lastReviewedAt || 0) || 0));
}

function reviewListeningWord(word, heard) {
  const item = state.listeningWordStates[word];
  if (!item) return;
  applySRSReview(item, heard ? 4 : 1);
  item.attempts = (Number(item.attempts) || 0) + 1;
  item.heardCount = (Number(item.heardCount) || 0) + Number(heard);
  saveState();
  renderListeningWordQueue();
}

function renderListeningWordQueue() {
  const queue = dueListeningWords();
  if (!$("#listeningWordQueue")) return;
  $("#listeningDueCount").textContent = `${queue.length} 个到期`;
  $("#listeningWordQueue").innerHTML = queue.length ? queue.slice(0, 5).map((item) => `
    <div class="listening-word-item">
      <div><strong>${escapeHtml(item.word)}</strong><small>${escapeHtml(item.sourceTitle || "听写材料")} · 漏听 ${Number(item.misses) || 1} 次</small></div>
      <button type="button" data-listening-speak="${escapeHtml(item.word)}">▶ 听音</button>
      <button type="button" data-listening-review="${escapeHtml(item.word)}" data-heard="false">没听出</button>
      <button type="button" data-listening-review="${escapeHtml(item.word)}" data-heard="true">听出了</button>
    </div>`).join("") : `<p class="empty-queue">当前没有到期听力词。完成逐句听写后，漏词会自动加入。</p>`;
}

function renderDictation() {
  const sentences = dictationState.sentences;
  const hasSentence = sentences.length > 0;
  const index = Math.max(0, Math.min(dictationState.index, Math.max(0, sentences.length - 1)));
  dictationState.index = index;
  $("#dictationPosition").textContent = hasSentence ? `${index + 1} / ${sentences.length}` : "— / —";
  $("#dictationPrev").disabled = !hasSentence || index === 0;
  $("#dictationNext").disabled = !hasSentence || index >= sentences.length - 1;
  $("#dictationInput").disabled = !hasSentence;
  $("#dictationCheck").disabled = !hasSentence;
  $("#dictationReveal").disabled = !hasSentence;
  $("#dictationHint").textContent = hasSentence
    ? "先盲听并用 A–B 循环定位当前句；检查后，漏掉的关键词会进入听力 SRS。"
    : "这篇材料没有可拆分的原文；请导入带原文的音频。";
  const result = $("#dictationResult");
  if (!dictationState.result) {
    result.hidden = true;
    result.innerHTML = "";
  } else {
    result.hidden = false;
    result.innerHTML = dictationState.result;
  }
}

function moveDictation(direction) {
  if (!dictationState.sentences.length) return;
  dictationState.index = Math.max(0, Math.min(dictationState.sentences.length - 1, dictationState.index + direction));
  dictationState.result = null;
  $("#dictationInput").value = "";
  if (currentTrack) {
    state.listeningProgress[currentTrack.id] = { ...(state.listeningProgress[currentTrack.id] || {}), sentenceIndex: dictationState.index, updatedAt: new Date().toISOString() };
    saveState();
  }
  renderDictation();
  $("#dictationInput").focus();
}

function checkDictation(reveal = false) {
  const target = dictationState.sentences[dictationState.index];
  if (!target) return;
  const attempt = $("#dictationInput").value.trim();
  if (!attempt && !reveal) return toast("先输入你听到的句子");
  const match = scoreTextMatch(target, attempt);
  if (!reveal) {
    addMissedListeningWords(match.missed);
    if (currentTrack) state.listeningProgress[currentTrack.id] = { ...(state.listeningProgress[currentTrack.id] || {}), sentenceIndex: dictationState.index, lastScore: match.score, checked: (Number(state.listeningProgress[currentTrack.id]?.checked) || 0) + 1, updatedAt: new Date().toISOString() };
    saveState();
    renderListeningWordQueue();
  }
  dictationState.result = `<div class="dictation-score"><strong>${reveal ? "参考答案" : `${match.score} 分`}</strong><span>${reveal ? "先听后看效果更好" : match.score >= 85 ? "听得很完整" : match.score >= 60 ? "还有几个词需要再听" : "建议慢速循环这一句"}</span></div>${attempt ? `<p><b>你的听写</b>${escapeHtml(attempt)}</p>` : ""}<p><b>原句</b>${escapeHtml(target)}</p>${!reveal && match.missed.length ? `<p><b>可能漏词</b>${escapeHtml([...new Set(match.missed)].join(" · "))}</p>` : ""}`;
  renderDictation();
}

function renderTrackList() {
  const list = $("#trackList");
  if (!listeningTracks.length) {
    list.innerHTML = `<div class="track-item"><strong>还没有听力材料</strong><small>导入本地音频后即可开始</small></div>`;
    return;
  }
  list.innerHTML = listeningTracks.map((track, index) => {
    const complete = state.completedListening.some((entry) => entry.trackId === track.id);
    const type = track.materialType === "exam" ? "· 四级真题" : "";
    return `<button class="track-item ${currentTrack?.id === track.id ? "active" : ""}" type="button" data-track-id="${escapeHtml(track.id)}"><span class="track-number">${String(index + 1).padStart(2, "0")} ${complete ? "· 已完成" : ""} ${type}</span><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.duration || (track.local ? "本地材料" : "短篇精听"))}</small></button>`;
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
  const sentences = splitTranscriptSentences(track.transcript);
  const savedIndex = Math.max(0, Math.min(Number(state.listeningProgress[track.id]?.sentenceIndex) || 0, Math.max(0, sentences.length - 1)));
  dictationState = { sentences, index: savedIndex, result: null };
  $("#dictationInput").value = "";
  renderDictation();
  renderListeningWordQueue();
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
    materialType: $("#importTrackType").value === "exam" ? "exam" : "practice",
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

function closeAudioImportDialog() {
  const dialog = $("#audioImportDialog");
  if (!dialog?.open) return;
  dialog.close("cancel");
  $("#audioImportForm").reset();
}

function freshSpeakingSession() {
  return {
    active: false,
    completed: false,
    startedAt: null,
    phaseIndex: 0,
    phaseElapsed: 0,
    totalActiveSeconds: 0,
    interval: null,
    hintTimer: null,
    hintAvailable: false,
    hintLevel: 0,
    currentTask: null,
    turns: [],
    errors: [],
    latestAnswer: "",
    latestFeedback: [],
    latestReply: "",
    latestTranslation: "",
    translationVisible: false,
    pending: false,
    status: "idle",
    statusMessage: "计时只统计有效练习；AI 生成回答时会自动暂停。",
    translationIndex: 0,
    conversationTurns: 0,
    retryTarget: "",
    retrying: false,
    mediaRecorder: null,
    mediaStream: null,
    mediaChunks: [],
    recognition: null,
    stopTimer: null,
    abortRecording: false,
    shadowSentence: "",
    shadowAttempts: [],
    referenceAudio: null,
    referenceObjectUrl: null
  };
}

function speakingPhase() {
  return SPEAKING_PHASES[speakingSession.phaseIndex] || SPEAKING_PHASES.at(-1);
}

function speakingWarmupTask() {
  const scenario = AI_SCENARIOS[state.ai.scenario] || AI_SCENARIOS.campus;
  const hints = {
    campus: ["daily routine · enjoy · because", "One part of my school day that I enjoy is ... because ...", "One part of my school day that I enjoy is studying in the library because it is quiet and helps me focus."],
    travel: ["would like to · travel by · because", "I would like to go to ... and I would travel there by ...", "I would like to visit Hangzhou and travel there by high-speed train because it is convenient."],
    interview: ["I am · one strength · for example", "One of my strengths is ... For example, ...", "One of my strengths is patience. For example, I stay calm when a team needs time to solve a problem."],
    technology: ["has helped me · save time · learn", "The change that has helped me most is ... because ...", "Online learning tools have helped me most because they let me review difficult points at my own pace."],
    free: ["today · would like to talk about · because", "Today, I would like to talk about ... because ...", "Today, I would like to talk about music because it helps me relax after studying."]
  };
  return { prompt: scenario.opening, keywords: hints[state.ai.scenario][0], skeleton: hints[state.ai.scenario][1], model: hints[state.ai.scenario][2] };
}

function speakingScenarioTask(prompt = "") {
  const scenario = AI_SCENARIOS[state.ai.scenario] || AI_SCENARIOS.campus;
  return {
    prompt: prompt || scenario.opening,
    keywords: "opinion · reason · example",
    skeleton: "I think ... because ... For example, ...",
    model: "I think this is useful because it makes daily life easier. For example, it can help students save time and focus on important tasks."
  };
}

function speakingTranslationTask() {
  const offset = Number(state.ai.speakingSessions?.length || 0) % SPEAKING_TRANSLATION_TASKS.length;
  return SPEAKING_TRANSLATION_TASKS[(offset + speakingSession.translationIndex) % SPEAKING_TRANSLATION_TASKS.length];
}

function pickSpeakingShadowSentence() {
  const corrected = speakingSession.errors.find((item) => item?.correction)?.correction;
  if (corrected) return corrected;
  const reply = String(speakingSession.latestReply || "").trim();
  const firstSentence = reply.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  return firstSentence || reply || "I can express my ideas clearly when I give myself time to think.";
}

function clearSpeakingHintTimer() {
  clearTimeout(speakingSession.hintTimer);
  speakingSession.hintTimer = null;
}

function armSpeakingHints() {
  clearSpeakingHintTimer();
  speakingSession.hintAvailable = false;
  speakingSession.hintLevel = 0;
  const phase = speakingPhase()?.id;
  if (!["warmup", "translation", "scenario"].includes(phase)) return;
  speakingSession.hintTimer = window.setTimeout(() => {
    if (!speakingSession.active || speakingSession.pending) return;
    speakingSession.hintAvailable = true;
    renderSpeakingSession();
  }, 8000);
}

function setSpeakingTaskForPhase() {
  const phase = speakingPhase();
  speakingSession.latestAnswer = "";
  speakingSession.latestFeedback = [];
  speakingSession.latestTranslation = "";
  speakingSession.translationVisible = false;
  speakingSession.retryTarget = "";
  speakingSession.retrying = false;
  if (phase.id === "warmup") speakingSession.currentTask = speakingWarmupTask();
  if (phase.id === "translation") speakingSession.currentTask = speakingTranslationTask();
  if (phase.id === "scenario") speakingSession.currentTask = speakingScenarioTask();
  if (phase.id === "shadowing") {
    speakingSession.shadowSentence = pickSpeakingShadowSentence();
    speakingSession.currentTask = { prompt: speakingSession.shadowSentence, keywords: "", skeleton: "", model: speakingSession.shadowSentence };
  }
  if (phase.id === "recap") speakingSession.currentTask = { prompt: "今天的有效练习已经完成。看看哪些表达正在变得更自然。", keywords: "", skeleton: "", model: "" };
  armSpeakingHints();
}

function startSpeakingClock() {
  clearInterval(speakingSession.interval);
  speakingSession.interval = window.setInterval(() => {
    if (!speakingSession.active || speakingSession.pending || speakingSession.status === "processing") return;
    speakingSession.totalActiveSeconds += 1;
    speakingSession.phaseElapsed += 1;
    const phase = speakingPhase();
    if (speakingSession.phaseElapsed >= phase.seconds && speakingSession.status !== "recording") advanceSpeakingPhase();
    else renderSpeakingSession();
  }, 1000);
}

function stopSpeakingResources(abort = true) {
  clearTimeout(speakingSession.stopTimer);
  speakingSession.stopTimer = null;
  if (speakingSession.mediaRecorder) {
    speakingSession.abortRecording = abort;
    try { if (speakingSession.mediaRecorder.state !== "inactive") speakingSession.mediaRecorder.stop(); } catch {}
  }
  const recognition = speakingSession.recognition;
  speakingSession.recognition = null;
  try { abort ? recognition?.abort() : recognition?.stop(); } catch {}
  speakingSession.mediaStream?.getTracks().forEach((track) => track.stop());
  speakingSession.mediaRecorder = null;
  speakingSession.mediaStream = null;
  speakingSession.mediaChunks = [];
  if (speakingSession.referenceAudio) {
    speakingSession.referenceAudio.pause();
    speakingSession.referenceAudio.src = "";
  }
  if (speakingSession.referenceObjectUrl) URL.revokeObjectURL(speakingSession.referenceObjectUrl);
  speakingSession.referenceAudio = null;
  speakingSession.referenceObjectUrl = null;
}

function startSpeakingSession() {
  if (speakingSession.active) return;
  if (aiServiceStatus !== "ready") return toast("AI 尚未就绪", "请先在设置中配置手机 AI，或启动电脑本机服务。" );
  stopSpeakingResources();
  clearInterval(speakingSession.interval);
  speakingSession = freshSpeakingSession();
  speakingSession.active = true;
  speakingSession.startedAt = new Date().toISOString();
  speakingSession.status = "ready";
  speakingSession.statusMessage = "先听懂问题，再直接用英语回答；想不起来时，8 秒后可以逐级查看提示。";
  setSpeakingTaskForPhase();
  startSpeakingClock();
  renderSpeakingSession();
}

function advanceSpeakingPhase() {
  if (!speakingSession.active || speakingSession.pending) return;
  stopSpeakingResources();
  clearSpeakingHintTimer();
  if (speakingSession.phaseIndex >= SPEAKING_PHASES.length - 1) return finishSpeakingSession();
  speakingSession.phaseIndex += 1;
  speakingSession.phaseElapsed = 0;
  speakingSession.status = "ready";
  speakingSession.statusMessage = speakingPhase().id === "shadowing"
    ? "先听标准句，再跟读；最多三次，保留最好成绩。"
    : speakingPhase().id === "recap" ? "复盘只保留今天最值得改的一点。" : "准备好了就直接回答。";
  setSpeakingTaskForPhase();
  renderSpeakingSession();
}

function finishSpeakingSession() {
  if (!speakingSession.active && speakingSession.completed) return;
  stopSpeakingResources();
  clearSpeakingHintTimer();
  clearInterval(speakingSession.interval);
  speakingSession.interval = null;
  speakingSession.active = false;
  speakingSession.completed = true;
  speakingSession.phaseIndex = SPEAKING_PHASES.length - 1;
  speakingSession.currentTask = { prompt: "今天的有效练习已经完成。看看哪些表达正在变得更自然。", keywords: "", skeleton: "", model: "" };
  const bestShadow = Math.max(0, ...speakingSession.shadowAttempts.map((item) => Number(item.score) || 0));
  state.ai.speakingSessions ||= [];
  state.ai.speakingSessions.unshift({
    startedAt: speakingSession.startedAt,
    completedAt: new Date().toISOString(),
    activeSeconds: speakingSession.totalActiveSeconds,
    turns: speakingSession.turns.length,
    errors: speakingSession.errors.slice(0, 8),
    bestShadow,
    scenario: state.ai.scenario
  });
  state.ai.speakingSessions = state.ai.speakingSessions.slice(0, 30);
  saveState();
  speakingSession.statusMessage = "训练记录已保存；下次会继续优先练习反复出现的错误。";
  renderSpeakingSession();
}

function revealSpeakingHint() {
  if (!speakingSession.active || !speakingSession.currentTask) return;
  speakingSession.hintLevel = Math.min(3, speakingSession.hintLevel + 1);
  speakingSession.hintAvailable = true;
  renderSpeakingSession();
}

function formatSpeakingTime(seconds) {
  const safe = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function speakingRemainingSeconds() {
  if (speakingSession.completed) return 0;
  return SPEAKING_PHASES.slice(speakingSession.phaseIndex + 1).reduce((total, phase) => total + phase.seconds, 0)
    + Math.max(0, speakingPhase().seconds - speakingSession.phaseElapsed);
}

function renderSpeakingHints() {
  const container = $("#speakingHints");
  const task = speakingSession.currentTask;
  if (!task || !speakingSession.hintLevel) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }
  const rows = [];
  if (speakingSession.hintLevel >= 1) rows.push(`<p><b>关键词：</b>${escapeHtml(task.keywords || "opinion · reason · example")}</p>`);
  if (speakingSession.hintLevel >= 2) rows.push(`<p><b>句型骨架：</b>${escapeHtml(task.skeleton || "I think ... because ...")}</p>`);
  if (speakingSession.hintLevel >= 3) rows.push(`<p><b>参考表达：</b>${escapeHtml(task.model || "Try to give your opinion, one reason, and one example.")}</p>`);
  container.innerHTML = rows.join("");
  container.hidden = false;
}

function renderSpeakingFeedback() {
  const answer = $("#speakingAnswer");
  if (speakingPhase().id === "recap") {
    const bestShadow = Math.max(0, ...speakingSession.shadowAttempts.map((item) => Number(item.score) || 0));
    const repeated = speakingSession.errors.slice(-3);
    answer.hidden = false;
    answer.innerHTML = `<p><b>有效练习：</b>${formatSpeakingTime(speakingSession.totalActiveSeconds)} · ${speakingSession.turns.length} 次表达 · 最佳跟读 ${bestShadow || "—"}</p>`;
    const recap = $("#speakingFeedback");
    recap.hidden = false;
    recap.innerHTML = repeated.length
      ? `<p><b>今天优先记住：</b></p>${repeated.map((item) => `<article><strong>${escapeHtml(item.reason || "让表达更自然")}</strong><p>${escapeHtml(item.correction || item.original || "")}</p></article>`).join("")}`
      : `<p><b>今天优先记住：</b>先完整说出意思，再慢慢追求更自然的句型。今天没有需要反复弹出的关键错误。</p>`;
    return;
  }
  answer.hidden = !speakingSession.latestAnswer;
  answer.innerHTML = speakingSession.latestAnswer ? `<p><b>你的表达：</b>${escapeHtml(speakingSession.latestAnswer)}</p>` : "";
  const feedback = $("#speakingFeedback");
  const items = meaningfulAIFeedback(speakingSession.latestFeedback).slice(0, 2);
  const reply = String(speakingSession.latestReply || "").trim();
  feedback.hidden = !items.length && !reply;
  feedback.innerHTML = `${reply ? `<p><b>AI 回应：</b>${escapeHtml(reply)}</p>${speakingSession.latestTranslation ? `<button class="ai-translation-toggle" type="button" data-speaking-translation aria-expanded="${speakingSession.translationVisible}">${speakingSession.translationVisible ? "隐藏翻译" : "显示翻译"}</button>${speakingSession.translationVisible ? `<p><b>中文：</b>${escapeHtml(speakingSession.latestTranslation)}</p>` : ""}` : ""}` : ""}${items.map((item) => `<article><strong>只改这一处</strong><p><b>${escapeHtml(item.original || "原句")}</b> → ${escapeHtml(item.correction || "")}</p><p>${escapeHtml(item.reason || "")}</p></article>`).join("")}`;
}

function renderSpeakingShadowing() {
  const container = $("#speakingShadowResult");
  if (speakingPhase().id !== "shadowing") {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }
  const best = [...speakingSession.shadowAttempts].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  container.hidden = false;
  container.innerHTML = `
    <p><b>目标句：</b>${escapeHtml(speakingSession.shadowSentence)}</p>
    <div class="speaking-shadow-actions"><button type="button" data-speaking-play="1">▶ 正常语速</button><button type="button" data-speaking-play="0.8">▶ 0.8 倍</button><button type="button" data-speaking-play="chunk">▶ 意群播放</button></div>
    ${best ? `<div class="score"><strong>${best.score}</strong><span>基础跟读分 · 最好成绩</span></div><p>内容 ${best.textScore ?? "—"} · 节奏 ${best.rhythmScore ?? "—"} · 尝试 ${speakingSession.shadowAttempts.length}/3</p>` : `<p>尚未跟读；这里不会把普通语音识别冒充音素评分。</p>`}`;
}

function renderSpeakingSession() {
  const panel = $("#aiSpeakingPanel");
  if (!panel) return;
  const phase = speakingPhase();
  $("#speakingPhaseTitle").textContent = speakingSession.active || speakingSession.completed ? phase.label : "15 分钟英语思维训练";
  $("#speakingPhaseGoal").textContent = speakingSession.active || speakingSession.completed
    ? ({ warmup: "先用简单英语进入状态。", translation: "从意思出发组织英语，不逐字硬译。", scenario: "表达观点、理由和例子，完成六轮交流。", shadowing: "跟读今天最值得掌握的一句。", recap: "只记住今天最值得改的一点。" }[phase.id])
    : "热身、中译英、情景对话、针对性跟读和复盘一次完成。";
  const clock = $("#speakingClock");
  clock.querySelector("strong").textContent = formatSpeakingTime(speakingRemainingSeconds());
  clock.classList.toggle("paused", speakingSession.pending || speakingSession.status === "processing");
  $("#speakingPhaseTrack").innerHTML = SPEAKING_PHASES.map((item, index) => `<div class="speaking-phase-step ${index === speakingSession.phaseIndex && (speakingSession.active || speakingSession.completed) ? "active" : ""} ${index < speakingSession.phaseIndex || speakingSession.completed ? "complete" : ""}"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.short)}</small></div>`).join("");
  $("#speakingTaskKind").textContent = speakingSession.active || speakingSession.completed ? phase.kind : "READY";
  $("#speakingTurnProgress").textContent = phase.id === "scenario" ? `${speakingSession.conversationTurns}/6 轮` : phase.id === "translation" ? `${Math.min(3, speakingSession.translationIndex + 1)}/3 句` : speakingSession.active ? `${formatSpeakingTime(speakingSession.phaseElapsed)} 本阶段` : "尚未开始";
  $("#speakingPrompt").textContent = speakingSession.currentTask?.prompt || "点击开始后，系统会先用简单英语帮你进入状态。";
  renderSpeakingHints();
  renderSpeakingFeedback();
  renderSpeakingShadowing();
  const start = $("#speakingStart");
  start.hidden = speakingSession.active;
  start.textContent = speakingSession.completed ? "再练一次" : "开始 15 分钟训练";
  const record = $("#speakingRecord");
  const answerPhase = ["warmup", "translation", "scenario"].includes(phase.id);
  const shadowPhase = phase.id === "shadowing";
  record.hidden = !speakingSession.active || (!answerPhase && !shadowPhase) || speakingSession.pending || speakingSession.shadowAttempts.length >= 3;
  record.classList.toggle("speaking-recording", speakingSession.status === "recording");
  record.textContent = speakingSession.status === "recording" ? "■ 说完了，停止录音" : shadowPhase ? `◉ 开始跟读（${speakingSession.shadowAttempts.length + 1}/3）` : speakingSession.retrying ? "◉ 重说修正句" : "◉ 按下开始回答";
  const hint = $("#speakingHint");
  hint.hidden = !speakingSession.active || !answerPhase || !speakingSession.hintAvailable || speakingSession.pending || speakingSession.hintLevel >= 3;
  hint.textContent = speakingSession.hintLevel === 0 ? "需要一点提示" : speakingSession.hintLevel === 1 ? "显示句型骨架" : "显示参考表达";
  $("#speakingNext").hidden = !speakingSession.active || speakingSession.pending || phase.id === "recap";
  const finish = $("#speakingFinish");
  finish.hidden = !speakingSession.active;
  finish.textContent = phase.id === "recap" ? "完成并保存" : "提前结束";
  $("#speakingTypeForm").hidden = !speakingSession.active || !answerPhase || speakingSession.pending;
  $("#speakingTypeInput").disabled = speakingSession.status === "recording";
  $("#speakingStatus").textContent = speakingSession.pending ? "AI 正在回应并检查关键错误，计时已暂停。" : speakingSession.statusMessage;
}

function ensureAIState() {
  if (!state.ai || typeof state.ai !== "object") state.ai = defaultAIState();
  if (!AI_SCENARIOS[state.ai.scenario]) state.ai.scenario = "campus";
  if (!["speaking", "text", "voice", "writing"].includes(state.ai.mode)) state.ai.mode = "text";
  if (!state.ai.sessions || typeof state.ai.sessions !== "object" || Array.isArray(state.ai.sessions)) state.ai.sessions = {};
  if (!Array.isArray(state.ai.writingReviews)) state.ai.writingReviews = [];
  if (!Array.isArray(state.ai.speakingSessions)) state.ai.speakingSessions = [];
}

function currentAISession() {
  ensureAIState();
  const scenario = state.ai.scenario;
  if (!Array.isArray(state.ai.sessions[scenario]) || state.ai.sessions[scenario].length === 0) {
    state.ai.sessions[scenario] = [{
      role: "assistant",
      content: AI_SCENARIOS[scenario].opening,
      translation: AI_SCENARIOS[scenario].openingTranslation,
      feedback: [],
      vocabulary: [],
      createdAt: new Date().toISOString()
    }];
    saveState();
  }
  const opening = state.ai.sessions[scenario][0];
  if (opening?.role === "assistant" && opening.content === AI_SCENARIOS[scenario].opening && !opening.translation) {
    opening.translation = AI_SCENARIOS[scenario].openingTranslation;
    saveState();
  }
  return state.ai.sessions[scenario];
}

function renderAIFeedback(feedback = []) {
  const items = meaningfulAIFeedback(feedback).slice(0, 8);
  if (!items.length) return "";
  return `<div class="ai-feedback"><div class="ai-feedback-heading">逐句纠错</div>${items.map((item) => `
    <div class="ai-feedback-card">
      ${item.original ? `<p><span>原句</span><del>${escapeHtml(item.original)}</del></p>` : ""}
      <p><span>修正</span><strong>${escapeHtml(item.correction || "")}</strong></p>
      <p><span>原因</span>${escapeHtml(item.reason || "")}</p>
    </div>`).join("")}</div>`;
}

function meaningfulAIFeedback(feedback = []) {
  if (!Array.isArray(feedback)) return [];
  return feedback.filter((item) => {
    const original = String(item?.original || "").trim().replace(/\s+/g, " ").toLowerCase();
    const correction = String(item?.correction || "").trim().replace(/\s+/g, " ").toLowerCase();
    const reason = String(item?.reason || "").trim().toLowerCase();
    const unchanged = original && correction && original === correction;
    const saysCorrect = /无需修改|表达自然|没有(?:语法)?错误|无(?:需)?纠正|already (?:correct|natural)|no (?:change|correction|error)/i.test(reason);
    return !(unchanged || saysCorrect);
  });
}

function renderShadowingResult(message, index) {
  const active = shadowingState.messageIndex === index && shadowingState.status !== "idle";
  if (active && ["starting", "recording", "processing"].includes(shadowingState.status)) {
    const label = shadowingState.status === "recording" ? "正在录音，说完后点停止…" : shadowingState.status === "processing" ? "正在识别并评分…" : "正在启动麦克风…";
    return `<div class="shadowing-result pending">${escapeHtml(label)}</div>`;
  }
  if (active && shadowingState.error) return `<div class="shadowing-result error">${escapeHtml(shadowingState.error)}</div>`;
  const result = active && shadowingState.status === "complete" ? shadowingState : message?.shadowing;
  if (!result) return "";
  const basic = result.basic === true || !Number.isFinite(result.soundScore);
  const note = basic
    ? "基础评分：内容根据语音识别结果判断，节奏根据录音语速和连续性估算；不包含标准音色对比。"
    : "完整声音评分：综合比较识别文字、声音频谱、时长与能量节奏；仍不等同于专业逐音素测评。";
  return `<div class="shadowing-result"><div><strong>${Number(result.score) || 0}</strong><span>${basic ? "基础跟读分" : "综合跟读分"}</span></div><div class="shadowing-score-parts"><span>内容 ${Number.isFinite(result.textScore) ? result.textScore : "—"}</span><span>发音相似度 ${Number.isFinite(result.soundScore) ? result.soundScore : "—"}</span><span>节奏 ${Number.isFinite(result.rhythmScore) ? result.rhythmScore : "—"}</span></div><p><b>识别到：</b>${escapeHtml(result.recognized || "未识别到文字")}</p><p><b>建议：</b>${escapeHtml(pronunciationAdvice({ ...result, basic }))}</p><small>${note}</small></div>`;
}

function renderWritingReview() {
  const panel = $("#aiWritingResult");
  if (!panel) return;
  const review = state.ai.writingReviews[0];
  if (!review) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }
  const corrections = Array.isArray(review.corrections) ? review.corrections.slice(0, 12) : [];
  panel.hidden = false;
  panel.innerHTML = `
    <div class="writing-score"><strong>${Math.max(0, Math.min(100, Number(review.score) || 0))}</strong><span>参考分 / 100</span><p>${escapeHtml(review.summary || "")}</p></div>
    <section><h3>修改稿</h3><div class="corrected-writing">${escapeHtml(review.corrected || "")}</div></section>
    ${corrections.length ? `<section><h3>逐项修改</h3><div class="writing-corrections">${corrections.map((item) => `<div><p><span>原文</span>${escapeHtml(item.original || "")}</p><p><span>修改</span>${escapeHtml(item.correction || "")}</p><p><span>原因</span>${escapeHtml(item.reason || "")}</p></div>`).join("")}</div></section>` : ""}
    ${Array.isArray(review.strengths) && review.strengths.length ? `<section><h3>做得好的地方</h3><ul>${review.strengths.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}
    ${Array.isArray(review.advice) && review.advice.length ? `<section><h3>下一步</h3><ul>${review.advice.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}`;
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

function aiTranslationKey(message, index) {
  return `${state.ai.scenario}:${message?.createdAt || index}`;
}

function renderAITranslation(message, index) {
  const translation = String(message?.translation || "").trim();
  if (!translation) return "";
  const expanded = visibleAITranslations.has(aiTranslationKey(message, index));
  return `<div class="ai-translation"${expanded ? "" : " hidden"}><span>中文翻译</span><p>${escapeHtml(translation)}</p></div>`;
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
  $("#aiWritingPanel").hidden = state.ai.mode !== "writing";
  $("#aiSpeakingPanel").hidden = state.ai.mode !== "speaking";
  $("#aiReset").hidden = ["writing", "speaking"].includes(state.ai.mode);

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
        ${message.role === "assistant" ? `<button class="ai-message-speak" type="button" data-ai-speak-index="${index}" aria-label="朗读这条 AI 回复" aria-pressed="${aiTextSpeech.messageIndex === index ? "true" : "false"}">${aiTextSpeech.messageIndex === index ? "■ 停止" : "▶ 朗读"}</button><button class="ai-message-speak" type="button" data-ai-shadow-index="${index}">${shadowingState.messageIndex === index && shadowingState.status === "recording" ? "■ 停止跟读" : "◉ 跟读"}</button>` : ""}
        ${message.role === "assistant" && message.translation ? `<button class="ai-translation-toggle" type="button" data-ai-translation-index="${index}" aria-expanded="${visibleAITranslations.has(aiTranslationKey(message, index))}">${visibleAITranslations.has(aiTranslationKey(message, index)) ? "隐藏翻译" : "显示翻译"}</button>` : ""}
      </div>
      <div class="ai-bubble">${escapeHtml(message.content || "")}</div>
      ${message.role === "assistant" ? renderAITranslation(message, index) + renderShadowingResult(message, index) + renderAIFeedback(message.feedback) + renderAIVocabulary(message.vocabulary) : ""}
    </div>`).join("") + (aiPending ? `
    <div class="ai-message assistant latest" aria-label="AI 正在回复">
      <div class="ai-message-label-row"><div class="ai-message-label">AI TUTOR</div></div>
      <div class="ai-bubble ai-typing"><i></i><i></i><i></i></div>
    </div>` : "");
  $("#aiSend").disabled = aiPending;
  $("#aiInput").disabled = aiPending;
  renderAITextSpeechButtons();
  renderTextDictation();
  renderVoiceUI();
  renderSpeakingSession();
  renderWritingReview();
  requestAnimationFrame(() => { $("#aiMessages").scrollTop = $("#aiMessages").scrollHeight; });
}

function selectAIScenario(scenario) {
  if (!AI_SCENARIOS[scenario] || aiPending) return;
  if (isVoiceActive()) return toast("请先结束语音对话", "结束后再切换练习情景。" );
  if (speakingSession.active) return toast("请先结束 15 分钟口语训练", "训练结束后再切换练习情景。" );
  stopShadowing(true, false);
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
  stopShadowing(true, false);
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

function isSpeakingActive() {
  return speakingSession.active;
}

function renderVoiceUI() {
  const stage = $("#aiVoiceStage");
  if (!stage) return;
  const labels = {
    idle: [voiceSession.statusMessage, voiceSession.hintMessage],
    connecting: ["正在启动语音练习…", voiceSession.doubao ? "正在建立豆包实时语音连接；首次使用时请允许麦克风。" : "首次使用时，请允许浏览器访问麦克风。"],
    listening: ["正在听你说…", voiceSession.doubao ? "豆包会自动判断你何时说完，也支持在 AI 回答时直接打断。" : voiceSession.mediaRecorder ? "说完后点击“发送这句”，最长可录 20 秒。" : "说完一句后停顿一下，AI 会开始回答。"],
    processing: ["正在识别你的语音…", "录音已完成，请稍等片刻。"],
    thinking: ["AI 正在思考…", "在线回答可能需要等待十几秒。"],
    speaking: ["AI 正在朗读回答…", "朗读结束后会自动继续听你说。"],
    error: [voiceSession.statusMessage, voiceSession.hintMessage]
  };
  const [status, hint] = labels[voiceSession.state] || labels.idle;
  stage.dataset.state = voiceSession.state;
  $("#aiVoiceStatus").textContent = status;
  $("#aiVoiceHint").textContent = hint;
  $("#aiVoiceTranscript p").textContent = voiceSession.transcript || "开始后，这里会显示识别到的话和 AI 的英文回复。";
  const messages = currentAISession();
  const latestIndex = messages.findLastIndex((message) => message.role === "assistant" && message.translation);
  const latest = latestIndex >= 0 ? messages[latestIndex] : null;
  const translationButton = $("#aiVoiceTranslationToggle");
  const translationText = $("#aiVoiceTranslation");
  const canTranslate = Boolean(latest?.translation);
  const expanded = canTranslate && visibleAITranslations.has(aiTranslationKey(latest, latestIndex));
  translationButton.hidden = !canTranslate;
  translationButton.textContent = expanded ? "隐藏 AI 回答翻译" : "显示 AI 回答翻译";
  translationButton.setAttribute("aria-expanded", String(expanded));
  translationButton.dataset.aiTranslationIndex = canTranslate ? String(latestIndex) : "";
  translationText.hidden = !expanded;
  translationText.textContent = expanded ? latest.translation : "";
  const toggle = $("#aiVoiceToggle");
  const active = isVoiceActive();
  const cloudRecording = active && !voiceSession.doubao && voiceSession.state === "listening" && Boolean(voiceSession.mediaRecorder);
  toggle.textContent = cloudRecording ? "发送这句" : active ? "结束语音练习" : "开始语音练习";
  toggle.classList.toggle("live", active);
  toggle.disabled = ["connecting", "processing", "thinking"].includes(voiceSession.state);
  const endButton = $("#aiVoiceEnd");
  if (endButton) endButton.hidden = !active;
}

function closeVoiceResources() {
  clearTimeout(voiceSession.restartTimer);
  clearTimeout(voiceSession.stopTimer);
  voiceSession.restartTimer = null;
  voiceSession.stopTimer = null;
  if (voiceSession.mediaRecorder) {
    voiceSession.abortRecording = true;
    try { if (voiceSession.mediaRecorder.state !== "inactive") voiceSession.mediaRecorder.stop(); } catch {}
  }
  voiceSession.mediaStream?.getTracks().forEach((track) => track.stop());
  voiceSession.mediaRecorder = null;
  voiceSession.mediaStream = null;
  voiceSession.mediaChunks = [];
  const recognition = voiceSession.recognition;
  voiceSession.recognition = null;
  try { recognition?.abort(); } catch {}
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (voiceSession.audio) {
    voiceSession.audio.pause();
    voiceSession.audio.src = "";
  }
  if (voiceSession.objectUrl) URL.revokeObjectURL(voiceSession.objectUrl);
  voiceSession.utterance = null;
  voiceSession.audio = null;
  voiceSession.objectUrl = null;
  const doubao = voiceSession.doubao;
  voiceSession.doubao = null;
  voiceSession.doubaoUserText = "";
  voiceSession.doubaoReplyText = "";
  voiceSession.doubaoTurnSaved = false;
  try { doubao?.close(); } catch {}
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
  if (!["speaking", "text", "voice", "writing"].includes(mode) || state.ai.mode === mode) return;
  if (speakingSession.active && mode !== "speaking") return toast("请先结束 15 分钟口语训练", "训练计时正在进行。" );
  if (mode !== "voice" && isVoiceActive()) stopVoiceImmediately();
  stopShadowing(true, false);
  if (["voice", "speaking"].includes(mode)) {
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
  button.disabled = aiPending || textDictation.starting || textDictation.processing || state.ai.mode !== "text";
  button.classList.toggle("listening", textDictation.listening);
  button.setAttribute("aria-pressed", String(textDictation.listening));
  button.textContent = textDictation.starting
    ? "正在启动…"
    : textDictation.processing
    ? "正在识别…"
    : textDictation.listening ? textDictation.mode === "cloud" ? "结束录音" : "停止听写" : "语音输入";
  const status = $("#aiDictationStatus");
  if (!status) return;
  status.textContent = textDictation.starting
    ? textDictation.statusMessage || "正在请求麦克风权限…"
    : textDictation.processing
    ? "正在把录音转换成文字，请稍等…"
    : textDictation.listening
      ? textDictation.mode === "cloud" ? "正在录音；说完后点“结束录音”，最长 20 秒。" : "正在听你说；说完后停顿一下。"
      : textDictation.statusMessage || "语音输入只会填入文字，不会自动发送。Enter 发送 · Shift + Enter 换行。";
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
  clearTimeout(textDictation.stopTimer);
  textDictation.stopTimer = null;
  if (textDictation.mediaRecorder) {
    const recorder = textDictation.mediaRecorder;
    textDictation.abortRecording = abort;
    textDictation.listening = false;
    renderTextDictation();
    try {
      if (recorder.state !== "inactive") recorder.stop();
    } catch {}
    return;
  }
  const recognition = textDictation.recognition;
  textDictation.recognition = null;
  textDictation.listening = false;
  textDictation.mode = null;
  renderTextDictation();
  if (!recognition) return;
  try {
    if (abort) recognition.abort();
    else recognition.stop();
  } catch {
    // The browser may have already ended the recognition session.
  }
}

function encodeMonoWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeAscii = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

async function convertRecordingToWav(blob) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("当前浏览器无法处理录音格式，请换用最新版 Chrome。" );
  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData((await blob.arrayBuffer()).slice(0));
    const targetRate = 16000;
    const source = decoded.getChannelData(0);
    const ratio = decoded.sampleRate / targetRate;
    const output = new Float32Array(Math.max(1, Math.floor(source.length / ratio)));
    for (let index = 0; index < output.length; index += 1) {
      const position = index * ratio;
      const before = Math.floor(position);
      const after = Math.min(source.length - 1, before + 1);
      const fraction = position - before;
      output[index] = source[before] * (1 - fraction) + source[after] * fraction;
    }
    return encodeMonoWav(output, targetRate);
  } finally {
    await context.close().catch(() => {});
  }
}

async function decodeAudioSamples(blob) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("当前浏览器无法分析录音。" );
  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData((await blob.arrayBuffer()).slice(0));
    const channels = decoded.numberOfChannels;
    const mono = new Float32Array(decoded.length);
    for (let channel = 0; channel < channels; channel += 1) {
      const data = decoded.getChannelData(channel);
      for (let index = 0; index < data.length; index += 1) mono[index] += data[index] / channels;
    }
    return { samples: mono, sampleRate: decoded.sampleRate };
  } finally {
    await context.close().catch(() => {});
  }
}

function trimVoiceSamples(samples, sampleRate) {
  const windowSize = Math.max(64, Math.floor(sampleRate * 0.02));
  const levels = [];
  let maximum = 0;
  for (let start = 0; start < samples.length; start += windowSize) {
    let sum = 0;
    const end = Math.min(samples.length, start + windowSize);
    for (let index = start; index < end; index += 1) sum += samples[index] * samples[index];
    const rms = Math.sqrt(sum / Math.max(1, end - start));
    levels.push(rms);
    maximum = Math.max(maximum, rms);
  }
  if (maximum < 0.004) throw new Error("录音声音太小，请靠近麦克风再读一次。" );
  const threshold = Math.max(0.004, maximum * 0.12);
  let first = levels.findIndex((level) => level >= threshold);
  let last = levels.length - 1;
  while (last > first && levels[last] < threshold) last -= 1;
  if (first < 0) throw new Error("没有检测到清晰人声。" );
  first = Math.max(0, first - 1);
  last = Math.min(levels.length - 1, last + 1);
  return samples.slice(first * windowSize, Math.min(samples.length, (last + 1) * windowSize));
}

function goertzelPower(samples, start, size, sampleRate, frequency) {
  const coefficient = 2 * Math.cos((2 * Math.PI * frequency) / sampleRate);
  let previous = 0;
  let beforePrevious = 0;
  for (let offset = 0; offset < size; offset += 1) {
    const index = start + offset;
    const sample = (samples[index] || 0) * (0.54 - 0.46 * Math.cos((2 * Math.PI * offset) / Math.max(1, size - 1)));
    const current = sample + coefficient * previous - beforePrevious;
    beforePrevious = previous;
    previous = current;
  }
  return Math.max(1e-10, previous * previous + beforePrevious * beforePrevious - coefficient * previous * beforePrevious);
}

function extractPronunciationFeatures(input, sampleRate) {
  const samples = trimVoiceSamples(input, sampleRate);
  const duration = samples.length / sampleRate;
  const frameSize = Math.max(128, Math.floor(sampleRate * 0.025));
  const naturalHop = Math.max(64, Math.floor(sampleRate * 0.0125));
  const hop = Math.max(naturalHop, Math.ceil(Math.max(1, samples.length - frameSize) / 160));
  const frequencies = [220, 330, 480, 680, 950, 1300, 1750, 2300, 3000, 3900];
  const frames = [];
  for (let start = 0; start + frameSize <= samples.length; start += hop) {
    let sum = 0;
    let crossings = 0;
    for (let offset = 0; offset < frameSize; offset += 1) {
      const value = samples[start + offset];
      sum += value * value;
      if (offset && (value >= 0) !== (samples[start + offset - 1] >= 0)) crossings += 1;
    }
    const rms = Math.sqrt(sum / frameSize);
    const spectrum = frequencies.map((frequency) => Math.log1p(goertzelPower(samples, start, frameSize, sampleRate, frequency)));
    const norm = Math.sqrt(spectrum.reduce((total, value) => total + value * value, 0)) || 1;
    frames.push({ spectrum: spectrum.map((value) => value / norm), energy: Math.log1p(rms * 100), zcr: crossings / frameSize });
  }
  if (frames.length < 2 || duration < 0.12) throw new Error("录音太短，请把目标内容完整读完。" );
  const maxEnergy = Math.max(...frames.map((frame) => frame.energy), 0.001);
  frames.forEach((frame) => { frame.energy /= maxEnergy; });
  return { frames, duration };
}

function dtwAverage(left, right, distance) {
  const rows = left.length;
  const columns = right.length;
  const previous = new Float64Array(columns + 1).fill(Infinity);
  const current = new Float64Array(columns + 1).fill(Infinity);
  previous[0] = 0;
  const band = Math.max(8, Math.ceil(Math.max(rows, columns) * 0.45));
  for (let i = 1; i <= rows; i += 1) {
    current.fill(Infinity);
    const center = Math.round((i / rows) * columns);
    const from = Math.max(1, center - band);
    const to = Math.min(columns, center + band);
    for (let j = from; j <= to; j += 1) current[j] = distance(left[i - 1], right[j - 1]) + Math.min(previous[j], current[j - 1], previous[j - 1]);
    previous.set(current);
  }
  return previous[columns] / Math.max(rows, columns);
}

function scorePronunciationFeatures(learner, reference) {
  const acousticDistance = dtwAverage(learner.frames, reference.frames, (left, right) => {
    const cosine = left.spectrum.reduce((total, value, index) => total + value * right.spectrum[index], 0);
    return Math.max(0, 1 - cosine) * 0.7 + Math.abs(left.energy - right.energy) * 0.18 + Math.min(1, Math.abs(left.zcr - right.zcr) * 8) * 0.12;
  });
  const envelopeDistance = dtwAverage(learner.frames, reference.frames, (left, right) => Math.abs(left.energy - right.energy));
  const durationRatio = Math.min(learner.duration, reference.duration) / Math.max(learner.duration, reference.duration);
  const soundScore = Math.round(Math.max(0, Math.min(100, 104 - acousticDistance * 150)));
  const rhythmScore = Math.round(Math.max(0, Math.min(100, durationRatio * 60 + (1 - Math.min(1, envelopeDistance)) * 40)));
  return { soundScore, rhythmScore, learnerDuration: learner.duration, referenceDuration: reference.duration };
}

async function comparePronunciationAudio(learnerBlob, referenceBlob) {
  const [learnerAudio, referenceAudio] = await Promise.all([decodeAudioSamples(learnerBlob), decodeAudioSamples(referenceBlob)]);
  const learner = extractPronunciationFeatures(learnerAudio.samples, learnerAudio.sampleRate);
  const reference = extractPronunciationFeatures(referenceAudio.samples, referenceAudio.sampleRate);
  return scorePronunciationFeatures(learner, reference);
}

function combinedPronunciationScore({ textScore, soundScore, rhythmScore, sentence = false }) {
  const values = [];
  if (Number.isFinite(textScore)) values.push([textScore, sentence ? 0.45 : 0.3]);
  if (Number.isFinite(soundScore)) values.push([soundScore, sentence ? 0.4 : 0.55]);
  if (Number.isFinite(rhythmScore)) values.push([rhythmScore, 0.15]);
  const totalWeight = values.reduce((total, [, weight]) => total + weight, 0);
  return totalWeight ? Math.round(values.reduce((total, [value, weight]) => total + value * weight, 0) / totalWeight) : 0;
}

function pronunciationAdvice({ textScore, soundScore, rhythmScore, basic = false }) {
  const advice = [];
  if (Number.isFinite(textScore) && textScore < 80) advice.push("读音可能改变了单词或漏读；对照音标逐段慢读。" );
  if (Number.isFinite(soundScore) && soundScore < 70) advice.push("音色轨迹与标准音差异较大，重点检查元音是否饱满、辅音是否到位。" );
  if (Number.isFinite(rhythmScore) && rhythmScore < 70) advice.push(basic ? "语速或停顿不够自然；放慢一点，按意群连续读完。" : "时长或轻重节奏偏差较大，先听标准音，再模仿停连与重音。" );
  return advice[0] || (basic ? "内容和语速整体不错；当前是基础评分，暂未比较标准音色。" : "整体接近标准音，可以尝试用自然语速再读一次。");
}

function scoreStandaloneRhythmFeatures(learner, referenceText) {
  const wordCount = Math.max(1, (String(referenceText || "").match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length);
  const speakingRate = wordCount / Math.max(0.25, learner.duration);
  const idealRate = 2.15;
  const rateScore = Math.max(0, Math.min(100, 100 - Math.abs(Math.log(Math.max(0.2, speakingRate) / idealRate)) * 72));
  const energies = learner.frames.map((frame) => frame.energy);
  const activeRatio = energies.filter((energy) => energy >= 0.16).length / Math.max(1, energies.length);
  const continuityScore = Math.max(0, Math.min(100, 100 - Math.abs(activeRatio - 0.78) * 125));
  return {
    rhythmScore: Math.round(rateScore * 0.72 + continuityScore * 0.28),
    learnerDuration: learner.duration,
    speakingRate: Math.round(speakingRate * 100) / 100
  };
}

async function scoreStandaloneRhythm(learnerBlob, referenceText) {
  const learnerAudio = await decodeAudioSamples(learnerBlob);
  const learner = extractPronunciationFeatures(learnerAudio.samples, learnerAudio.sampleRate);
  return scoreStandaloneRhythmFeatures(learner, referenceText);
}

async function requestCloudTranscription(wavBlob) {
  if (!deviceAIConfig.apiKey) throw new Error("请先在设置中保存智谱 API Key。" );
  const form = new FormData();
  form.append("file", wavBlob, "mogu-voice-input.wav");
  form.append("model", "glm-asr-2512");
  form.append("stream", "false");
  const response = await fetch(ZHIPU_ASR_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${deviceAIConfig.apiKey}` },
    body: form
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if ([401, 403].includes(response.status)) throw new Error("智谱 API Key 无效或没有语音识别权限。" );
    if (response.status === 429) throw new Error("智谱语音识别没有可用额度或资源包，请稍后重试或改用浏览器识别。" );
    throw new Error(data?.error?.message || `语音识别失败（${response.status}）。`);
  }
  const text = String(data?.text || "").trim();
  if (!text) throw new Error("没有识别到清晰语音，请靠近麦克风再试。" );
  return text;
}

function renderPhonemeAssessment(phonemes = []) {
  if (!Array.isArray(phonemes) || !phonemes.length) return "";
  const chips = phonemes.map((item) => {
    const score = Math.max(0, Math.min(100, Number(item?.score) || 0));
    const level = score >= 80 ? "good" : score >= 60 ? "fair" : "weak";
    const alternatives = Array.isArray(item?.alternatives) && item.alternatives.length
      ? ` title="可能读成：${escapeHtml(item.alternatives.map((entry) => `${entry.phoneme} ${entry.score}`).join("、"))}"`
      : "";
    return `<span class="phoneme-score ${level}"${alternatives}><b>${escapeHtml(item?.phoneme || "?")}</b><small>${score}</small></span>`;
  }).join("");
  return `<div class="phoneme-assessment"><p><b>逐音素</b><span>绿色准确，黄色需注意，红色重点纠正</span></p><div>${chips}</div></div>`;
}

function renderWordPronunciationAssessment() {
  const button = $("#assessWordPronunciation");
  const panel = $("#wordPronunciationResult");
  if (!button || !panel) return;
  const stateValue = wordPronunciationAssessment;
  const activeWord = currentWord?.word || "";
  button.disabled = !activeWord || ["starting", "processing"].includes(stateValue.status);
  button.classList.toggle("recording", stateValue.status === "recording");
  button.textContent = stateValue.status === "starting" ? "正在启动麦克风…" : stateValue.status === "recording" ? "■ 结束并评分" : stateValue.status === "processing" ? "正在分析发音…" : "◉ 跟读纠音";
  if (!activeWord || stateValue.word !== activeWord || stateValue.status === "idle") {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }
  panel.hidden = false;
  if (["starting", "recording", "processing"].includes(stateValue.status)) {
    panel.innerHTML = `<p class="pronunciation-processing">${stateValue.status === "recording" ? `请读：${escapeHtml(activeWord)} ${currentWord?.phonetic ? `/${escapeHtml(currentWord.phonetic.replace(/^\/?|\/?$/g, ""))}/` : ""}` : stateValue.status === "processing" ? "正在比较你的录音与标准发音…" : "正在请求麦克风权限…"}</p>`;
    return;
  }
  if (stateValue.error) {
    panel.innerHTML = `<p class="pronunciation-error">${escapeHtml(stateValue.error)}</p>`;
    return;
  }
  panel.innerHTML = `<div class="pronunciation-score-grid">
    <div class="primary"><strong>${Number(stateValue.score) || 0}</strong><span>综合分</span></div>
    <div><strong>${Number.isFinite(stateValue.soundScore) ? stateValue.soundScore : "—"}</strong><span>声音相似度</span></div>
    <div><strong>${Number.isFinite(stateValue.rhythmScore) ? stateValue.rhythmScore : "—"}</strong><span>时长与节奏</span></div>
    <div><strong>${Number.isFinite(stateValue.textScore) ? stateValue.textScore : "—"}</strong><span>读音识别</span></div>
  </div>
  <p><b>目标音标</b>${currentWord?.phonetic ? `/${escapeHtml(currentWord.phonetic.replace(/^\/?|\/?$/g, ""))}/` : "词库暂无音标"}</p>
  ${stateValue.recognized ? `<p><b>识别到</b>${escapeHtml(stateValue.recognized)}</p>` : ""}
  ${renderPhonemeAssessment(stateValue.phonemes)}
  <p><b>建议</b>${escapeHtml(pronunciationAdvice(stateValue))}</p>
  <small>${stateValue.provider === "asr" ? "本次没有可用标准录音，仅按智谱语音识别结果给出基础分。" : "本次在设备上比较标准录音与你的频谱、时长及能量节奏。"}</small>`;
}

function stopWordPronunciationAssessment(abort = false, shouldRender = true) {
  clearTimeout(wordPronunciationAssessment.stopTimer);
  wordPronunciationAssessment.stopTimer = null;
  if (wordPronunciationAssessment.mediaRecorder) {
    wordPronunciationAssessment.abortRecording = abort;
    try { if (wordPronunciationAssessment.mediaRecorder.state !== "inactive") wordPronunciationAssessment.mediaRecorder.stop(); } catch {}
  }
  if (abort) {
    wordPronunciationAssessment.mediaStream?.getTracks().forEach((track) => track.stop());
    wordPronunciationAssessment.mediaStream = null;
    wordPronunciationAssessment.mediaRecorder = null;
    wordPronunciationAssessment.status = "idle";
  }
  if (shouldRender) renderWordPronunciationAssessment();
}

async function finishWordPronunciationAssessment(recorder, chunks, word, aborted) {
  if (wordPronunciationAssessment.mediaRecorder === recorder) wordPronunciationAssessment.mediaRecorder = null;
  wordPronunciationAssessment.mediaStream?.getTracks().forEach((track) => track.stop());
  wordPronunciationAssessment.mediaStream = null;
  if (aborted || wordPronunciationAssessment.word !== word) return;
  wordPronunciationAssessment.status = "processing";
  renderWordPronunciationAssessment();
  try {
    const recorded = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    const wav = await convertRecordingToWav(recorded);
    const [referenceResult, transcription] = await Promise.all([
      getWordPronunciationBlob(word).then((reference) => comparePronunciationAudio(wav, reference)).catch(() => null),
      deviceAIConfig.apiKey ? requestCloudTranscription(wav).catch(() => "") : Promise.resolve("")
    ]);
    const textScore = transcription ? scoreTextMatch(word, transcription).score : null;
    if (!referenceResult && !transcription) throw new Error("这个词暂时没有可用标准录音，请联网后再试。" );
    const result = {
      textScore,
      soundScore: referenceResult?.soundScore ?? null,
      rhythmScore: referenceResult?.rhythmScore ?? null,
      score: combinedPronunciationScore({ textScore, soundScore: referenceResult?.soundScore, rhythmScore: referenceResult?.rhythmScore }),
      recognized: transcription,
      phonemes: [],
      errorType: "",
      provider: referenceResult ? "local" : "asr"
    };
    Object.assign(wordPronunciationAssessment, result, { status: "complete", error: "" });
    state.pronunciationScores[word] = { ...result, assessedAt: new Date().toISOString() };
    const item = state.wordStates[word];
    if (item && result.score >= 80) item.audioVerified = true;
    saveState();
  } catch (error) {
    wordPronunciationAssessment.status = "error";
    wordPronunciationAssessment.error = error.message || "发音分析失败，请再试一次。";
  }
  renderWordPronunciationAssessment();
}

async function startWordPronunciationAssessment() {
  const word = currentWord?.word;
  if (!word) return;
  if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) return toast("当前浏览器不支持录音", "请使用最新版 Chrome，并确认网页使用 HTTPS。" );
  stopPronunciationAudio();
  stopWordPronunciationAssessment(true, false);
  wordPronunciationAssessment = { ...wordPronunciationAssessment, word, status: "starting", recognized: "", textScore: null, soundScore: null, rhythmScore: null, score: null, provider: "", phonemes: [], errorType: "", error: "" };
  renderWordPronunciationAssessment();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (currentWord?.word !== word) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    wordPronunciationAssessment.mediaRecorder = recorder;
    wordPronunciationAssessment.mediaStream = stream;
    wordPronunciationAssessment.mediaChunks = chunks;
    wordPronunciationAssessment.abortRecording = false;
    wordPronunciationAssessment.status = "recording";
    recorder.addEventListener("dataavailable", (event) => { if (event.data?.size) chunks.push(event.data); });
    recorder.addEventListener("stop", () => {
      const aborted = wordPronunciationAssessment.abortRecording;
      wordPronunciationAssessment.abortRecording = false;
      void finishWordPronunciationAssessment(recorder, chunks, word, aborted);
    }, { once: true });
    recorder.start(200);
    wordPronunciationAssessment.stopTimer = window.setTimeout(() => stopWordPronunciationAssessment(false), 7000);
    renderWordPronunciationAssessment();
  } catch (error) {
    wordPronunciationAssessment.status = "error";
    wordPronunciationAssessment.error = error?.name === "NotAllowedError" ? "没有获得麦克风权限，请在浏览器网站设置中允许麦克风。" : error.message || "无法启动录音。";
    renderWordPronunciationAssessment();
  }
}

function toggleWordPronunciationAssessment() {
  if (wordPronunciationAssessment.status === "recording") stopWordPronunciationAssessment(false);
  else void startWordPronunciationAssessment();
}

async function finishCloudTextDictation(recorder, chunks, input, baseText, aborted) {
  if (textDictation.mediaRecorder === recorder) textDictation.mediaRecorder = null;
  const stream = textDictation.mediaStream;
  textDictation.mediaStream = null;
  stream?.getTracks().forEach((track) => track.stop());
  textDictation.listening = false;
  textDictation.mode = null;
  if (aborted) {
    textDictation.processing = false;
    renderTextDictation();
    return;
  }
  textDictation.processing = true;
  textDictation.statusMessage = "";
  renderTextDictation();
  try {
    const recorded = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    const wav = await convertRecordingToWav(recorded);
    const spoken = await requestCloudTranscription(wav);
    input.value = joinDictationText(baseText, spoken);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    textDictation.statusMessage = `已识别：${spoken}`;
  } catch (error) {
    textDictation.statusMessage = error.message || "语音识别失败，请重试。";
    toast("语音输入没有成功", textDictation.statusMessage);
  } finally {
    textDictation.processing = false;
    renderTextDictation();
  }
}

async function startCloudTextDictation() {
  if (!deviceAIConfig.apiKey) return toast("需要智谱 API Key", "请先在设置的“手机 AI 直连”中保存密钥。" );
  if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
    return toast("当前浏览器不支持录音", "请使用最新版 Chrome，并确认网页使用 HTTPS。" );
  }
  const input = $("#aiInput");
  textDictation.statusMessage = "正在请求麦克风权限…";
  textDictation.starting = true;
  renderTextDictation();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    const baseText = input.value.trim();
    textDictation.mediaRecorder = recorder;
    textDictation.mediaStream = stream;
    textDictation.mediaChunks = chunks;
    textDictation.abortRecording = false;
    textDictation.starting = false;
    textDictation.listening = true;
    textDictation.mode = "cloud";
    textDictation.statusMessage = "";
    recorder.addEventListener("dataavailable", (event) => { if (event.data?.size) chunks.push(event.data); });
    recorder.addEventListener("stop", () => {
      const aborted = textDictation.abortRecording;
      textDictation.abortRecording = false;
      void finishCloudTextDictation(recorder, chunks, input, baseText, aborted);
    }, { once: true });
    recorder.start(250);
    textDictation.stopTimer = window.setTimeout(() => stopTextDictation(false), 20000);
    renderTextDictation();
  } catch (error) {
    textDictation.starting = false;
    textDictation.listening = false;
    textDictation.mode = null;
    textDictation.statusMessage = error?.name === "NotAllowedError"
      ? "没有获得麦克风权限，请在浏览器网站设置中允许麦克风。"
      : error.message || "无法启动录音。";
    renderTextDictation();
    toast("无法开始语音输入", textDictation.statusMessage);
  }
}

function startTextDictation() {
  if (aiPending) return;
  if (deviceAIConfig.speechInput === "glm-asr" && deviceAIConfig.apiKey) {
    void startCloudTextDictation();
    return;
  }
  const Recognition = speechRecognitionConstructor();
  if (!Recognition) {
    textDictation.statusMessage = "当前浏览器不支持免费识别；请在设置中改用“智谱云识别”。";
    renderTextDictation();
    return toast("当前浏览器不支持语音输入", textDictation.statusMessage);
  }

  const input = $("#aiInput");
  const recognition = new Recognition();
  textDictation.recognition = recognition;
  textDictation.listening = true;
  textDictation.mode = "browser";
  textDictation.statusMessage = "";
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
      textDictation.statusMessage = "没有获得麦克风权限，请在浏览器网站设置中允许麦克风。";
      toast("没有获得麦克风权限", textDictation.statusMessage);
    } else if (event.error === "no-speech") {
      textDictation.statusMessage = "没有听清，请靠近麦克风后再试一次。";
      toast("没有听清", textDictation.statusMessage);
    } else if (event.error === "network") {
      textDictation.statusMessage = "浏览器识别联网失败；可在设置中改用“智谱云识别”。";
      toast("语音识别联网失败", textDictation.statusMessage);
    } else {
      textDictation.statusMessage = `语音输入暂时不可用：${event.error || "unknown"}`;
      toast("语音输入暂时不可用", textDictation.statusMessage);
    }
    renderTextDictation();
  });
  recognition.addEventListener("end", () => {
    if (textDictation.recognition !== recognition) return;
    textDictation.recognition = null;
    textDictation.listening = false;
    textDictation.mode = null;
    renderTextDictation();
    input.focus();
  });

  try {
    recognition.start();
  } catch (error) {
    textDictation.recognition = null;
    textDictation.listening = false;
    textDictation.mode = null;
    textDictation.statusMessage = error.message || "无法启动语音输入。";
    renderTextDictation();
    toast("无法启动语音输入", error.message || "请重新点击语音输入。" );
  }
}

function toggleTextDictation() {
  if (textDictation.listening) stopTextDictation();
  else startTextDictation();
}

async function getShadowingReferenceBlob(text) {
  const key = String(text || "").trim();
  if (ttsAssessmentCache.has(key)) return ttsAssessmentCache.get(key);
  const request = requestAssessmentSpeech(key);
  ttsAssessmentCache.set(key, request);
  try {
    const blob = await request;
    ttsAssessmentCache.set(key, blob);
    while (ttsAssessmentCache.size > 12) ttsAssessmentCache.delete(ttsAssessmentCache.keys().next().value);
    return blob;
  } catch (error) {
    ttsAssessmentCache.delete(key);
    throw error;
  }
}

async function finishShadowingScore(messageIndex, recognized, learnerWav = null) {
  const message = currentAISession()[messageIndex];
  if (!message || shadowingState.messageIndex !== messageIndex) return;
  const textScore = recognized ? scoreTextMatch(message.content, recognized).score : null;
  let acoustic = { soundScore: null, rhythmScore: null };
  let basic = !learnerWav;
  if (learnerWav) {
    try {
      const reference = await getShadowingReferenceBlob(message.content);
      acoustic = await comparePronunciationAudio(learnerWav, reference);
    } catch {
      acoustic = await scoreStandaloneRhythm(learnerWav, message.content);
      basic = true;
    }
  }
  const result = {
    textScore,
    soundScore: acoustic.soundScore,
    rhythmScore: acoustic.rhythmScore,
    score: combinedPronunciationScore({ textScore, soundScore: acoustic.soundScore, rhythmScore: acoustic.rhythmScore, sentence: true }),
    recognized,
    basic
  };
  shadowingState.status = "complete";
  Object.assign(shadowingState, result);
  shadowingState.error = "";
  message.shadowing = { ...result, createdAt: new Date().toISOString() };
  saveState();
  renderAI();
}

function stopShadowing(abort = false, shouldRender = true) {
  clearTimeout(shadowingState.stopTimer);
  shadowingState.stopTimer = null;
  if (shadowingState.mediaRecorder) {
    shadowingState.abortRecording = abort;
    try { if (shadowingState.mediaRecorder.state !== "inactive") shadowingState.mediaRecorder.stop(); } catch {}
  }
  const recognition = shadowingState.recognition;
  shadowingState.recognition = null;
  try { abort ? recognition?.abort() : recognition?.stop(); } catch {}
  if (abort) {
    shadowingState.mediaStream?.getTracks().forEach((track) => track.stop());
    shadowingState.mediaStream = null;
    shadowingState.mediaRecorder = null;
    shadowingState.status = "idle";
    shadowingState.messageIndex = null;
  }
  if (shouldRender) renderAI();
}

async function finishCloudShadowing(recorder, chunks, messageIndex, aborted) {
  if (shadowingState.mediaRecorder === recorder) shadowingState.mediaRecorder = null;
  shadowingState.mediaStream?.getTracks().forEach((track) => track.stop());
  shadowingState.mediaStream = null;
  if (aborted) return;
  shadowingState.status = "processing";
  renderAI();
  try {
    const recorded = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    const wav = await convertRecordingToWav(recorded);
    const recognized = deviceAIConfig.apiKey ? await requestCloudTranscription(wav).catch(() => "") : "";
    await finishShadowingScore(messageIndex, recognized, wav);
  } catch (error) {
    shadowingState.status = "error";
    shadowingState.error = error.message || "跟读识别失败，请重试。";
    renderAI();
  }
}

async function startCloudShadowing(messageIndex) {
  if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) throw new Error("当前浏览器不支持录音，请使用最新版 Chrome 并允许麦克风。" );
  shadowingState.status = "starting";
  renderAI();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  shadowingState.mediaRecorder = recorder;
  shadowingState.mediaStream = stream;
  shadowingState.mediaChunks = chunks;
  shadowingState.abortRecording = false;
  shadowingState.status = "recording";
  recorder.addEventListener("dataavailable", (event) => { if (event.data?.size) chunks.push(event.data); });
  recorder.addEventListener("stop", () => {
    const aborted = shadowingState.abortRecording;
    shadowingState.abortRecording = false;
    void finishCloudShadowing(recorder, chunks, messageIndex, aborted);
  }, { once: true });
  recorder.start(250);
  shadowingState.stopTimer = window.setTimeout(() => stopShadowing(false), 25000);
  renderAI();
}

function startBrowserShadowing(messageIndex) {
  const Recognition = speechRecognitionConstructor();
  if (!Recognition) throw new Error("当前浏览器不支持免费语音识别，请在设置中选择智谱云识别。" );
  const recognition = new Recognition();
  let finalText = "";
  shadowingState.recognition = recognition;
  shadowingState.status = "recording";
  recognition.lang = state.settings.accent || "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.addEventListener("result", (event) => {
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const text = event.results[index][0]?.transcript || "";
      if (event.results[index].isFinal) finalText += ` ${text}`;
      else interim += ` ${text}`;
    }
    shadowingState.recognized = `${finalText} ${interim}`.trim();
    renderAI();
  });
  recognition.addEventListener("error", (event) => {
    if (event.error === "aborted") return;
    shadowingState.status = "error";
    shadowingState.error = event.error === "not-allowed" ? "没有麦克风权限，请在网站设置中允许。" : "没有识别到清晰跟读，请再试一次。";
    renderAI();
  });
  recognition.addEventListener("end", () => {
    if (shadowingState.recognition === recognition) shadowingState.recognition = null;
    if (shadowingState.status !== "error") void finishShadowingScore(messageIndex, finalText.trim() || shadowingState.recognized);
  });
  recognition.start();
  renderAI();
}

function toggleShadowing(messageIndex) {
  if (shadowingState.messageIndex === messageIndex && ["starting", "recording", "processing"].includes(shadowingState.status)) {
    stopShadowing(false);
    return;
  }
  stopAITextSpeech();
  if (textDictation.listening) stopTextDictation(true);
  stopShadowing(true, false);
  shadowingState = { ...shadowingState, messageIndex, status: "starting", recognized: "", textScore: null, soundScore: null, rhythmScore: null, score: null, error: "" };
  if (!deviceAIConfig.apiKey) {
    shadowingState.status = "error";
    shadowingState.error = "发音评分需要在设置中保存智谱 API Key，用于生成同一句标准语音并完成声音比较。";
    renderAI();
    return;
  }
  try {
    void startCloudShadowing(messageIndex).catch((error) => {
      shadowingState.status = "error";
      shadowingState.error = error.message || "无法启动跟读录音。";
      renderAI();
    });
  } catch (error) {
    shadowingState.status = "error";
    shadowingState.error = error.message || "无法启动跟读识别。";
    renderAI();
  }
}

function renderAITextSpeechButtons() {
  $$("[data-ai-speak-index]").forEach((button) => {
    const speaking = Number(button.dataset.aiSpeakIndex) === aiTextSpeech.messageIndex;
    button.classList.toggle("speaking", speaking);
    button.setAttribute("aria-pressed", String(speaking));
    button.setAttribute("aria-label", speaking ? "停止朗读这条 AI 回复" : "朗读这条 AI 回复");
    button.textContent = speaking
      ? aiTextSpeech.loading ? "… 生成语音" : "■ 停止"
      : naturalSpeechEnabled() ? "▶ 自然朗读" : "▶ 朗读";
  });
}

function toggleAITranslation(messageIndex) {
  const messages = currentAISession();
  const message = messages[messageIndex];
  if (!message?.translation) return;
  const key = aiTranslationKey(message, messageIndex);
  if (visibleAITranslations.has(key)) visibleAITranslations.delete(key);
  else visibleAITranslations.add(key);
  renderAI();
}

function stopAITextSpeech(shouldRender = true) {
  if ("speechSynthesis" in window && aiTextSpeech.utterance) speechSynthesis.cancel();
  if (aiTextSpeech.audio) {
    aiTextSpeech.audio.pause();
    aiTextSpeech.audio.src = "";
  }
  if (aiTextSpeech.objectUrl) URL.revokeObjectURL(aiTextSpeech.objectUrl);
  aiTextSpeech = { utterance: null, audio: null, objectUrl: null, loading: false, messageIndex: null };
  if (shouldRender) renderAITextSpeechButtons();
}

function naturalSpeechEnabled() {
  return Boolean(deviceAIConfig.apiKey && deviceAIConfig.speechVoice && deviceAIConfig.speechVoice !== "system" && Date.now() >= zhipuSpeechUnavailableUntil);
}

async function requestAssessmentSpeech(text) {
  if (!deviceAIConfig.apiKey) throw new Error("发音相似度需要先在设置中保存智谱 API Key。" );
  if (Date.now() < zhipuSpeechUnavailableUntil) throw new Error(zhipuSpeechFailureReason || "智谱自然朗读暂时没有可用额度。" );
  const content = String(text || "").trim().slice(0, 900);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetch(ZHIPU_TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deviceAIConfig.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "glm-tts",
        input: content,
        voice: "female",
        speed: 0.88,
        volume: 1,
        response_format: "wav"
      }),
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("自然朗读连接超时，已改用设备发音。" );
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if ([401, 403].includes(response.status)) throw new Error("智谱 API Key 无效或没有自然朗读权限。" );
    if (response.status === 429) {
      zhipuSpeechUnavailableUntil = Date.now() + 30 * 60 * 1000;
      zhipuSpeechFailureReason = "智谱自然朗读没有可用余额或语音资源包";
      throw new Error(zhipuSpeechFailureReason);
    }
    throw new Error(data?.error?.message || `自然朗读生成失败（${response.status}）。`);
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error("智谱没有返回有效音频。" );
  return blob.type === "audio/wav" ? blob : new Blob([blob], { type: "audio/wav" });
}

async function requestNaturalSpeech(text) {
  if (!naturalSpeechEnabled()) throw new Error("自然朗读尚未启用。" );
  return requestAssessmentSpeech(text);
}

function speakTextWithSystem(text, messageIndex) {
  if (!("speechSynthesis" in window)) return toast("当前浏览器不支持朗读", "请使用最新版 Chrome 或 Edge。" );
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = state.settings.accent || "en-US";
  utterance.rate = 0.82;
  utterance.pitch = 0.96;
  const selected = selectSystemEnglishVoice();
  if (selected) utterance.voice = selected;
  aiTextSpeech = { utterance, audio: null, objectUrl: null, loading: false, messageIndex };
  const finish = () => {
    if (aiTextSpeech.utterance !== utterance) return;
    aiTextSpeech = { utterance: null, audio: null, objectUrl: null, loading: false, messageIndex: null };
    renderAITextSpeechButtons();
  };
  utterance.addEventListener("end", finish, { once: true });
  utterance.addEventListener("error", finish, { once: true });
  renderAITextSpeechButtons();
  speechSynthesis.speak(utterance);
}

function selectSystemEnglishVoice() {
  const voices = "speechSynthesis" in window ? speechSynthesis.getVoices() : [];
  const saved = voices.find((voice) => voice.voiceURI === state.settings.voiceURI);
  if (saved) return saved;
  const accent = state.settings.accent || "en-US";
  const candidates = voices.filter((voice) => /^en[-_]/i.test(voice.lang));
  return candidates.find((voice) => voice.lang.replace("_", "-").toLowerCase() === accent.toLowerCase() && /google|microsoft|samantha|daniel|natural/i.test(voice.name))
    || candidates.find((voice) => voice.lang.replace("_", "-").toLowerCase() === accent.toLowerCase())
    || candidates.find((voice) => /google|microsoft|samantha|daniel|natural/i.test(voice.name))
    || candidates[0]
    || null;
}

async function toggleAITextSpeech(messageIndex) {
  const messages = currentAISession();
  const message = messages[messageIndex];
  if (!message || message.role !== "assistant" || !message.content) return;
  if (aiTextSpeech.messageIndex === messageIndex) {
    stopAITextSpeech();
    return;
  }
  if (textDictation.listening) stopTextDictation(true);
  stopPronunciationAudio();
  stopAITextSpeech(false);
  if (!naturalSpeechEnabled()) {
    speakTextWithSystem(message.content, messageIndex);
    return;
  }
  aiTextSpeech = { utterance: null, audio: null, objectUrl: null, loading: true, messageIndex };
  renderAITextSpeechButtons();
  try {
    const blob = await requestNaturalSpeech(message.content);
    if (aiTextSpeech.messageIndex !== messageIndex) return;
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    aiTextSpeech = { utterance: null, audio, objectUrl, loading: false, messageIndex };
    const finish = () => {
      if (aiTextSpeech.audio !== audio) return;
      URL.revokeObjectURL(objectUrl);
      aiTextSpeech = { utterance: null, audio: null, objectUrl: null, loading: false, messageIndex: null };
      renderAITextSpeechButtons();
    };
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
    renderAITextSpeechButtons();
    await audio.play();
  } catch (error) {
    if (aiTextSpeech.messageIndex !== messageIndex) return;
    stopAITextSpeech();
    toast("已切换到手机系统声音", `${error.message || "智谱自然朗读暂时不可用"}；本次仍会继续朗读。`);
    speakTextWithSystem(message.content, messageIndex);
  }
}

function scheduleVoiceListening(delay = 450) {
  clearTimeout(voiceSession.restartTimer);
  if (!voiceSession.active) return;
  voiceSession.restartTimer = window.setTimeout(beginVoiceListening, delay);
}

function stopCloudVoiceTurn(abort = false) {
  clearTimeout(voiceSession.stopTimer);
  voiceSession.stopTimer = null;
  const recorder = voiceSession.mediaRecorder;
  if (!recorder) return;
  voiceSession.abortRecording = abort;
  if (!abort) voiceSession.state = "processing";
  renderVoiceUI();
  try {
    if (recorder.state !== "inactive") recorder.stop();
  } catch {
    if (!abort) failVoiceSession("无法结束本次录音", "请结束语音练习后重新开始。" );
  }
}

async function finishCloudVoiceTurn(recorder, chunks, aborted) {
  if (voiceSession.mediaRecorder === recorder) voiceSession.mediaRecorder = null;
  const stream = voiceSession.mediaStream;
  voiceSession.mediaStream = null;
  voiceSession.mediaChunks = [];
  stream?.getTracks().forEach((track) => track.stop());
  if (aborted || !voiceSession.active) return;
  voiceSession.state = "processing";
  renderVoiceUI();
  try {
    const recorded = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    if (!recorded.size) throw new Error("没有录到声音，请重新说一次。" );
    const wav = await convertRecordingToWav(recorded);
    const content = await requestCloudTranscription(wav);
    voiceSession.transcript = `你：${content}`;
    renderVoiceUI();
    await submitVoiceTurn(content);
  } catch (error) {
    if (!voiceSession.active) return;
    voiceSession.state = "error";
    voiceSession.statusMessage = "这句话没有识别成功";
    voiceSession.hintMessage = error.message || "请靠近麦克风后重新开始。";
    renderVoiceUI();
  }
}

async function startCloudVoiceListening() {
  if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
    return failVoiceSession("当前浏览器不支持录音", "请使用最新版 Chrome，并确认已通过 HTTPS 打开网页。" );
  }
  voiceSession.state = "connecting";
  renderVoiceUI();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (!voiceSession.active) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    voiceSession.mediaRecorder = recorder;
    voiceSession.mediaStream = stream;
    voiceSession.mediaChunks = chunks;
    voiceSession.abortRecording = false;
    recorder.addEventListener("dataavailable", (event) => { if (event.data?.size) chunks.push(event.data); });
    recorder.addEventListener("stop", () => {
      const aborted = voiceSession.abortRecording;
      voiceSession.abortRecording = false;
      void finishCloudVoiceTurn(recorder, chunks, aborted);
    }, { once: true });
    recorder.start(250);
    voiceSession.state = "listening";
    voiceSession.stopTimer = window.setTimeout(() => stopCloudVoiceTurn(false), 20000);
    renderVoiceUI();
  } catch (error) {
    failVoiceSession(
      error?.name === "NotAllowedError" ? "没有获得麦克风权限" : "无法启动手机录音",
      error?.name === "NotAllowedError" ? "请在浏览器的网站设置中允许此网页使用麦克风。" : error.message || "请重新开始语音练习。"
    );
  }
}

function beginVoiceListening() {
  if (!voiceSession.active || voiceSession.recognition || voiceSession.mediaRecorder) return;
  if (deviceAIConfig.speechInput === "glm-asr" && deviceAIConfig.apiKey) {
    void startCloudVoiceListening();
    return;
  }
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

function speakVoiceReplyWithSystem(text) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window) || !text || !voiceSession.active) return resolve();
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    voiceSession.utterance = utterance;
    utterance.lang = state.settings.accent || "en-US";
    utterance.rate = 0.82;
    utterance.pitch = 0.96;
    const selected = selectSystemEnglishVoice();
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

async function speakVoiceReply(text) {
  if (!naturalSpeechEnabled()) return speakVoiceReplyWithSystem(text);
  try {
    const blob = await requestNaturalSpeech(text);
    if (!voiceSession.active) return;
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    voiceSession.audio = audio;
    voiceSession.objectUrl = objectUrl;
    voiceSession.state = "speaking";
    renderVoiceUI();
    await new Promise((resolve, reject) => {
      const finish = () => {
        if (voiceSession.audio === audio) {
          voiceSession.audio = null;
          voiceSession.objectUrl = null;
        }
        URL.revokeObjectURL(objectUrl);
        resolve();
      };
      audio.addEventListener("ended", finish, { once: true });
      audio.addEventListener("error", () => { finish(); reject(new Error("音频播放失败")); }, { once: true });
      audio.play().catch(reject);
    });
  } catch (error) {
    if (!voiceSession.active) return;
    if (voiceSession.audio) {
      voiceSession.audio.pause();
      voiceSession.audio.src = "";
      voiceSession.audio = null;
    }
    if (voiceSession.objectUrl) {
      URL.revokeObjectURL(voiceSession.objectUrl);
      voiceSession.objectUrl = null;
    }
    toast("已切换到手机系统声音", `${error.message || "智谱自然朗读暂时不可用"}；语音对话可以继续。`);
    await speakVoiceReplyWithSystem(text);
  }
}

function buildWritingReviewInstructions(type) {
  const task = type === "translation" ? "CET-4 Chinese-to-English paragraph translation" : "CET-4 English essay";
  return `You are an exacting but constructive CET-4 examiner reviewing a ${task} for a Chinese learner aiming for 500+. Score the submitted English from 0 to 100 using task fulfillment/accuracy, organization, vocabulary, grammar and mechanics. Do not inflate the score. Preserve the learner's intended meaning and level while producing a complete corrected version. Explain errors in concise Chinese. For translation, compare against the supplied Chinese source and flag omissions or invented information. For an essay, use the supplied prompt if present.

Return only valid JSON: {"score":0,"summary":"Chinese overall assessment","corrected":"complete corrected English","corrections":[{"original":"exact excerpt","correction":"improved excerpt","reason":"Chinese reason"}],"strengths":["Chinese strength"],"advice":["specific next step"]}. Include up to 12 important corrections and up to 5 strengths/advice items.`;
}

function parseWritingReview(text) {
  const cleaned = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
    return {
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      summary: String(parsed.summary || "").trim(),
      corrected: String(parsed.corrected || "").trim(),
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections.slice(0, 12) : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5).map(String) : [],
      advice: Array.isArray(parsed.advice) ? parsed.advice.slice(0, 5).map(String) : []
    };
  } catch {
    throw new Error("AI 返回的批改格式不完整，请再试一次。" );
  }
}

const TRANSLATION_TOPIC_LABELS = {
  random: "中国文化、社会生活、科技教育或绿色发展中随机选择",
  culture: "中国文化、传统习俗、非物质文化遗产或地方文化",
  society: "中国社会生活、公共服务、青年成长或生活方式变化",
  technology: "中国科技发展、数字生活、教育创新或青年学习",
  ecology: "中国绿色发展、生态保护、低碳生活或城乡环境改善"
};

function buildTranslationPromptInstructions(topic) {
  const topicLabel = TRANSLATION_TOPIC_LABELS[topic] || TRANSLATION_TOPIC_LABELS.random;
  return `You create original practice questions for the Chinese College English Test Band 4 (CET-4). Generate one Chinese-to-English paragraph translation exercise for a learner aiming for 500+. The official task is a 30-minute Chinese-to-English paragraph translation worth 15% of CET-4; imitate its practical difficulty and discourse style, but never copy, paraphrase closely, or claim to be an actual past-paper question.

Requirements:
- Topic: ${topicLabel}.
- Write 4–5 connected Chinese sentences and strictly keep the source between 135 and 155 Chinese Han characters, excluding punctuation. Aim for about 145 Han characters; do not approach 160 unless necessary.
- Use concrete facts and clear logical connections. Include several CET-4-relevant structures such as time changes, comparison, cause/effect, passive meaning, relative clauses, or "越来越/不仅…而且…" ideas.
- Keep names, figures and specialist terminology limited; any culture-specific term must be understandable from context.
- Do not include English, a reference translation, vocabulary hints, answer keys, markdown, or explanations in the source paragraph.
- Make the passage challenging but realistically translatable with CET-4 vocabulary and grammar.

Return only valid JSON: {"title":"short Chinese title","source":"Chinese paragraph only","focus":["three concise Chinese skill points"]}.`;
}

function parseTranslationPrompt(text) {
  const cleaned = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
    const payload = parsed?.result || parsed?.data || parsed?.question || parsed;
    const title = String(payload?.title || payload?.标题 || "四级段落翻译练习").trim().slice(0, 80);
    const source = String(payload?.source || payload?.paragraph || payload?.passage || payload?.chinese || payload?.中文原文 || payload?.题目 || "").trim().slice(0, 2000);
    const rawFocus = payload?.focus || payload?.考点;
    const focus = Array.isArray(rawFocus) ? rawFocus.map((item) => String(item).trim()).filter(Boolean).slice(0, 3) : [];
    if (!source || /[A-Za-z]{4,}/.test(source)) throw new Error("INVALID_TRANSLATION_PROMPT");
    return { title, source, focus };
  } catch {
    const plain = cleaned.replace(/^(?:题目|中文原文|段落)\s*[：:]\s*/i, "").trim();
    const chineseCharacters = (plain.match(/[\u3400-\u9fff]/g) || []).length;
    if (!cleaned.startsWith("{") && chineseCharacters >= 80 && !/[A-Za-z]{4,}/.test(plain)) {
      return { title: "四级段落翻译练习", source: plain.slice(0, 2000), focus: [] };
    }
    throw new Error("AI 返回的中文题目不完整，请再生成一次。");
  }
}

async function requestDirectTranslationPrompt(topic) {
  if (!deviceAIConfig.apiKey) throw new Error("请先在设置中保存智谱 API Key。");
  const response = await fetch(ZHIPU_CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${deviceAIConfig.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: deviceAIConfig.model,
      messages: [{ role: "system", content: buildTranslationPromptInstructions(topic) }, { role: "user", content: "请生成一道新的练习题。" }],
      stream: false,
      thinking: { type: "enabled", clear_thinking: false },
      response_format: { type: "json_object" },
      temperature: 0.95,
      top_p: 0.95,
      max_tokens: 4096
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `智谱出题失败（${response.status}）。`);
  const raw = data?.choices?.[0]?.message?.content;
  const content = Array.isArray(raw) ? raw.map((item) => typeof item === "string" ? item : String(item?.text || item?.content || "")).join("") : raw;
  return { ...parseTranslationPrompt(content), provider: "zhipu", model: String(data?.model || deviceAIConfig.model), transport: "direct" };
}

async function requestTranslationPrompt(topic) {
  let backendError = null;
  if (aiBackendAvailable) {
    try {
      const response = await fetch("./api/ai-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: "translation-prompt", topic }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "AI 出题失败，请稍后重试。");
      return result;
    } catch (error) { backendError = error; }
  }
  if (deviceAIConfig.apiKey) return requestDirectTranslationPrompt(topic);
  throw backendError || new Error("请先在设置中配置手机 AI，或在电脑上启动本机服务。");
}

async function generateTranslationPrompt() {
  if (translationPromptPending || aiPending) return;
  translationPromptPending = true;
  updateWritingLabels();
  $("#aiWritingStatus").textContent = "AI 正在生成一道原创四级真题风格中文段落…";
  try {
    const topic = $("#aiTranslationTopic").value || "random";
    const result = await requestTranslationPrompt(topic);
    if (result.provider) aiServiceInfo = { provider: result.provider, model: result.model || "", transport: result.transport || "backend" };
    $("#aiWritingPrompt").value = String(result.source || "").trim();
    $("#aiWritingInput").value = "";
    $("#aiWritingResult").hidden = true;
    const focus = Array.isArray(result.focus) && result.focus.length ? `；考点：${result.focus.join("、")}` : "";
    $("#aiWritingStatus").textContent = `已生成《${result.title || "四级段落翻译练习"}》${focus}。请在下方完成英文译文。`;
    toast("四级翻译题已生成", "这里只显示中文；提交后再查看修改稿和参考表达。");
  } catch (error) {
    $("#aiWritingStatus").textContent = error.message || "AI 出题失败，请稍后再试。";
    toast("AI 出题没有完成", $("#aiWritingStatus").textContent);
  } finally {
    translationPromptPending = false;
    updateWritingLabels();
  }
}

async function requestDirectWritingReview({ type, prompt, text }) {
  if (!deviceAIConfig.apiKey) throw new Error("请先在设置中保存智谱 API Key。" );
  const response = await fetch(ZHIPU_CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${deviceAIConfig.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: deviceAIConfig.model,
      messages: [
        { role: "system", content: buildWritingReviewInstructions(type) },
        { role: "user", content: `Task/source:\n${prompt || "(not supplied)"}\n\nLearner submission:\n${text}` }
      ],
      stream: false,
      thinking: { type: "enabled", clear_thinking: false },
      response_format: { type: "json_object" },
      temperature: 0.6,
      top_p: 0.9,
      max_tokens: 4096
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `智谱批改失败（${response.status}）。`);
  const raw = data?.choices?.[0]?.message?.content;
  const content = Array.isArray(raw) ? raw.map((item) => typeof item === "string" ? item : String(item?.text || item?.content || "")).join("") : raw;
  return { ...parseWritingReview(content), provider: "zhipu", model: String(data?.model || deviceAIConfig.model), transport: "direct" };
}

async function requestWritingReview(payload) {
  let backendError = null;
  if (aiBackendAvailable) {
    try {
      const response = await fetch("./api/ai-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: "writing", ...payload }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "AI 批改失败，请稍后重试。" );
      return result;
    } catch (error) { backendError = error; }
  }
  if (deviceAIConfig.apiKey) return requestDirectWritingReview(payload);
  throw backendError || new Error("请先在设置中配置手机 AI，或在电脑上启动本机服务。" );
}

async function submitWritingReview() {
  if (aiPending) return;
  const type = $("#aiWritingType").value === "translation" ? "translation" : "essay";
  const prompt = $("#aiWritingPrompt").value.trim();
  const text = $("#aiWritingInput").value.trim();
  if (!text) return toast("请先粘贴你的英文答案");
  if (type === "translation" && !prompt) return toast("请粘贴中文原文", "有原文才能判断漏译和错译。" );
  aiPending = true;
  $("#aiWritingSubmit").disabled = true;
  $("#aiWritingStatus").textContent = "AI 正在按四级标准批改，通常需要十几秒…";
  try {
    const result = await requestWritingReview({ type, prompt, text });
    if (result.provider) aiServiceInfo = { provider: result.provider, model: result.model || "", transport: result.transport || "backend" };
    state.ai.writingReviews.unshift({ ...result, type, prompt, original: text, createdAt: new Date().toISOString() });
    state.ai.writingReviews = state.ai.writingReviews.slice(0, 10);
    saveState();
    $("#aiWritingStatus").textContent = "批改完成；参考分用于定位问题，不等同于正式阅卷分数。";
    renderWritingReview();
  } catch (error) {
    $("#aiWritingStatus").textContent = error.message || "批改失败，请稍后再试。";
    toast("AI 批改没有完成", $("#aiWritingStatus").textContent);
  } finally {
    aiPending = false;
    $("#aiWritingSubmit").disabled = false;
  }
}

function updateWritingLabels() {
  const translation = $("#aiWritingType").value === "translation";
  $("#aiTranslationGenerator").hidden = !translation;
  $("#aiGenerateTranslation").disabled = translationPromptPending || aiPending;
  $("#aiGenerateTranslation").textContent = translationPromptPending ? "正在生成…" : "生成中文题目";
  $("#aiWritingPromptLabel").textContent = translation ? "中文原文（必填）" : "作文题目（可选）";
  $("#aiWritingInputLabel").textContent = translation ? "你的英文译文" : "你的英文作文";
  $("#aiWritingPrompt").placeholder = translation ? "粘贴需要翻译的中文段落。" : "粘贴题目或写作要求，有题目时评分会更准确。";
  $("#aiWritingInput").placeholder = translation ? "粘贴你的英文译文…" : "粘贴你的英文作文…";
}

function buildTutorInstructions(scenario, training = null) {
  const current = AI_SCENARIOS[scenario] || AI_SCENARIOS.campus;
  const speakingTurn = training?.mode === "speaking";
  const voiceReview = training?.mode === "voice-review";
  const trainingRules = training?.mode === "speaking" ? `
This turn belongs to a structured speaking lesson. Phase: ${training.phase || "conversation"}. Retry turn: ${Boolean(training.retry)}. The prompt shown to the learner was: ${String(training.prompt || "").slice(0, 500)}
Respond naturally first, then ask exactly one short follow-up question unless this is a retry. Use 2–3 short sentences and no more than 45 English words. Correct at most TWO important issues, prioritizing meaning, completeness/naturalness, key grammar, then pronunciation-friendly phrasing. If the learner is retrying a corrected sentence, briefly acknowledge it and do not introduce a new topic. Do not mention scores or claim to hear pronunciation; the app evaluates audio separately.` : voiceReview ? `
This is a post-processing pass for a completed real-time voice turn. The voice model already replied with exactly: ${String(training.assistantReply || "").slice(0, 900)}
Do not create a different answer or another question. Put that exact English voice reply in the reply field, translate that exact reply into Chinese, and correct at most TWO important errors in the learner's message. Do not claim to hear pronunciation; only the transcript is available.` : "";
  return `You are the private English tutor inside 蘑菇酱四级 for one Chinese learner preparing for CET-4 and aiming for 500+. The learner is around B1 and wants practical conversation plus gentle correction. The current scenario is ${current.title}: ${current.goal}${trainingRules}

Keep the conversation natural and encouraging, but do not give empty praise. Reply mainly in simple, natural English suitable for CET-4. If the learner writes Chinese, help them express that idea in English and continue the conversation. ${speakingTurn ? "Follow the stricter structured-lesson response limits above." : voiceReview ? "Follow the voice-turn post-processing rule above exactly." : "Use two to four short sentences, keep the reply under 70 English words, and end directly with exactly one useful follow-up question. Do not introduce the question with labels such as Ask: or Question:."}

The app supports voice: it displays your English reply and a separate text-to-speech service reads that exact reply aloud. Never claim that you are text-only, that the app has no voice, or that spoken output is a separate answer. If asked about voice, explain this accurately and briefly.

Return only a valid JSON object with this shape: {"reply":"English reply","translation":"complete natural Chinese translation of reply","feedback":[{"original":"one complete learner sentence that contains an actual error","correction":"natural corrected sentence","reason":"brief Chinese explanation"}],"vocabulary":[{"word":"useful word or phrase","meaning":"brief Chinese meaning","example":"short English example"}]}. The translation must match the reply exactly in meaning. Feedback must contain only sentences that genuinely need correction; omit natural/correct sentences completely, and return an empty feedback array when there is no error. Include at most ${speakingTurn || voiceReview ? "two" : "eight"} feedback items and two vocabulary items.`;
}

function parseDirectTutorReply(text) {
  const cleaned = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(cleaned);
    return {
      reply: typeof parsed.reply === "string" ? parsed.reply.trim() : "",
      translation: typeof parsed.translation === "string" ? parsed.translation.trim() : "",
      feedback: meaningfulAIFeedback(parsed.feedback).slice(0, 8),
      vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary.slice(0, 2) : []
    };
  } catch {
    return { reply: cleaned, translation: "", feedback: [], vocabulary: [] };
  }
}

async function requestDirectZhipu({ scenario, history, message, training = null }) {
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
      messages: [{ role: "system", content: buildTutorInstructions(scenario, training) }, ...safeHistory, { role: "user", content: message }],
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

function speakingHistory() {
  return speakingSession.turns.slice(-6).flatMap((turn) => [
    { role: "user", content: turn.answer },
    ...(turn.reply ? [{ role: "assistant", content: turn.reply }] : [])
  ]);
}

function moveSpeakingTaskAfterAnswer(nextPrompt = "") {
  const phase = speakingPhase().id;
  if (phase === "warmup") return advanceSpeakingPhase();
  if (phase === "translation") {
    speakingSession.translationIndex += 1;
    if (speakingSession.translationIndex >= 3) return advanceSpeakingPhase();
    speakingSession.currentTask = speakingTranslationTask();
    speakingSession.latestAnswer = "";
    speakingSession.latestFeedback = [];
    speakingSession.latestReply = "";
    speakingSession.latestTranslation = "";
    speakingSession.translationVisible = false;
    armSpeakingHints();
    renderSpeakingSession();
    return;
  }
  if (phase === "scenario") {
    speakingSession.conversationTurns += 1;
    if (speakingSession.conversationTurns >= 6) return advanceSpeakingPhase();
    speakingSession.currentTask = speakingScenarioTask(nextPrompt);
    speakingSession.latestAnswer = "";
    speakingSession.latestFeedback = [];
    speakingSession.latestTranslation = "";
    speakingSession.translationVisible = false;
    armSpeakingHints();
    renderSpeakingSession();
  }
}

async function submitSpeakingAnswer(answer, typed = false) {
  const content = String(answer || "").trim();
  if (!speakingSession.active || speakingSession.pending || !content) return;
  const phase = speakingPhase().id;
  if (!["warmup", "translation", "scenario"].includes(phase)) return;
  clearSpeakingHintTimer();
  speakingSession.latestAnswer = content;
  speakingSession.latestFeedback = [];
  speakingSession.pending = true;
  speakingSession.status = "processing";
  speakingSession.statusMessage = typed ? "正在检查文字回答；本轮不计算发音。" : "正在检查你的表达。";
  renderSpeakingSession();
  const retrying = speakingSession.retrying;
  const shownPrompt = speakingSession.currentTask?.prompt || "";
  try {
    const result = await requestAIReply({
      scenario: state.ai.scenario,
      history: speakingHistory(),
      message: content,
      training: { mode: "speaking", phase, prompt: shownPrompt, retry: retrying }
    });
    if (result.provider) aiServiceInfo = { provider: result.provider, model: result.model || "", transport: result.transport || "backend" };
    const feedback = meaningfulAIFeedback(result.feedback).slice(0, 2);
    const reply = String(result.reply || "").trim();
    speakingSession.latestFeedback = feedback;
    speakingSession.latestReply = reply;
    speakingSession.latestTranslation = String(result.translation || "").trim();
    speakingSession.translationVisible = false;
    speakingSession.turns.push({ phase, prompt: shownPrompt, answer: content, reply, typed, feedback, createdAt: new Date().toISOString() });
    if (feedback.length) speakingSession.errors.push(...feedback.map((item) => ({ ...item, phase, createdAt: new Date().toISOString() })));
    speakingSession.pending = false;
    speakingSession.status = "ready";

    if (!retrying && feedback[0]?.correction) {
      speakingSession.retryTarget = feedback[0].correction;
      speakingSession.retrying = true;
      speakingSession.currentTask = {
        prompt: `Please say the corrected sentence once:\n${feedback[0].correction}`,
        keywords: feedback[0].correction,
        skeleton: feedback[0].correction,
        model: feedback[0].correction
      };
      speakingSession.statusMessage = "只重说这一句；完成后继续，不反复卡住。";
      speakingSession.hintAvailable = true;
      renderSpeakingSession();
    } else {
      speakingSession.retryTarget = "";
      speakingSession.retrying = false;
      speakingSession.statusMessage = typed ? "文字回答已记录；发音项保持空白。" : "这轮已完成。";
      moveSpeakingTaskAfterAnswer(reply);
    }
    if (reply) void playSpeakingText(reply, 1).catch(() => {});
    saveState();
  } catch (error) {
    speakingSession.pending = false;
    speakingSession.status = "ready";
    speakingSession.statusMessage = error.message || "AI 暂时没有完成纠错，请再试一次。";
    renderSpeakingSession();
  }
}

function speakSystemOnce(text, rate = 0.88) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window) || !text) return resolve();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = state.settings.accent || "en-US";
    utterance.rate = rate;
    utterance.pitch = 0.96;
    const voice = selectSystemEnglishVoice();
    if (voice) utterance.voice = voice;
    utterance.addEventListener("end", resolve, { once: true });
    utterance.addEventListener("error", resolve, { once: true });
    speechSynthesis.speak(utterance);
  });
}

async function playSpeakingText(text, speed = 1) {
  stopAITextSpeech(false);
  if (speakingSession.referenceAudio) {
    speakingSession.referenceAudio.pause();
    speakingSession.referenceAudio.src = "";
  }
  if (speakingSession.referenceObjectUrl) URL.revokeObjectURL(speakingSession.referenceObjectUrl);
  speakingSession.referenceAudio = null;
  speakingSession.referenceObjectUrl = null;
  const content = String(text || "").trim();
  if (!content) return;
  if (speed === "chunk") {
    const chunks = content.split(/(?<=[,;:.!?])\s+/).filter(Boolean).slice(0, 8);
    for (const chunk of chunks) {
      await speakSystemOnce(chunk, 0.78);
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    }
    return;
  }
  if (naturalSpeechEnabled()) {
    try {
      const blob = await requestNaturalSpeech(content);
      const objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      audio.playbackRate = Number(speed) || 1;
      speakingSession.referenceAudio = audio;
      speakingSession.referenceObjectUrl = objectUrl;
      await new Promise((resolve, reject) => {
        const finish = () => {
          if (speakingSession.referenceAudio === audio) speakingSession.referenceAudio = null;
          if (speakingSession.referenceObjectUrl === objectUrl) speakingSession.referenceObjectUrl = null;
          URL.revokeObjectURL(objectUrl);
          resolve();
        };
        audio.addEventListener("ended", finish, { once: true });
        audio.addEventListener("error", () => { finish(); reject(new Error("音频播放失败")); }, { once: true });
        audio.play().catch(reject);
      });
      return;
    } catch {}
  }
  await speakSystemOnce(content, speed === 0.8 ? 0.72 : 0.88);
}

async function finishSpeakingShadowAttempt(wav) {
  const sentence = speakingSession.shadowSentence;
  let recognized = "";
  if (deviceAIConfig.apiKey) recognized = await requestCloudTranscription(wav).catch(() => "");
  const textScore = recognized ? scoreTextMatch(sentence, recognized).score : null;
  let acoustic;
  try {
    const reference = await getShadowingReferenceBlob(sentence);
    acoustic = await comparePronunciationAudio(wav, reference);
  } catch {
    acoustic = await scoreStandaloneRhythm(wav, sentence);
  }
  const result = {
    textScore,
    rhythmScore: acoustic.rhythmScore,
    score: combinedPronunciationScore({ textScore, soundScore: null, rhythmScore: acoustic.rhythmScore, sentence: true }),
    recognized,
    basic: true,
    createdAt: new Date().toISOString()
  };
  speakingSession.shadowAttempts.push(result);
  speakingSession.status = "ready";
  speakingSession.statusMessage = speakingSession.shadowAttempts.length >= 3 ? "三次跟读已完成，已保留最好成绩。" : "已记录本次结果；你可以再试一次，或进入复盘。";
  renderSpeakingSession();
}

async function finishSpeakingRecording(recorder, chunks, phase, aborted) {
  if (speakingSession.mediaRecorder === recorder) speakingSession.mediaRecorder = null;
  speakingSession.mediaStream?.getTracks().forEach((track) => track.stop());
  speakingSession.mediaStream = null;
  speakingSession.mediaChunks = [];
  if (aborted || !speakingSession.active) return;
  speakingSession.status = "processing";
  speakingSession.statusMessage = phase === "shadowing" ? "正在计算基础跟读结果…" : "正在把语音转换成文字…";
  renderSpeakingSession();
  try {
    const recorded = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    if (!recorded.size) throw new Error("没有录到声音，请重新说一次。" );
    const wav = await convertRecordingToWav(recorded);
    if (phase === "shadowing") await finishSpeakingShadowAttempt(wav);
    else {
      if (!deviceAIConfig.apiKey) throw new Error("当前录音识别需要智谱 API Key；也可以使用下方文字输入。" );
      const content = await requestCloudTranscription(wav);
      speakingSession.status = "ready";
      await submitSpeakingAnswer(content, false);
    }
  } catch (error) {
    speakingSession.status = "ready";
    speakingSession.statusMessage = error.message || "没有识别到清晰语音，请重试。";
    renderSpeakingSession();
  }
}

async function startSpeakingMediaRecording(phase) {
  if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) throw new Error("当前浏览器不支持录音，请使用最新版 Chrome 并允许麦克风。" );
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  if (!speakingSession.active) {
    stream.getTracks().forEach((track) => track.stop());
    return;
  }
  const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  speakingSession.mediaRecorder = recorder;
  speakingSession.mediaStream = stream;
  speakingSession.mediaChunks = chunks;
  speakingSession.abortRecording = false;
  speakingSession.status = "recording";
  speakingSession.statusMessage = phase === "shadowing" ? "正在跟读；说完后点击停止。" : "正在听你回答；说完后点击停止。";
  recorder.addEventListener("dataavailable", (event) => { if (event.data?.size) chunks.push(event.data); });
  recorder.addEventListener("stop", () => {
    const aborted = speakingSession.abortRecording;
    speakingSession.abortRecording = false;
    void finishSpeakingRecording(recorder, chunks, phase, aborted);
  }, { once: true });
  recorder.start(250);
  speakingSession.stopTimer = window.setTimeout(() => stopSpeakingRecording(false), phase === "shadowing" ? 30000 : 60000);
  renderSpeakingSession();
}

function startSpeakingBrowserRecognition() {
  const Recognition = speechRecognitionConstructor();
  if (!Recognition) throw new Error("当前浏览器不支持免费语音识别，请使用下方文字回答或在设置中选择云识别。" );
  const recognition = new Recognition();
  let finalText = "";
  speakingSession.recognition = recognition;
  speakingSession.status = "recording";
  speakingSession.statusMessage = "正在听你回答；说完后停顿一下。";
  recognition.lang = state.settings.accent || "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.addEventListener("result", (event) => {
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      if (event.results[index].isFinal) finalText += ` ${event.results[index][0]?.transcript || ""}`;
    }
  });
  recognition.addEventListener("error", (event) => {
    if (event.error === "aborted") return;
    speakingSession.status = "ready";
    speakingSession.statusMessage = event.error === "not-allowed" ? "没有麦克风权限，请在网站设置中允许。" : "没有听清，请再试一次。";
    renderSpeakingSession();
  });
  recognition.addEventListener("end", () => {
    if (speakingSession.recognition === recognition) speakingSession.recognition = null;
    speakingSession.status = "ready";
    const content = finalText.trim();
    if (content) void submitSpeakingAnswer(content, false);
    else renderSpeakingSession();
  });
  recognition.start();
  renderSpeakingSession();
}

function stopSpeakingRecording(abort = false) {
  clearTimeout(speakingSession.stopTimer);
  speakingSession.stopTimer = null;
  if (speakingSession.mediaRecorder) {
    speakingSession.abortRecording = abort;
    try { if (speakingSession.mediaRecorder.state !== "inactive") speakingSession.mediaRecorder.stop(); } catch {}
    return;
  }
  const recognition = speakingSession.recognition;
  try { abort ? recognition?.abort() : recognition?.stop(); } catch {}
}

function toggleSpeakingRecording() {
  if (!speakingSession.active || speakingSession.pending) return;
  if (speakingSession.status === "recording") return stopSpeakingRecording(false);
  const phase = speakingPhase().id;
  if (phase === "shadowing") {
    void startSpeakingMediaRecording(phase).catch((error) => {
      speakingSession.status = "ready";
      speakingSession.statusMessage = error.message || "无法启动跟读录音。";
      renderSpeakingSession();
    });
    return;
  }
  if (deviceAIConfig.speechInput === "browser") {
    try { startSpeakingBrowserRecognition(); }
    catch (error) {
      speakingSession.status = "ready";
      speakingSession.statusMessage = error.message || "无法启动语音识别。";
      renderSpeakingSession();
    }
    return;
  }
  void startSpeakingMediaRecording(phase).catch((error) => {
    speakingSession.status = "ready";
    speakingSession.statusMessage = error.message || "无法启动录音。";
    renderSpeakingSession();
  });
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
      translation: String(result.translation || ""),
      feedback: meaningfulAIFeedback(result.feedback).slice(0, 8),
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

function doubaoVoiceInstructions() {
  const current = AI_SCENARIOS[state.ai.scenario] || AI_SCENARIOS.campus;
  return `You are 蘑菇酱, a patient English speaking partner for one Chinese CET-4 learner around B1 level. Current scenario: ${current.title}. Goal: ${current.goal}. Speak mainly in clear, natural English. Keep each turn to 2–3 short sentences and no more than 45 English words. End with one short useful follow-up question. If the learner uses Chinese, briefly help them say the idea in English. Do not lecture, do not announce corrections, and do not speak Chinese unless the learner is stuck.`;
}

async function enrichDoubaoVoiceTurn(userText, replyText, assistantMessage) {
  if (aiServiceStatus !== "ready" || !userText || !replyText) return;
  try {
    const messages = currentAISession();
    const history = messages.slice(-12, -2).map(({ role, content }) => ({ role, content }));
    const result = await requestAIReply({
      scenario: state.ai.scenario,
      history,
      message: userText,
      training: { mode: "voice-review", assistantReply: replyText }
    });
    if (!messages.includes(assistantMessage)) return;
    assistantMessage.translation = String(result.translation || "").trim();
    assistantMessage.feedback = meaningfulAIFeedback(result.feedback).slice(0, 2);
    assistantMessage.vocabulary = Array.isArray(result.vocabulary) ? result.vocabulary.slice(0, 2) : [];
    saveState();
    renderAI();
  } catch {}
}

function saveDoubaoVoiceTurn() {
  const userText = String(voiceSession.doubaoUserText || "").trim();
  const replyText = String(voiceSession.doubaoReplyText || "").trim();
  if (!userText || !replyText || voiceSession.doubaoTurnSaved) return;
  voiceSession.doubaoTurnSaved = true;
  const messages = currentAISession();
  messages.push({ role: "user", content: userText, createdAt: new Date().toISOString() });
  const assistantMessage = { role: "assistant", content: replyText, translation: "", feedback: [], vocabulary: [], createdAt: new Date().toISOString() };
  messages.push(assistantMessage);
  if (messages.length > 40) messages.splice(1, messages.length - 40);
  voiceSession.transcript = `你：${userText}\nAI：${replyText}`;
  saveState();
  renderAI();
  void enrichDoubaoVoiceTurn(userText, replyText, assistantMessage);
  voiceSession.doubaoUserText = "";
  voiceSession.doubaoReplyText = "";
  voiceSession.doubaoTurnSaved = false;
}

async function startDoubaoVoiceConversation() {
  if (!syncConfig.endpoint || !syncConfig.token || !window.DoubaoRealtimeClient) return false;
  closeVoiceResources();
  voiceSession.active = true;
  voiceSession.state = "connecting";
  voiceSession.transcript = "";
  const client = new window.DoubaoRealtimeClient({
    endpoint: syncConfig.endpoint,
    token: syncConfig.token,
    systemRole: doubaoVoiceInstructions(),
    speakingStyle: "Speak warm, clear English at a calm pace suitable for a B1 learner. Keep natural pauses and never rush.",
    handlers: {
      state(value) {
        if (voiceSession.doubao !== client || !voiceSession.active) return;
        voiceSession.state = value;
        renderVoiceUI();
      },
      asr(text, final) {
        if (voiceSession.doubao !== client) return;
        voiceSession.doubaoUserText = text;
        if (final) voiceSession.doubaoTurnSaved = false;
        voiceSession.transcript = `你：${text}\nAI：${voiceSession.doubaoReplyText || "…"}`;
        renderVoiceUI();
      },
      chat(content) {
        if (voiceSession.doubao !== client) return;
        const current = voiceSession.doubaoReplyText;
        voiceSession.doubaoReplyText = content.startsWith(current) ? content : `${current}${content}`;
        voiceSession.transcript = `你：${voiceSession.doubaoUserText || "…"}\nAI：${voiceSession.doubaoReplyText}`;
        renderVoiceUI();
      },
      turnEnd() {
        if (voiceSession.doubao === client) saveDoubaoVoiceTurn();
      },
      error(error) {
        if (voiceSession.doubao === client && client.ready) failVoiceSession("豆包实时语音已断开", error.message || "请重新开始语音练习。" );
      }
    }
  });
  voiceSession.doubao = client;
  renderVoiceUI();
  try {
    await client.connect();
    return true;
  } catch (error) {
    if (voiceSession.doubao === client) closeVoiceResources();
    voiceSession.active = false;
    voiceSession.state = "idle";
    throw error;
  }
}

async function startVoiceConversation() {
  if (syncConfig.endpoint && syncConfig.token && window.DoubaoRealtimeClient) {
    try {
      if (await startDoubaoVoiceConversation()) return;
    } catch (error) {
      toast("豆包语音暂未接通", `${error.message || "实时连接失败"}；本次自动改用原有语音模式。`);
    }
  }
  if (aiServiceStatus !== "ready") {
    return failVoiceSession("AI 尚未就绪", "请先在设置中配置手机 AI，或在电脑上启动本机服务。" );
  }
  const cloudRecognition = deviceAIConfig.speechInput === "glm-asr" && deviceAIConfig.apiKey;
  if (!cloudRecognition && !speechRecognitionConstructor()) {
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
  if (!isVoiceActive()) return void startVoiceConversation();
  if (voiceSession.doubao) return finishVoiceConversation();
  if (voiceSession.mediaRecorder && voiceSession.state === "listening") return stopCloudVoiceTurn(false);
  finishVoiceConversation();
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
      translation: String(result.translation || ""),
      feedback: meaningfulAIFeedback(result.feedback).slice(0, 8),
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
  return Object.entries(state.daily)
    .filter(([, value]) => {
      const record = courseDailyRecord(value, activeCourse(), false);
      return record && ((record.focusSeconds || 0) > 0 || (record.learned || 0) > 0 || (record.screened || 0) > 0);
    })
    .map(([date]) => date)
    .sort();
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
    const record = courseDailyRecord(state.daily[key], activeCourse(), false);
    days.push({ key, label: ["日", "一", "二", "三", "四", "五", "六"][date.getDay()], minutes: Math.round((record?.focusSeconds || 0) / 60) });
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

function wordLibraryStatus(word) {
  const status = state.wordStates[word.word]?.status;
  return ["known", "fuzzy", "unknown"].includes(status) ? status : "unlearned";
}

function wordLibraryFilteredWords() {
  const query = wordLibraryState.query.trim().toLowerCase();
  return words.filter((word) => {
    const item = state.wordStates[word.word];
    const status = wordLibraryStatus(word);
    const statusMatch = wordLibraryState.status === "all"
      || (wordLibraryState.status === "learned" ? Boolean(item?.learnedAt) : status === wordLibraryState.status);
    if (!statusMatch) return false;
    if (wordLibraryState.level === "cet6" && word.level !== "CET6") return false;
    if (wordLibraryState.level === "postgrad" && word.level !== "POSTGRAD" && !word.isPostgradExtension) return false;
    if (!query) return true;
    const searchable = [word.word, word.phonetic, word.translation, word.brief, word.phrase, word.phraseMeaning]
      .filter(Boolean).join(" ").toLowerCase();
    return searchable.includes(query);
  });
}

function shortLearningDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
}

function setLibraryDetailChrome(active) {
  const panel = $("#studyPanel");
  const back = $("#closeLibraryDetail");
  const tabs = panel?.querySelector(".mode-tabs");
  if (back) back.hidden = !active;
  if (tabs) tabs.hidden = active;
  panel?.classList.toggle("library-detail", active);
}

function restoreLibraryStudySession() {
  if (!libraryStudySnapshot) {
    setLibraryDetailChrome(false);
    return;
  }
  stopWordPronunciationAssessment(true, false);
  stopPronunciationAudio();
  const snapshot = libraryStudySnapshot;
  libraryStudySnapshot = null;
  studyMode = snapshot.studyMode;
  studyQueue = snapshot.studyQueue;
  currentWordIndex = snapshot.currentWordIndex;
  currentWord = snapshot.currentWord;
  screeningSessionOffset = snapshot.screeningSessionOffset;
  stableStudyHeight = snapshot.stableStudyHeight;
  setLibraryDetailChrome(false);
  $("#studyPanel").hidden = snapshot.panelHidden;
  if (!snapshot.panelHidden && studyQueue.length) renderCurrentWord();
}

function openLibraryWordDetail(name) {
  const word = wordLookup.get(normalizedWordName(name));
  if (!word) return;
  if (!libraryStudySnapshot) {
    libraryStudySnapshot = {
      studyMode,
      studyQueue: [...studyQueue],
      currentWordIndex,
      currentWord,
      screeningSessionOffset,
      stableStudyHeight,
      panelHidden: $("#studyPanel").hidden
    };
  }
  studyMode = "library";
  studyQueue = [word];
  currentWordIndex = 0;
  screeningSessionOffset = 0;
  stableStudyHeight = 0;
  $("#wordWorkspace").style.removeProperty("min-height");
  $("#studyPanel").hidden = false;
  setLibraryDetailChrome(true);
  currentView = "today";
  renderNavigation();
  renderCurrentWord();
  $("#studyPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeLibraryWordDetail() {
  restoreLibraryStudySession();
  currentView = "words";
  renderNavigation();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderWordLibrary() {
  const list = $("#wordLibraryList");
  if (!list) return;
  const number = new Intl.NumberFormat("zh-CN");
  const counts = stateCounts();
  const learned = words.filter((word) => Boolean(state.wordStates[word.word]?.learnedAt)).length;
  $("#wordLibraryTotal").textContent = number.format(words.length);
  $("#wordLibraryOrderHint").textContent = activeCourse() === "cet6" ? "六级核心优先，其后为考研英语扩展" : "按四级考频顺序排列";
  const summaries = [
    ["全部", words.length, "all"],
    ["已背过", learned, "learned"],
    ["未学习", counts.unclassified, "unlearned"],
    ["认识", counts.known, "known"],
    ["模糊", counts.fuzzy, "fuzzy"],
    ["不认识", counts.unknown, "unknown"]
  ];
  $("#wordLibrarySummary").innerHTML = summaries.map(([label, value, filter]) => `<button type="button" data-word-summary-filter="${filter}" class="${wordLibraryState.status === filter ? "active" : ""}"><span>${label}</span><strong>${number.format(value)}</strong></button>`).join("");
  $("#wordLibrarySearch").value = wordLibraryState.query;
  $("#wordLibraryLevel").value = wordLibraryState.level;
  $$('[data-word-filter]').forEach((button) => button.classList.toggle("active", button.dataset.wordFilter === wordLibraryState.status));

  const filtered = wordLibraryFilteredWords();
  const totalPages = Math.max(1, Math.ceil(filtered.length / wordLibraryState.pageSize));
  wordLibraryState.page = Math.min(Math.max(1, wordLibraryState.page), totalPages);
  const start = (wordLibraryState.page - 1) * wordLibraryState.pageSize;
  const pageWords = filtered.slice(start, start + wordLibraryState.pageSize);
  $("#wordLibraryResultCount").textContent = `找到 ${number.format(filtered.length)} 个词${filtered.length ? ` · 显示 ${number.format(start + 1)}–${number.format(Math.min(start + wordLibraryState.pageSize, filtered.length))}` : ""}`;
  $("#wordLibraryPage").textContent = `第 ${wordLibraryState.page} / ${totalPages} 页`;
  $("#wordLibraryPageInput").value = wordLibraryState.page;
  $("#wordLibraryPageInput").max = totalPages;
  $("#wordLibraryPrev").disabled = wordLibraryState.page <= 1;
  $("#wordLibraryNext").disabled = wordLibraryState.page >= totalPages;

  const statusLabels = { unlearned: "未学习", known: "认识", fuzzy: "模糊", unknown: "不认识" };
  list.innerHTML = pageWords.length ? pageWords.map((word, offset) => {
    const item = state.wordStates[word.word];
    const status = wordLibraryStatus(word);
    const senses = wordSenseRows(word).slice(0, 2);
    const meaning = senses.map((sense) => `${sense.partOfSpeech || ""} ${sense.meaning}`.trim()).join("；");
    const levelLabel = wordLevelLabel(word);
    const isAdvanced = levelLabel !== "四级";
    const reviewed = shortLearningDate(item?.lastReviewedAt || item?.learnedAt);
    const learningMeta = item?.learnedAt ? `已背过${reviewed ? ` · 最近 ${reviewed}` : ""}` : item?.status ? "词测已判断" : "尚未开始";
    return `<article class="word-library-row">
      <span class="word-library-number">${number.format(start + offset + 1)}</span>
      <button class="word-library-word" type="button" data-word-list-open="${escapeHtml(word.word)}" aria-label="查看 ${escapeHtml(word.word)} 的详情与跟读纠音"><strong>${escapeHtml(word.word)}</strong>${word.phonetic ? `<span>/${escapeHtml(String(word.phonetic).replace(/^\/?|\/?$/g, ""))}/</span>` : ""}</button>
      <p class="word-library-meaning">${escapeHtml(meaning || word.translation || "暂无释义")}</p>
      <div class="word-library-meta"><span class="word-level-chip ${isAdvanced ? "cet6" : ""}">${levelLabel}</span><span class="word-status-chip ${status}">${statusLabels[status]}</span><small>${escapeHtml(learningMeta)}</small></div>
      <button class="word-library-speak" type="button" data-word-list-speak="${escapeHtml(word.word)}" aria-label="朗读 ${escapeHtml(word.word)}"><span class="word-library-speak-glyph" aria-hidden="true">▶</span></button>
    </article>`;
  }).join("") : `<div class="word-library-empty"><strong>没有找到符合条件的单词</strong><p>换个关键词，或选择“全部”再试试。</p></div>`;
}

function setWordLibraryFilter(status) {
  if (!["all", "learned", "unlearned", "known", "fuzzy", "unknown"].includes(status)) return;
  wordLibraryState.status = status;
  wordLibraryState.page = 1;
  renderWordLibrary();
}

function moveWordLibraryPage(amount) {
  wordLibraryState.page += amount;
  renderWordLibrary();
  $(".word-library-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function jumpWordLibraryPage() {
  const input = $("#wordLibraryPageInput");
  const requestedPage = Math.trunc(Number(input.value));
  const totalPages = Math.max(1, Math.ceil(wordLibraryFilteredWords().length / wordLibraryState.pageSize));
  wordLibraryState.page = Number.isFinite(requestedPage) ? Math.min(Math.max(1, requestedPage), totalPages) : wordLibraryState.page;
  renderWordLibrary();
  $(".word-library-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  $("#deviceAISpeechInputSelect").value = deviceAIConfig.speechInput || "glm-asr";
  $("#deviceAIVoiceSelect").value = deviceAIConfig.speechVoice || "glm-tts";
  $("#deviceAIKeyInput").placeholder = configured ? "已保存；如不修改可留空" : "只保存在这台设备的浏览器中";
  $("#clearDeviceAI").disabled = !configured;
}

async function configureDeviceAI() {
  const input = $("#deviceAIKeyInput");
  const apiKey = input.value.trim() || deviceAIConfig.apiKey;
  if (apiKey.length < 20) return toast("请填写有效的 API Key", "从智谱开放平台复制完整密钥后再保存。" );
  deviceAIConfig = {
    apiKey,
    model: $("#deviceAIModelSelect").value || DEFAULT_ZHIPU_MODEL,
    speechInput: $("#deviceAISpeechInputSelect").value || "glm-asr",
    speechVoice: $("#deviceAIVoiceSelect").value || "glm-tts"
  };
  zhipuSpeechUnavailableUntil = 0;
  zhipuSpeechFailureReason = "";
  saveDeviceAIConfig();
  input.value = "";
  await checkAIStatus();
  renderSettings();
  renderAI();
  toast("手机 AI 已配置", "语音输入与朗读设置已经生效。" );
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
    state = normalizeState(nextState);
    activateCourseWords();
    initializeWordInsightIndex();
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
    state = normalizeState(recovery);
    activateCourseWords();
    initializeWordInsightIndex();
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
  $$('[data-course-select]').forEach((select) => select.addEventListener("change", (event) => switchCourse(event.target.value)));
  $$("[data-view-target]").forEach((button) => button.addEventListener("click", () => {
    if (currentView === "ai" && button.dataset.viewTarget !== "ai") {
      if (isVoiceActive()) stopVoiceImmediately();
      if (textDictation.listening) stopTextDictation(true);
      stopShadowing(true, false);
      stopAITextSpeech();
    }
    if (currentView === "today" && button.dataset.viewTarget !== "today") stopPronunciationAudio();
    if (currentView === "today" && button.dataset.viewTarget !== "today") stopWordPronunciationAssessment(true, false);
    if (studyMode === "library") restoreLibraryStudySession();
    currentView = button.dataset.viewTarget;
    renderNavigation();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
  $("#startMission").addEventListener("click", startMissionFromState);
  $("#openVocabTest").addEventListener("click", openVocabTest);
  $("#closeVocabTest").addEventListener("click", () => $("#vocabTestDialog").close());
  $("#startVocabTest").addEventListener("click", startVocabTest);
  $("#vocabTestOptions").addEventListener("click", (event) => {
    const button = event.target.closest("[data-vocab-answer-index]");
    if (button) answerVocabTest(Number(button.dataset.vocabAnswerIndex));
  });
  $("#vocabTestUnknown").addEventListener("click", () => answerVocabTest(null));
  $("#finishVocabTest").addEventListener("click", finishVocabTest);
  $("#switchStudyMode").addEventListener("click", () => openStudy("learn"));
  $$("[data-study-mode]").forEach((button) => button.addEventListener("click", () => openStudy(button.dataset.studyMode)));
  $("#revealWord").addEventListener("click", revealCurrentWord);
  $("#wordToolTabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-word-tool]");
    if (!button || !currentWord) return;
    activeWordTool = button.dataset.wordTool;
    renderWordInsights(currentWord);
    stabilizeStudyWorkspace();
  });
  $("#speakWord").addEventListener("click", () => { void speak(currentWord?.word, { notifyFallback: true }); });
  $("#assessWordPronunciation").addEventListener("click", toggleWordPronunciationAssessment);
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
  $("#dictationPrev").addEventListener("click", () => moveDictation(-1));
  $("#dictationNext").addEventListener("click", () => moveDictation(1));
  $("#dictationCheck").addEventListener("click", () => checkDictation(false));
  $("#dictationReveal").addEventListener("click", () => checkDictation(true));
  $("#listeningWordQueue").addEventListener("click", (event) => {
    const speakButton = event.target.closest("[data-listening-speak]");
    if (speakButton) return void speak(speakButton.dataset.listeningSpeak, { notifyFallback: true });
    const reviewButton = event.target.closest("[data-listening-review]");
    if (reviewButton) reviewListeningWord(reviewButton.dataset.listeningReview, reviewButton.dataset.heard === "true");
  });
  $("#completeListening").addEventListener("click", completeListening);
  $("#openImportAudio").addEventListener("click", () => $("#audioImportDialog").showModal());
  $("#closeAudioImport").addEventListener("click", (event) => {
    event.preventDefault();
    closeAudioImportDialog();
  });
  $("#cancelAudioImport").addEventListener("click", (event) => {
    event.preventDefault();
    closeAudioImportDialog();
  });
  $("#audioImportDialog").addEventListener("cancel", (event) => {
    event.preventDefault();
    closeAudioImportDialog();
  });
  $("#audioImportDialog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeAudioImportDialog();
  });
  $("#audioImportForm").addEventListener("submit", importAudio);

  $$('[data-ai-scenario]').forEach((button) => button.addEventListener("click", () => selectAIScenario(button.dataset.aiScenario)));
  $$('[data-ai-mode]').forEach((button) => button.addEventListener("click", () => setAIMode(button.dataset.aiMode)));
  $("#aiReset").addEventListener("click", resetAIConversation);
  $("#aiMessages").addEventListener("click", (event) => {
    const button = event.target.closest("[data-ai-speak-index]");
    if (button) {
      void toggleAITextSpeech(Number(button.dataset.aiSpeakIndex));
      return;
    }
    const shadowButton = event.target.closest("[data-ai-shadow-index]");
    if (shadowButton) {
      toggleShadowing(Number(shadowButton.dataset.aiShadowIndex));
      return;
    }
    const translationButton = event.target.closest("[data-ai-translation-index]");
    if (translationButton) toggleAITranslation(Number(translationButton.dataset.aiTranslationIndex));
  });
  $("#aiVoiceTranslationToggle").addEventListener("click", (event) => {
    const index = Number(event.currentTarget.dataset.aiTranslationIndex);
    if (Number.isInteger(index)) toggleAITranslation(index);
  });
  $("#aiDictation").addEventListener("click", toggleTextDictation);
  $("#aiVoiceToggle").addEventListener("click", toggleVoiceConversation);
  $("#aiVoiceEnd").addEventListener("click", finishVoiceConversation);
  $("#speakingStart").addEventListener("click", startSpeakingSession);
  $("#speakingRecord").addEventListener("click", toggleSpeakingRecording);
  $("#speakingHint").addEventListener("click", revealSpeakingHint);
  $("#speakingNext").addEventListener("click", advanceSpeakingPhase);
  $("#speakingFinish").addEventListener("click", finishSpeakingSession);
  $("#speakingTypeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#speakingTypeInput");
    const content = input.value.trim();
    if (!content) return;
    input.value = "";
    void submitSpeakingAnswer(content, true);
  });
  $("#speakingFeedback").addEventListener("click", (event) => {
    if (!event.target.closest("[data-speaking-translation]")) return;
    speakingSession.translationVisible = !speakingSession.translationVisible;
    renderSpeakingSession();
  });
  $("#speakingShadowResult").addEventListener("click", (event) => {
    const button = event.target.closest("[data-speaking-play]");
    if (!button) return;
    const value = button.dataset.speakingPlay;
    void playSpeakingText(speakingSession.shadowSentence, value === "chunk" ? "chunk" : Number(value) || 1);
  });
  $("#aiWritingType").addEventListener("change", updateWritingLabels);
  $("#aiGenerateTranslation").addEventListener("click", () => { void generateTranslationPrompt(); });
  $("#aiWritingSubmit").addEventListener("click", () => { void submitWritingReview(); });
  $("#aiForm").addEventListener("submit", sendAIMessage);
  $("#aiInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      $("#aiForm").requestSubmit();
    }
  });

  $("#wordLibrarySearch").addEventListener("input", (event) => {
    wordLibraryState.query = event.target.value;
    wordLibraryState.page = 1;
    renderWordLibrary();
  });
  $("#wordLibraryLevel").addEventListener("change", (event) => {
    wordLibraryState.level = event.target.value;
    wordLibraryState.page = 1;
    renderWordLibrary();
  });
  $("#wordLibraryFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-word-filter]");
    if (button) setWordLibraryFilter(button.dataset.wordFilter);
  });
  $("#wordLibrarySummary").addEventListener("click", (event) => {
    const button = event.target.closest("[data-word-summary-filter]");
    if (button) setWordLibraryFilter(button.dataset.wordSummaryFilter);
  });
  $("#wordLibraryList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-word-list-speak]");
    if (button) return void speak(button.dataset.wordListSpeak, { notifyFallback: true, triggerButton: button });
    const detailButton = event.target.closest("[data-word-list-open]");
    if (detailButton) openLibraryWordDetail(detailButton.dataset.wordListOpen);
  });
  $("#closeLibraryDetail").addEventListener("click", closeLibraryWordDetail);
  $("#wordLibraryPrev").addEventListener("click", () => moveWordLibraryPage(-1));
  $("#wordLibraryNext").addEventListener("click", () => moveWordLibraryPage(1));
  $("#wordLibraryPageJump").addEventListener("submit", (event) => {
    event.preventDefault();
    jumpWordLibraryPage();
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
  window.addEventListener("beforeunload", () => { stopPronunciationAudio(); stopWordPronunciationAssessment(true, false); stopAITextSpeech(false); stopTextDictation(true); stopShadowing(true, false); stopVoiceImmediately(false); stopSpeakingResources(true); clearInterval(speakingSession.interval); persistState(); });
  window.addEventListener("online", () => scheduleCloudSync(100));
  window.addEventListener("offline", () => setSyncStatus("offline", "当前离线，记录已安全保存在本机"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleCloudSync(250);
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    state = loadState();
    activateCourseWords();
    initializeWordInsightIndex();
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
  renderWordLibrary();
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
    title: "读取今日课程计划",
    description: "读取当前课程今天的新词目标、完成量、到期复习量、筛查进度和考试倒计时，不修改学习数据。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute() {
      const record = todayRecord();
      return {
        date: localDateKey(),
        course: activeCourse(),
        courseLabel: courseLabel(),
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
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js?v=60", { updateViaCache: "none" }).catch(() => {});
  registerWebMCP();
  warnTemporaryStorageScope();
  window.setTimeout(checkBackupReminder, 900);
}

init();
