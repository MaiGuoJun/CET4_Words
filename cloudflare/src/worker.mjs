const MAX_STATE_BYTES = 1_800_000;
const MAX_AUDIO_BYTES = 2_500_000;
const DOUBAO_DIALOGUE_URL = "https://openspeech.bytedance.com/api/v3/realtime/dialogue";
const DOUBAO_RESOURCE_ID = "volc.speech.dialog";
const DOUBAO_APP_KEY = "PlgvMymc7f3tQnJ6";
const VOICE_TICKET_LIFETIME_SECONDS = 45;
const DEFAULT_ORIGINS = [
  "https://maiguojun.github.io",
  "http://127.0.0.1:4174",
  "http://localhost:4174"
];

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return "*";
  const configured = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if ([...DEFAULT_ORIGINS, ...configured].includes(origin)) return origin;
  try {
    const url = new URL(origin);
    if (url.protocol === "https:" && url.hostname.endsWith(".ts.net")) return origin;
  } catch {}
  return "";
}

function responseHeaders(request, env) {
  const origin = allowedOrigin(request, env);
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...(origin ? {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
      "Access-Control-Expose-Headers": "X-Pronunciation-Kind, X-Pronunciation-Accent, X-Pronunciation-Source, X-Pronunciation-License",
      Vary: "Origin"
    } : {})
  };
}

function audioResponse(request, env, status, body, metadata = {}) {
  const headers = responseHeaders(request, env);
  headers["Content-Type"] = metadata.contentType || "audio/mpeg";
  headers["Cache-Control"] = "private, max-age=86400";
  if (metadata.kind) headers["X-Pronunciation-Kind"] = metadata.kind;
  if (metadata.accent) headers["X-Pronunciation-Accent"] = metadata.accent;
  if (metadata.sourceUrl) headers["X-Pronunciation-Source"] = metadata.sourceUrl;
  if (metadata.licenseName) headers["X-Pronunciation-License"] = metadata.licenseName;
  return new Response(body, { status, headers });
}

function json(request, env, status, value) {
  return new Response(JSON.stringify(value), { status, headers: responseHeaders(request, env) });
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function authorized(request, env) {
  const header = request.headers.get("Authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided || !env.SYNC_SECRET) return false;
  const [left, right] = await Promise.all([digest(provided), digest(env.SYNC_SECRET)]);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    difference |= (left[index] || 0) ^ (right[index] || 0);
  }
  return difference === 0;
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function voiceTicketSignature(payload, env) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(env.SYNC_SECRET || "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, payload));
}

async function createVoiceTicket(env) {
  const payload = new TextEncoder().encode(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + VOICE_TICKET_LIFETIME_SECONDS,
    nonce: crypto.randomUUID()
  }));
  const signature = await voiceTicketSignature(payload, env);
  return `${base64UrlEncode(payload)}.${base64UrlEncode(signature)}`;
}

async function validVoiceTicket(ticket, env) {
  try {
    const [payloadPart, signaturePart, extra] = String(ticket || "").split(".");
    if (!payloadPart || !signaturePart || extra || !env.SYNC_SECRET) return false;
    const payload = base64UrlDecode(payloadPart);
    const provided = base64UrlDecode(signaturePart);
    const expected = await voiceTicketSignature(payload, env);
    if (provided.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) difference |= expected[index] ^ provided[index];
    if (difference) return false;
    const claims = JSON.parse(new TextDecoder().decode(payload));
    const now = Math.floor(Date.now() / 1000);
    return Number.isFinite(claims?.exp) && claims.exp >= now && claims.exp <= now + VOICE_TICKET_LIFETIME_SECONDS + 5;
  } catch {
    return false;
  }
}

function doubaoConfigured(env) {
  const apiKey = String(env.DOUBAO_API_KEY || "").trim();
  const legacy = String(env.DOUBAO_APP_ID || "").trim() && String(env.DOUBAO_ACCESS_TOKEN || "").trim();
  return Boolean(apiKey || legacy);
}

