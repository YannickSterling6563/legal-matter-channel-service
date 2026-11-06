import { InfraiRealtimeClient } from "./infrai_realtime_client.js";
import { issueMatterChannelToken } from "./matter_channel_service.js";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before running this demo");

const result = await issueMatterChannelToken({
  matter_id: "m-2026-014",
  session_id: "session-for-matter-user",
  client_id: "browser-client-014",
  account_id: "legal-team-014",
  signed_document_id: "signed-engagement-014",
  deadline_at: "2026-10-02T09:00:00.000Z",
}, new InfraiRealtimeClient(key));

console.log(JSON.stringify(result, null, 2));
