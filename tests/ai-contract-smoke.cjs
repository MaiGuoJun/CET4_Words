const fs = require("node:fs");

const app = fs.readFileSync("dist/app.js", "utf8");
const html = fs.readFileSync("dist/index.html", "utf8");
const server = fs.readFileSync("server.mjs", "utf8");
const doubao = fs.readFileSync("dist/doubao-realtime.js", "utf8");
const worker = fs.readFileSync("cloudflare/src/worker.mjs", "utf8");

const requireText = (source, text, label) => {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
};

if (/glm-4-voice|data-word-tool="mnemonic"/.test(`${app}\n${html}`)) {
  throw new Error("Legacy conversational voice or mnemonic UI is still present");
}

requireText(app, "https://open.bigmodel.cn/api/paas/v4/audio/speech", "official GLM-TTS endpoint");
requireText(app, 'model: "glm-tts"', "GLM-TTS model");
requireText(app, "input: content", "exact displayed reply as TTS input");
requireText(app, 'response_format: "wav"', "non-streaming WAV response");
requireText(app, '"translation":"complete natural Chinese translation of reply"', "browser translation contract");
requireText(server, '"translation":"complete natural Chinese translation of reply"', "server translation contract");
requireText(app, "Never claim that you are text-only", "voice capability instruction");
requireText(html, 'id="aiVoiceTranslationToggle" hidden', "collapsed voice translation control");
requireText(app, "omit natural/correct sentences completely", "errors-only correction contract");
requireText(app, "meaningfulAIFeedback", "correct-feedback filter");
requireText(server, "saysCorrect", "server correct-feedback filter");
requireText(app, "startCloudVoiceListening", "mobile cloud voice conversation recorder");
requireText(html, 'id="aiVoiceEnd"', "voice conversation end control");
requireText(html, 'data-ai-mode="writing"', "writing review mode");
requireText(html, 'id="dictationPanel"', "sentence dictation panel");
requireText(html, 'id="listeningWordQueue"', "listening SRS queue");
requireText(app, "data-ai-shadow-index", "shadowing control");
requireText(app, "listeningWordStates", "separate listening SRS state");
requireText(server, 'body.task === "writing"', "server writing review route");
requireText(server, 'body.task === "translation-prompt"', "server translation prompt route");
requireText(html, 'id="aiGenerateTranslation"', "AI translation prompt generator");
requireText(app, "generateTranslationPrompt", "browser translation prompt flow");
requireText(app, "between 135 and 155 Chinese Han characters", "CET4 translation prompt length guard");
requireText(app, "comparePronunciationAudio", "acoustic pronunciation comparison");
requireText(app, "scoreStandaloneRhythm", "no-TTS shadowing rhythm fallback");
requireText(app, "基础跟读分", "basic shadowing score label");
requireText(app, "openLibraryWordDetail", "word library detail entry");
requireText(app, "data-word-list-open", "clickable word library rows");
requireText(html, 'id="closeLibraryDetail"', "word detail return control");
requireText(html, 'id="closeAudioImport"', "audio import close control");
requireText(html, 'id="cancelAudioImport"', "audio import cancel control");
requireText(app, "closeAudioImportDialog", "audio import dismiss handler");
requireText(html, 'id="closeAudioImport" value="cancel" formnovalidate', "native audio import close fallback");
requireText(app, "fetchZhipuWordPronunciation", "Zhipu word pronunciation fallback");
requireText(app, "renderPhonemeAssessment", "phoneme score rendering");
requireText(app, "/word-audio", "Cloudflare pronunciation audio proxy");
requireText(app, 'if (listened) return openStudy("review")', "completed-day review action");
requireText(app, 'if (mode === "review")', "review group queue");
requireText(app, "soundScore", "acoustic score component");
requireText(app, "rhythmScore", "rhythm score component");
requireText(html, 'id="assessWordPronunciation"', "word pronunciation assessment control");
requireText(html, 'class="word-pronunciation-practice"', "fixed word pronunciation practice area");
requireText(app, "settleWithin(getPronunciationClip(text), 7000, null)", "mobile pronunciation timeout fallback");
requireText(app, "中文提示：${primaryTestMeaning(currentWord)}", "audio quiz Chinese meaning hint");
requireText(app, "const canTranslate = Boolean(latest?.translation)", "always-available voice translation control");
requireText(html, 'data-ai-mode="speaking"', "dedicated speaking mode");
requireText(html, 'id="aiSpeakingPanel"', "15-minute speaking panel");
requireText(html, 'id="speakingPhaseTrack"', "speaking phase progress");
requireText(html, 'id="speakingTypeForm"', "speaking typed fallback");
requireText(app, "const SPEAKING_PHASES", "structured speaking phases");
requireText(app, "totalActiveSeconds", "active speaking timer");
requireText(app, "if (!speakingSession.active || speakingSession.pending || speakingSession.status === \"processing\") return", "paused AI wait time");
requireText(app, 'training: { mode: "speaking", phase, prompt: shownPrompt, retry: retrying }', "speaking training request context");
requireText(app, "speakingSession.conversationTurns >= 6", "six-turn scenario target");
requireText(app, "speakingSession.shadowAttempts.length >= 3", "three-attempt shadowing limit");
requireText(app, "这里不会把普通语音识别冒充音素评分", "honest shadowing score label");
requireText(app, "data-speaking-translation", "collapsed speaking translation");
requireText(server, 'body.training?.mode === "speaking"', "backend speaking contract");
requireText(app, 'training: { mode: "voice-review", assistantReply: replyText }', "voice-turn Zhipu review");
requireText(app, "startDoubaoVoiceConversation", "Doubao real-time voice preference");
requireText(app, "ensureDoubaoRealtimeClient", "Doubao client recovery loader");
requireText(app, "豆包实时语音连接失败", "visible Doubao connection failure");
requireText(doubao, "class DoubaoRealtimeClient", "Doubao browser client");
requireText(doubao, "downsampleToPcm16", "16 kHz PCM microphone stream");
requireText(doubao, "EVENTS.TTS_RESPONSE", "streaming Doubao audio playback");
requireText(worker, 'url.pathname === "/voice-session"', "short-lived Doubao voice ticket");
requireText(worker, 'url.pathname === "/doubao-realtime"', "Doubao WebSocket gateway");
requireText(worker, 'headers["X-Api-Key"] = apiKey', "new Doubao API key authentication");
requireText(worker, '"X-Api-Access-Key"', "server-side Doubao credentials");
requireText(html, "doubao-realtime.js?v=61", "v61 Doubao client cache bust");
requireText(html, "app.js?v=61", "v61 script cache bust");

console.log("AI contract smoke test passed");
