const fs = require("node:fs");

const app = fs.readFileSync("dist/app.js", "utf8");
const html = fs.readFileSync("dist/index.html", "utf8");
const server = fs.readFileSync("server.mjs", "utf8");

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
requireText(app, "For every complete sentence", "sentence-by-sentence correction contract");
requireText(html, 'data-ai-mode="writing"', "writing review mode");
requireText(html, 'id="dictationPanel"', "sentence dictation panel");
requireText(html, 'id="listeningWordQueue"', "listening SRS queue");
requireText(app, "data-ai-shadow-index", "shadowing control");
requireText(app, "listeningWordStates", "separate listening SRS state");
requireText(server, 'body.task === "writing"', "server writing review route");
requireText(html, "app.js?v=38", "v38 script cache bust");

console.log("AI contract smoke test passed");
