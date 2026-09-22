const MAX_STATE_BYTES = 1_800_000;
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
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      Vary: "Origin"
    } : {})
  };
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
      return json(request, env, 200, { ok: true, service: "mogu-cet4-sync" });
    }
    if (url.pathname !== "/sync") return json(request, env, 404, { error: "Not found" });
    if (!await authorized(request, env)) return json(request, env, 401, { error: "同步密码不正确" });
    if (request.method === "GET") return json(request, env, 200, await currentState(env));
    if (request.method === "PUT") return updateState(request, env);
    return json(request, env, 405, { error: "Method not allowed" });
  }
};
