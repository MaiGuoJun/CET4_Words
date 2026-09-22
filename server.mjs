import http from "node:http";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readFile, stat } from "node:fs/promises";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(ROOT_DIR, "dist");

async function loadLocalEnvironment() {
  try {
    const text = await readFile(path.join(ROOT_DIR, ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator < 1) continue;
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") console.warn("Could not read .env.local:", error.message);
  }
}

await loadLocalEnvironment();

const PORT = Number(process.env.PORT) || 4174;
const MODEL = process.env.OLLAMA_MODEL || "qwen3.5:2b";
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const ZHIPU_API_KEY = String(process.env.ZHIPU_API_KEY || "").trim();
const ZHIPU_MODEL = String(process.env.ZHIPU_MODEL || "glm-5.3-flash").trim();
const ZHIPU_BASE_URL = (process.env.ZHIPU_BASE_URL || "https://open.bigmodel.cn/api/paas/v4").replace(/\/$/, "");
const MAX_BODY_BYTES = 48 * 1024;
const rateLimits = new Map();
const pronunciationCache = new Map();
const pronunciationSources = new Map();
const pronunciationAudioCache = new Map();

const SCENARIOS = {
  campus: "campus life, classes, routines, and student clubs",
  travel: "travel, transportation, directions, and accommodation",
  interview: "a friendly student-club interview and self-introduction",
  technology: "technology and education topics commonly discussed at CET-4 level",
  free: "an open-ended conversation with no fixed topic; follow whatever subject the learner chooses"
};

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg"
};

function json(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

function trimCache(cache, maximum) {
  while (cache.size > maximum) cache.delete(cache.keys().next().value);
}

function safeWikimediaUrl(value, kind = "page") {
  try {
    const url = new URL(value);
    const allowed = kind === "audio"
      ? url.hostname === "upload.wikimedia.org"
      : url.hostname.endsWith(".wikimedia.org") || url.hostname.endsWith(".wiktionary.org");
    return url.protocol === "https:" && allowed ? url.href : "";
  } catch {
    return "";
  }
}

function chooseWikimediaPronunciation(data, word, accentCode) {
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
    const audioUrl = safeWikimediaUrl(info?.url, "audio");
    if (!audioUrl) return null;
    return {
      audioUrl,
      sourceUrl: safeWikimediaUrl(info?.descriptionshorturl || info?.descriptionurl),
      licenseName: String(info?.extmetadata?.LicenseShortName?.value || "").replace(/<[^>]*>/g, "").slice(0, 80),
      accent: accentCode === "us" ? "en-US" : "en-GB",
      exact: stem === base
    };
  }).filter(Boolean);
  candidates.sort((left, right) => Number(right.exact) - Number(left.exact));
  return candidates[0] || null;
}

async function fetchWikimediaPronunciation(word, accentCode) {
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
  try {
    const upstream = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": "MoguCET4/1.0 personal-learning-app" },
      signal: AbortSignal.timeout(8000)
    });
    if (!upstream.ok) return null;
    return chooseWikimediaPronunciation(await upstream.json(), word, accentCode);
  } catch {
    return null;
  }
}

async function findPronunciation(word, accent) {
  const key = `${accent}:${word}`;
  if (pronunciationCache.has(key)) return pronunciationCache.get(key);
  const request = (async () => {
    const preferred = accent === "en-GB" ? "uk" : "us";
    const alternate = preferred === "us" ? "uk" : "us";
    const preferredRequest = fetchWikimediaPronunciation(word, preferred);
    const alternateRequest = fetchWikimediaPronunciation(word, alternate);
    const clip = (await preferredRequest) || (await alternateRequest);
    if (!clip) return null;
    const token = createHash("sha256").update(clip.audioUrl).digest("hex").slice(0, 24);
    pronunciationSources.set(token, clip.audioUrl);
    trimCache(pronunciationSources, 250);
    return { audio: `/api/pronunciation-audio/${token}`, sourceUrl: clip.sourceUrl, licenseName: clip.licenseName, accent: clip.accent };
  })();
  pronunciationCache.set(key, request);
  const result = await request;
  if (result) {
    pronunciationCache.set(key, result);
    trimCache(pronunciationCache, 250);
  } else {
    pronunciationCache.delete(key);
  }
  return result;
}

