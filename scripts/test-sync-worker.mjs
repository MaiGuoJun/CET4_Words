import assert from "node:assert/strict";
import worker from "../cloudflare/src/worker.mjs";

class MemoryD1 {
  row = null;

  prepare(query) {
    if (query.startsWith("SELECT")) return { first: async () => this.row && { ...this.row } };
    return {
      bind: (...values) => ({
        run: async () => {
          if (query.startsWith("INSERT")) {
            if (this.row) throw new Error("duplicate");
            this.row = { revision: 1, updated_at: values[0], payload: values[1], device_id: values[2] };
            return { meta: { changes: 1 } };
          }
          if (query.startsWith("UPDATE")) {
            const [revision, updatedAt, payload, deviceId, expected] = values;
            if (!this.row || this.row.revision !== expected) return { meta: { changes: 0 } };
            this.row = { revision, updated_at: updatedAt, payload, device_id: deviceId };
            return { meta: { changes: 1 } };
          }
          throw new Error(`Unexpected query: ${query}`);
        }
      })
    };
  }
}

const env = { DB: new MemoryD1(), SYNC_SECRET: "test-secret", ALLOWED_ORIGINS: "https://example.test" };
const headers = { Origin: "https://example.test", Authorization: "Bearer test-secret" };
const state = { settings: { dailyTarget: 25 }, wordStates: {}, daily: {}, completedListening: [] };

const unauthorized = await worker.fetch(new Request("https://sync.test/sync"), env);
assert.equal(unauthorized.status, 401);

const empty = await worker.fetch(new Request("https://sync.test/sync", { headers }), env);
assert.deepEqual(await empty.json(), { revision: 0, updatedAt: null, state: null, deviceId: null });

const created = await worker.fetch(new Request("https://sync.test/sync", {
  method: "PUT",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ baseRevision: 0, deviceId: "test-device", state })
}), env);
assert.equal(created.status, 200);
assert.equal((await created.json()).revision, 1);

const stale = await worker.fetch(new Request("https://sync.test/sync", {
  method: "PUT",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ baseRevision: 0, deviceId: "stale-device", state })
}), env);
assert.equal(stale.status, 409);
assert.equal((await stale.json()).revision, 1);

const blockedOrigin = await worker.fetch(new Request("https://sync.test/sync", {
  headers: { Origin: "https://attacker.example", Authorization: "Bearer test-secret" }
}), env);
assert.equal(blockedOrigin.status, 403);

console.log("Cloudflare sync worker tests passed.");