async function issueVoiceSession(request, env) {
  if (!doubaoConfigured(env)) return json(request, env, 503, { error: "豆包实时语音尚未配置" });
  const probe = await openDoubaoRealtime(env);
  if (!probe.upstream?.webSocket) {
    console.error("Doubao voice preflight rejected", JSON.stringify({ requestId: probe.requestId, status: probe.status, detail: probe.detail }));
    return json(request, env, 502, {
      error: doubaoHandshakeError(probe.status),
      requestId: probe.requestId
    });
  }
  try { probe.upstream.webSocket.close(1000, "preflight-complete"); } catch {}
  const ticket = await createVoiceTicket(env);
  const url = new URL(request.url);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/doubao-realtime";
  url.search = new URLSearchParams({ ticket }).toString();
  return json(request, env, 200, {
    websocketUrl: url.toString(),
    expiresIn: VOICE_TICKET_LIFETIME_SECONDS,
    provider: "doubao-s2s-omni"
  });
}

function doubaoHandshakeError(status) {
  if (status === 401) return "豆包 API Key 无效或已失效（401）";
  if (status === 403) return "豆包 API Key 没有开通端到端实时语音权限（403）";
  if (status === 429) return "豆包实时语音额度或并发已达到上限（429）";
  return `豆包实时语音握手被拒绝（${status || "网络错误"}）`;
}

async function openDoubaoRealtime(env) {
  const apiKey = String(env.DOUBAO_API_KEY || "").trim();
  const requestId = crypto.randomUUID();
  const headers = {
    Upgrade: "websocket",
    "X-Api-Resource-Id": DOUBAO_RESOURCE_ID,
    "X-Api-Request-Id": requestId,
    "X-Api-Connect-Id": requestId
  };
  if (apiKey) headers["X-Api-Key"] = apiKey;
  else {
    headers["X-Api-App-ID"] = String(env.DOUBAO_APP_ID).trim();
    headers["X-Api-Access-Key"] = String(env.DOUBAO_ACCESS_TOKEN).trim();
    headers["X-Api-App-Key"] = DOUBAO_APP_KEY;
  }
  try {
    const upstream = await fetch(DOUBAO_DIALOGUE_URL, { headers });
    const detail = upstream.webSocket ? "" : String(await upstream.text().catch(() => "")).slice(0, 800);
    return { upstream, requestId, status: upstream.status, detail };
  } catch (error) {
    return { upstream: null, requestId, status: 0, detail: String(error?.message || error || "").slice(0, 800) };
  }
}

async function proxyDoubaoRealtime(request, env, url) {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return json(request, env, 426, { error: "Expected WebSocket upgrade" });
  }
  if (!doubaoConfigured(env)) return json(request, env, 503, { error: "豆包实时语音尚未配置" });
  if (!await validVoiceTicket(url.searchParams.get("ticket"), env)) {
    return json(request, env, 401, { error: "语音连接票据无效或已过期" });
  }
  const connection = await openDoubaoRealtime(env);
  if (!connection.upstream?.webSocket) {
    console.error("Doubao WebSocket handshake rejected", JSON.stringify({ requestId: connection.requestId, status: connection.status, detail: connection.detail }));
    return json(request, env, 502, { error: doubaoHandshakeError(connection.status), requestId: connection.requestId });
  }
  return connection.upstream;
}

function parseRow(row) {
  if (!row) return { revision: 0, updatedAt: null, state: null, deviceId: null };
  try {
    return {
      revision: Number(row.revision) || 0,
      updatedAt: row.updated_at || null,
      state: JSON.parse(row.payload),
      deviceId: row.device_id || null
    };
  } catch {
    return { revision: Number(row.revision) || 0, updatedAt: row.updated_at || null, state: null, deviceId: row.device_id || null };
  }
}

async function currentState(env) {
  const row = await env.DB.prepare("SELECT revision, updated_at, payload, device_id FROM sync_state WHERE id = 1").first();
  return parseRow(row);
}

