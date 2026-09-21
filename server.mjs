import http from "node:http";
import path from "node:path";
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
const MAX_BODY_BYTES = 48 * 1024;
const rateLimits = new Map();

const SCENARIOS = {
  campus: "campus life, classes, routines, and student clubs",
  travel: "travel, transportation, directions, and accommodation",
  interview: "a friendly student-club interview and self-introduction",
  technology: "technology and education topics commonly discussed at CET-4 level"
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

Keep the conversation natural and encouraging, but do not give empty praise. Reply mainly in simple, natural English suitable for CET-4. If the learner writes Chinese, help them express that idea in English and continue the scene. Correct only the one or two mistakes that matter most. Use two to four short sentences, keep the reply under 70 English words, and end directly with exactly one useful follow-up question. Do not introduce the question with labels such as "Ask:" or "Question:".

Return only a valid JSON object with this shape: {"reply":"English reply","feedback":[{"original":"learner wording","correction":"natural correction","reason":"brief Chinese explanation"}],"vocabulary":[{"word":"useful word or phrase","meaning":"brief Chinese meaning","example":"short English example"}]}. Use empty arrays when there is nothing useful to add. Include at most two feedback items and two vocabulary items.`;

  try {
    const upstream = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: instructions }, ...history, { role: "user", content: message }],
        stream: false,
        think: false,
        format: "json",
        keep_alive: "10m",
        options: { temperature: 0.55, num_predict: 360 }
      }),
      signal: AbortSignal.timeout(120000)
    });
    if (!upstream.ok) {
      console.error(`Ollama request failed with status ${upstream.status}`);
      const safeMessage = upstream.status === 404
        ? `本地模型 ${MODEL} 尚未下载，请先运行 ollama pull ${MODEL}。`
        : "本地 AI 暂时不可用，请确认 Ollama 正在运行。";
      return json(response, 502, { error: safeMessage });
    }
    const data = await upstream.json();
    const result = parseTutorReply(data?.message?.content);
    if (!result.reply) return json(response, 502, { error: "AI 没有生成有效回复，请再试一次。" });
    return json(response, 200, result);
  } catch (error) {
    console.error("Ollama connection failed:", error.message);
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return json(response, 502, { error: timedOut ? "本地 AI 回复超时，请稍后再试。" : "无法连接本地 AI，请确认 Ollama 已安装并正在运行。" });
  }
}

async function getLocalAIStatus() {
  try {
    const upstream = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (!upstream.ok) throw new Error(`status ${upstream.status}`);
    const data = await upstream.json();
    const modelNames = Array.isArray(data.models) ? data.models.map((item) => String(item?.name || item?.model || "")) : [];
    const installed = modelNames.some((name) => name === MODEL || name === `${MODEL}:latest`);
    return { configured: installed, provider: "ollama", model: MODEL, running: true, modelInstalled: installed, voiceMode: "browser" };
  } catch {
    return { configured: false, provider: "ollama", model: MODEL, running: false, modelInstalled: false, voiceMode: "browser" };
  }
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
  if (request.method === "GET" && requestUrl.pathname === "/api/ai-status") {
    return json(response, 200, await getLocalAIStatus());
  }
  if (request.method === "POST" && requestUrl.pathname === "/api/ai-chat") return handleAIChat(request, response);
  if (!["GET", "HEAD"].includes(request.method || "")) return json(response, 405, { error: "Method not allowed" });
  return serveStatic(request, response, requestUrl);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`蘑菇酱四级已启动：http://127.0.0.1:${PORT}/`);
  console.log(`本地 AI：Ollama / ${MODEL}`);
});