async function handlePronunciation(response, requestUrl) {
  const word = String(requestUrl.searchParams.get("word") || "").trim().toLowerCase();
  const accent = requestUrl.searchParams.get("accent") === "en-GB" ? "en-GB" : "en-US";
  if (!/^[a-z][a-z' -]{0,60}$/i.test(word)) return json(response, 400, { error: "Invalid word" });
  const result = await findPronunciation(word, accent);
  return result ? json(response, 200, result) : json(response, 404, { error: "No recording found" });
}

async function loadPronunciationAudio(token) {
  if (pronunciationAudioCache.has(token)) return pronunciationAudioCache.get(token);
  const sourceUrl = pronunciationSources.get(token);
  if (!sourceUrl) return null;
  const request = (async () => {
    const upstream = await fetch(sourceUrl, {
      headers: { "User-Agent": "MoguCET4/1.0 personal-learning-app" },
      signal: AbortSignal.timeout(12000)
    });
    if (!upstream.ok) throw new Error(`audio status ${upstream.status}`);
    const contentType = upstream.headers.get("content-type") || "audio/ogg";
    if (!/^(audio\/|application\/ogg)/i.test(contentType)) throw new Error("unexpected audio type");
    const data = Buffer.from(await upstream.arrayBuffer());
    if (!data.length || data.length > 4 * 1024 * 1024) throw new Error("unexpected audio size");
    return { data, contentType };
  })();
  pronunciationAudioCache.set(token, request);
  try {
    const audio = await request;
    pronunciationAudioCache.set(token, audio);
    trimCache(pronunciationAudioCache, 60);
    return audio;
  } catch (error) {
    pronunciationAudioCache.delete(token);
    throw error;
  }
}

async function handlePronunciationAudio(request, response, token) {
  if (!/^[a-f0-9]{24}$/.test(token)) return json(response, 404, { error: "Recording not found" });
  try {
    const audio = await loadPronunciationAudio(token);
    if (!audio) return json(response, 404, { error: "Recording expired; request the word again" });
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range || "");
    const headers = { "Content-Type": audio.contentType, "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=604800" };
    if (range) {
      const start = range[1] ? Math.min(Number(range[1]), audio.data.length - 1) : 0;
      const end = range[2] ? Math.min(Number(range[2]), audio.data.length - 1) : audio.data.length - 1;
      if (start > end) {
        response.writeHead(416, { "Content-Range": `bytes */${audio.data.length}` });
        return response.end();
      }
      const body = audio.data.subarray(start, end + 1);
      response.writeHead(206, { ...headers, "Content-Length": body.length, "Content-Range": `bytes ${start}-${end}/${audio.data.length}` });
      return response.end(request.method === "HEAD" ? undefined : body);
    }
    response.writeHead(200, { ...headers, "Content-Length": audio.data.length });
    return response.end(request.method === "HEAD" ? undefined : audio.data);
  } catch (error) {
    console.error("Pronunciation audio failed:", error.message);
    return json(response, 502, { error: "Recording temporarily unavailable" });
  }
}

function allowRequest(request) {
  const address = request.socket.remoteAddress || "local";
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const recent = (rateLimits.get(address) || []).filter((time) => now - time < windowMs);
  if (recent.length >= 30) return false;
  recent.push(now);
  rateLimits.set(address, recent);
  return true;
}

async function readBody(request, maxBytes = MAX_BODY_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonBody(request) {
  return JSON.parse((await readBody(request)) || "{}");
}

function parseTutorReply(text) {
  const cleaned = String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  try {
    const result = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
    return {
      reply: String(result.reply || "").slice(0, 1200),
      feedback: Array.isArray(result.feedback) ? result.feedback.map((item) => ({
        original: String(item?.original || "").slice(0, 300),
        correction: String(item?.correction || "").slice(0, 300),
        reason: String(item?.reason || "").slice(0, 300)
      })).filter((item) => item.correction).slice(0, 2) : [],
      vocabulary: Array.isArray(result.vocabulary) ? result.vocabulary.map((item) => ({
        word: String(item?.word || "").slice(0, 80),
        meaning: String(item?.meaning || "").slice(0, 160),
        example: String(item?.example || "").slice(0, 300)
      })).filter((item) => item.word).slice(0, 2) : []
    };
  } catch {
    return { reply: cleaned.slice(0, 1200), feedback: [], vocabulary: [] };
  }
}

async function requestZhipu(messages) {
  const upstream = await fetch(`${ZHIPU_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ZHIPU_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: ZHIPU_MODEL,
      messages,
      stream: false,
      thinking: { type: "enabled", clear_thinking: false },
      response_format: { type: "json_object" },
      temperature: 1,
      top_p: 0.95,
      max_tokens: 2048
    }),
    signal: AbortSignal.timeout(60000)
  });
  if (!upstream.ok) throw new Error(`ZHIPU_HTTP_${upstream.status}`);
  const data = await upstream.json();
  const choice = data?.choices?.[0];
  const rawContent = choice?.message?.content;
  const content = Array.isArray(rawContent)
    ? rawContent.map((item) => typeof item === "string" ? item : String(item?.text || item?.content || "")).join("")
    : rawContent;
  if (!content) {
    const reasoningLength = String(choice?.message?.reasoning_content || "").length;
    throw new Error(`ZHIPU_EMPTY_REPLY_${choice?.finish_reason || "unknown"}_REASONING_${reasoningLength}`);
  }
  return { content, provider: "zhipu", model: String(data?.model || ZHIPU_MODEL) };
}

async function requestOllama(messages) {
  const upstream = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
      think: false,
      format: "json",
      keep_alive: "10m",
      options: { temperature: 0.55, num_predict: 360 }
    }),
    signal: AbortSignal.timeout(120000)
  });
  if (!upstream.ok) throw new Error(`OLLAMA_HTTP_${upstream.status}`);
  const data = await upstream.json();
  if (!data?.message?.content) throw new Error("OLLAMA_EMPTY_REPLY");
  return { content: data.message.content, provider: "ollama", model: MODEL };
}

async function handleAIChat(request, response) {
  if (!allowRequest(request)) return json(response, 429, { error: "请求有点频繁，请稍等几分钟再继续练习。" });

  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return json(response, error.message === "PAYLOAD_TOO_LARGE" ? 413 : 400, { error: "对话内容格式不正确或过长。" });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const scenario = SCENARIOS[body.scenario] ? body.scenario : "campus";
  if (!message || message.length > 1000) return json(response, 400, { error: "请输入 1–1000 个字符后再发送。" });
  const history = Array.isArray(body.history) ? body.history.slice(-12).flatMap((item) => {
    const role = item?.role === "assistant" ? "assistant" : item?.role === "user" ? "user" : null;
    const content = typeof item?.content === "string" ? item.content.trim().slice(0, 1200) : "";
    return role && content ? [{ role, content }] : [];
  }) : [];

  const instructions = `You are the private English tutor inside 蘑菇酱四级 for one Chinese learner preparing for CET-4 and aiming for 500+. The learner is around B1 and wants practical conversation plus gentle correction. The current scenario is ${SCENARIOS[scenario]}.

Keep the conversation natural and encouraging, but do not give empty praise. Reply mainly in simple, natural English suitable for CET-4. If the learner writes Chinese, help them express that idea in English and continue the conversation. Correct only the one or two mistakes that matter most. Use two to four short sentences, keep the reply under 70 English words, and end directly with exactly one useful follow-up question. Do not introduce the question with labels such as "Ask:" or "Question:".

Return only a valid JSON object with this shape: {"reply":"English reply","feedback":[{"original":"learner wording","correction":"natural correction","reason":"brief Chinese explanation"}],"vocabulary":[{"word":"useful word or phrase","meaning":"brief Chinese meaning","example":"short English example"}]}. Use empty arrays when there is nothing useful to add. Include at most two feedback items and two vocabulary items.`;

  const messages = [{ role: "system", content: instructions }, ...history, { role: "user", content: message }];
  const failures = [];
  try {
    let completion;
    if (ZHIPU_API_KEY) {
      try {
        completion = await requestZhipu(messages);
      } catch (error) {
        failures.push(error);
        console.error("Zhipu request failed; trying local fallback:", error.message);
      }
    }
    if (!completion) completion = await requestOllama(messages);
    const result = parseTutorReply(completion.content);
    if (!result.reply) return json(response, 502, { error: "AI 没有生成有效回复，请再试一次。" });
    return json(response, 200, { ...result, provider: completion.provider, model: completion.model });
  } catch (error) {
    failures.push(error);
    console.error("All AI providers failed:", failures.map((item) => item.message).join(", "));
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return json(response, 502, {
      error: timedOut
        ? "AI 回复超时，请稍后再试。"
        : ZHIPU_API_KEY
          ? "智谱暂时不可用，本地备用模型也未能连接。"
          : "无法连接本地 AI，请确认 Ollama 已安装并正在运行。"
    });
  }
}

async function getLocalAIStatus() {
  let local = { configured: false, running: false, modelInstalled: false };
  try {
    const upstream = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (!upstream.ok) throw new Error(`status ${upstream.status}`);
    const data = await upstream.json();
    const modelNames = Array.isArray(data.models) ? data.models.map((item) => String(item?.name || item?.model || "")) : [];
    const installed = modelNames.some((name) => name === MODEL || name === `${MODEL}:latest`);
    local = { configured: installed, running: true, modelInstalled: installed };
  } catch {}
  if (ZHIPU_API_KEY) {
    return {
      configured: true,
      provider: "zhipu",
      model: ZHIPU_MODEL,
      running: true,
      modelInstalled: true,
      fallback: { provider: "ollama", model: MODEL, ...local },
      voiceMode: "browser"
    };
  }
  return { ...local, provider: "ollama", model: MODEL, voiceMode: "browser" };
}

async function serveStatic(request, response, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }
  if (pathname === "/") pathname = "/index.html";
  let filePath = path.resolve(DIST_DIR, `.${pathname}`);
  if (filePath !== DIST_DIR && !filePath.startsWith(`${DIST_DIR}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, "index.html");
    const content = await readFile(filePath);
    const headers = {
      "Content-Type": CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": path.extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600"
    };
    response.writeHead(200, headers);
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  if (["GET", "HEAD"].includes(request.method || "") && requestUrl.pathname === "/api/pronunciation") {
    return handlePronunciation(response, requestUrl);
  }
  if (["GET", "HEAD"].includes(request.method || "") && requestUrl.pathname.startsWith("/api/pronunciation-audio/")) {
    return handlePronunciationAudio(request, response, requestUrl.pathname.slice("/api/pronunciation-audio/".length));
  }
  if (request.method === "GET" && requestUrl.pathname === "/api/ai-status") {
    return json(response, 200, await getLocalAIStatus());
  }
  if (request.method === "POST" && requestUrl.pathname === "/api/ai-chat") return handleAIChat(request, response);
  if (!["GET", "HEAD"].includes(request.method || "")) return json(response, 405, { error: "Method not allowed" });
  return serveStatic(request, response, requestUrl);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`蘑菇酱四级已启动：http://127.0.0.1:${PORT}/`);
  console.log(ZHIPU_API_KEY
    ? `AI：智谱 / ${ZHIPU_MODEL}（本地备用：Ollama / ${MODEL}）`
    : `AI：Ollama / ${MODEL}`);
});