function validState(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && value.settings && typeof value.settings === "object"
    && value.wordStates && typeof value.wordStates === "object" && !Array.isArray(value.wordStates);
}

function safeAudioUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function pronunciationAccent(value) {
  const clue = String(value || "").toLowerCase();
  if (/(?:^|[\/_-])(us|usa|american)(?:[\/_.-]|$)/.test(clue)) return "en-US";
  if (/(?:^|[\/_-])(uk|gb|british)(?:[\/_.-]|$)/.test(clue)) return "en-GB";
  return "";
}

function chooseDictionaryPronunciation(entries, preferredAccent) {
  const clips = (Array.isArray(entries) ? entries : []).flatMap((entry) => (
    Array.isArray(entry?.phonetics) ? entry.phonetics : []
  )).map((phonetic) => ({
    audioUrl: safeAudioUrl(phonetic?.audio),
    sourceUrl: safeAudioUrl(phonetic?.sourceUrl),
    licenseName: String(phonetic?.license?.name || "").replace(/[^\x20-\x7E]/g, "").slice(0, 80),
    accent: pronunciationAccent([phonetic?.audio, phonetic?.sourceUrl, phonetic?.text].filter(Boolean).join(" "))
  })).filter((clip) => clip.audioUrl);
  clips.sort((left, right) => {
    const score = (clip) => clip.accent === preferredAccent ? 3 : clip.accent ? 1 : 2;
    return score(right) - score(left);
  });
  return clips[0] || null;
}

async function fetchDictionaryPronunciation(word, accent) {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      headers: { "User-Agent": "MoguCET4/1.0 personal-learning-app" },
      signal: AbortSignal.timeout(6500)
    });
    if (!response.ok) return null;
    return chooseDictionaryPronunciation(await response.json(), accent);
  } catch {
    return null;
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
    const audioUrl = safeAudioUrl(info?.url);
    if (!audioUrl || new URL(audioUrl).hostname !== "upload.wikimedia.org") return null;
    return {
      audioUrl,
      sourceUrl: safeAudioUrl(info?.descriptionshorturl || info?.descriptionurl),
      licenseName: String(info?.extmetadata?.LicenseShortName?.value || "").replace(/<[^>]*>/g, "").replace(/[^\x20-\x7E]/g, "").slice(0, 80),
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
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": "MoguCET4/1.0 personal-learning-app" },
      signal: AbortSignal.timeout(6500)
    });
    if (!response.ok) return null;
    return chooseWikimediaPronunciation(await response.json(), word, accentCode);
  } catch {
    return null;
  }
}

async function loadRemoteAudio(clip) {
  if (!clip?.audioUrl) return null;
  try {
    const audioUrl = new URL(clip.audioUrl);
    const allowedHost = audioUrl.hostname === "upload.wikimedia.org"
      || audioUrl.hostname === "dictionaryapi.dev"
      || audioUrl.hostname.endsWith(".dictionaryapi.dev");
    if (audioUrl.protocol !== "https:" || !allowedHost) return null;
    const response = await fetch(clip.audioUrl, {
      headers: { "User-Agent": "MoguCET4/1.0 personal-learning-app" },
      signal: AbortSignal.timeout(9000)
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("Content-Type") || "audio/mpeg";
    if (!/^(audio\/|application\/ogg)/i.test(contentType)) return null;
    const body = await response.arrayBuffer();
    if (!body.byteLength || body.byteLength > MAX_AUDIO_BYTES) return null;
    return { body, contentType };
  } catch {
    return null;
  }
}

function azureSpeechRegion(env) {
  const region = String(env.AZURE_SPEECH_REGION || "").trim().toLowerCase();
  return /^[a-z0-9-]{2,40}$/.test(region) ? region : "";
}

function xmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
}

async function synthesizeAzureWord(word, accent, env) {
  const region = azureSpeechRegion(env);
  if (!region || !env.AZURE_SPEECH_KEY) return null;
  const locale = accent === "en-GB" ? "en-GB" : "en-US";
  const voice = locale === "en-GB" ? "en-GB-SoniaNeural" : "en-US-JennyNeural";
  const ssml = `<speak version="1.0" xml:lang="${locale}"><voice name="${voice}"><prosody rate="-12%">${xmlEscape(word)}</prosody></voice></speak>`;
  try {
    const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "MoguCET4"
      },
      body: ssml,
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) return null;
    const body = await response.arrayBuffer();
    return body.byteLength && body.byteLength <= MAX_AUDIO_BYTES ? { body, contentType: "audio/mpeg" } : null;
  } catch {
    return null;
  }
}

