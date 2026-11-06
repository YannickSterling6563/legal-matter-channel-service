import assert from "node:assert/strict";
import test from "node:test";
import { InfraiRealtimeClient } from "../src/infrai_realtime_client.js";
import { issueMatterChannelToken } from "../src/matter_channel_service.js";

test("rejects a matter token when the session is rejected", async () => {
  const fetcher = async () => new Response(JSON.stringify({
    ok: false,
    error: { message: "Session rejected" },
    metadata: {},
  }), { status: 401, headers: { "Content-Type": "application/json" } });
  const client = new InfraiRealtimeClient(process.env.INFRAI_API_KEY ?? "", fetcher as typeof fetch);
  const result = await issueMatterChannelToken({
    matter_id: "m-1",
    session_id: "s-1",
    client_id: "browser-1",
    account_id: "firm-1",
    signed_document_id: "doc-1",
    deadline_at: "2026-10-02T09:00:00.000Z",
  }, client);

  assert.deepEqual(result, { status: 403, reason: "Session cannot access this matter" });
});