async function handleWordAudio(request, env, url) {
  const word = String(url.searchParams.get("word") || "").trim().toLowerCase();
  const accent = url.searchParams.get("accent") === "en-GB" ? "en-GB" : "en-US";
  if (!/^[a-z][a-z' -]{0,60}$/i.test(word)) return json(request, env, 400, { error: "单词格式不正确" });
  const preferred = accent === "en-GB" ? "uk" : "us";
  const alternate = preferred === "us" ? "uk" : "us";
  const dictionary = await fetchDictionaryPronunciation(word, accent);
  const humanClip = dictionary || await fetchWikimediaPronunciation(word, preferred) || await fetchWikimediaPronunciation(word, alternate);
  const humanAudio = await loadRemoteAudio(humanClip);
  if (humanAudio) return audioResponse(request, env, 200, humanAudio.body, { ...humanClip, ...humanAudio, kind: "human" });
  const synthesized = await synthesizeAzureWord(word, accent, env);
  if (synthesized) return audioResponse(request, env, 200, synthesized.body, { ...synthesized, kind: "azure-tts", accent });
  return json(request, env, 404, { error: "暂时没有找到可用发音" });
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function normalizedAzureAssessment(data) {
  const best = data?.NBest?.[0];
  const assessment = best?.PronunciationAssessment || {};
  const words = Array.isArray(best?.Words) ? best.Words : [];
  const phonemes = words.flatMap((word) => (Array.isArray(word?.Phonemes) ? word.Phonemes : []).map((phoneme) => ({
    phoneme: String(phoneme?.Phoneme || ""),
    score: Math.round(Number(phoneme?.PronunciationAssessment?.AccuracyScore) || 0),
    alternatives: (Array.isArray(phoneme?.PronunciationAssessment?.NBestPhonemes) ? phoneme.PronunciationAssessment.NBestPhonemes : []).slice(0, 3).map((item) => ({ phoneme: String(item?.Phoneme || ""), score: Math.round(Number(item?.Score) || 0) }))
  })).filter((item) => item.phoneme));
  return {
    recognized: String(best?.Display || data?.DisplayText || "").trim(),
    score: Math.round(Number(assessment.PronScore) || 0),
    accuracyScore: Math.round(Number(assessment.AccuracyScore) || 0),
    fluencyScore: Math.round(Number(assessment.FluencyScore) || 0),
    completenessScore: Math.round(Number(assessment.CompletenessScore) || 0),
    errorType: String(words[0]?.PronunciationAssessment?.ErrorType || "None"),
    phonemes
  };
}

async function handlePronunciationAssessment(request, env, url) {
  const reference = String(url.searchParams.get("reference") || "").trim().toLowerCase();
  const language = url.searchParams.get("language") === "en-GB" ? "en-GB" : "en-US";
  const region = azureSpeechRegion(env);
  if (!region || !env.AZURE_SPEECH_KEY) return json(request, env, 503, { error: "Azure 发音评测尚未配置" });
  if (!/^[a-z][a-z' -]{0,60}$/i.test(reference)) return json(request, env, 400, { error: "目标单词格式不正确" });
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_AUDIO_BYTES) return json(request, env, 413, { error: "录音过大，请缩短后再试" });
  const audio = await request.arrayBuffer();
  if (!audio.byteLength || audio.byteLength > MAX_AUDIO_BYTES) return json(request, env, 400, { error: "录音内容为空或过大" });
  const config = encodeBase64Utf8(JSON.stringify({
    ReferenceText: reference,
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive",
    EnableMiscue: true,
    PhonemeAlphabet: "IPA",
    NBestPhonemeCount: 5
  }));
  try {
    const upstream = await fetch(`https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}&format=detailed`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY,
        "Pronunciation-Assessment": config,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        Accept: "application/json"
      },
      body: audio,
      signal: AbortSignal.timeout(20000)
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return json(request, env, upstream.status === 429 ? 429 : 502, { error: upstream.status === 429 ? "Azure 免费额度或请求频率已达到上限" : "Azure 暂时无法完成发音评测" });
    const result = normalizedAzureAssessment(data);
    if (!result.score && !result.recognized) return json(request, env, 422, { error: "Azure 没有识别到清晰发音" });
    return json(request, env, 200, result);
  } catch {
    return json(request, env, 504, { error: "Azure 发音评测连接超时" });
  }
}

async function updateState(request, env) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_STATE_BYTES + 100_000) return json(request, env, 413, { error: "学习记录过大，无法同步" });

  let body;
  try {
    body = await request.json();
  } catch {
    return json(request, env, 400, { error: "请求内容不是有效 JSON" });
  }
  const baseRevision = Number(body?.baseRevision);
  const deviceId = String(body?.deviceId || "").slice(0, 100);
  if (!Number.isInteger(baseRevision) || baseRevision < 0 || !validState(body?.state)) {
    return json(request, env, 400, { error: "同步数据格式不正确" });
  }
  const payload = JSON.stringify(body.state);
  if (new TextEncoder().encode(payload).byteLength > MAX_STATE_BYTES) {
    return json(request, env, 413, { error: "学习记录超过 1.8 MB，请先清理过长的 AI 对话" });
  }

  const now = new Date().toISOString();
  const existing = await currentState(env);
  if (!existing.state) {
    if (baseRevision !== 0) return json(request, env, 409, existing);
    try {
      await env.DB.prepare("INSERT INTO sync_state (id, revision, updated_at, payload, device_id) VALUES (1, 1, ?, ?, ?)")
        .bind(now, payload, deviceId).run();
      return json(request, env, 200, { revision: 1, updatedAt: now, state: body.state, deviceId });
    } catch {
      return json(request, env, 409, await currentState(env));
    }
  }

  if (existing.revision !== baseRevision) return json(request, env, 409, existing);
  const nextRevision = existing.revision + 1;
  const result = await env.DB.prepare("UPDATE sync_state SET revision = ?, updated_at = ?, payload = ?, device_id = ? WHERE id = 1 AND revision = ?")
    .bind(nextRevision, now, payload, deviceId, baseRevision).run();
  if (!result.meta?.changes) return json(request, env, 409, await currentState(env));
  return json(request, env, 200, { revision: nextRevision, updatedAt: now, state: body.state, deviceId });
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (request.headers.has("Origin") && !origin) return json(request, env, 403, { error: "不允许从这个网站访问同步服务" });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(request, env) });

    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json(request, env, 200, { ok: true, service: "mogu-cet4-sync", azureSpeech: Boolean(azureSpeechRegion(env) && env.AZURE_SPEECH_KEY), doubaoVoice: doubaoConfigured(env) });
    }
    if (url.pathname === "/doubao-realtime") return proxyDoubaoRealtime(request, env, url);
    if (!await authorized(request, env)) return json(request, env, 401, { error: "同步密码不正确" });
    if (url.pathname === "/voice-session" && request.method === "POST") return issueVoiceSession(request, env);
    if (url.pathname === "/word-audio" && request.method === "GET") return handleWordAudio(request, env, url);
    if (url.pathname === "/pronunciation-assessment" && request.method === "POST") return handlePronunciationAssessment(request, env, url);
    if (url.pathname !== "/sync") return json(request, env, 404, { error: "Not found" });
    if (request.method === "GET") return json(request, env, 200, await currentState(env));
    if (request.method === "PUT") return updateState(request, env);
    return json(request, env, 405, { error: "Method not allowed" });
  }
};
