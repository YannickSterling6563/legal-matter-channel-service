import { z } from "zod";
import { InfraiRealtimeClient, InfraiRequestError, infrai } from "./infrai_realtime_client.js";

export const channelAccessBody = z.object({
  matter_id: z.string().min(1),
  session_id: z.string().min(1),
  client_id: z.string().min(1),
  account_id: z.string().min(1),
  signed_document_id: z.string().min(1),
  deadline_at: z.string().datetime(),
});

export type ChannelAccessBody = z.infer<typeof channelAccessBody>;

export type ChannelAccessResult =
  | { status: 201; channel: string; token: string; events: string[] }
  | { status: 403; reason: string };

export async function issueMatterChannelToken(
  rawBody: unknown,
  client: InfraiRealtimeClient,
): Promise<ChannelAccessResult> {
  const body = channelAccessBody.parse(rawBody);
  const channel = `matter-${body.matter_id}`;

  try {
    await infrai.auth.session.verify(client, body.session_id);
  } catch (error) {
    if (error instanceof InfraiRequestError && error.status >= 400 && error.status < 500) {
      return { status: 403, reason: "Session cannot access this matter" };
    }
    throw error;
  }

  await infrai.realtime.channel.create(client, { channel, type: "chat", vendor: "infrai" });
  const events = ["signed_document_delivered", "deadline_follow_up"];
  await infrai.realtime.publish(client, {
    channel,
    event: events[0],
    data: { document_id: body.signed_document_id, event_id: `signed-${body.signed_document_id}` },
    account_id: body.account_id,
  });
  await infrai.realtime.publish(client, {
    channel,
    event: events[1],
    data: { deadline_at: body.deadline_at, event_id: `deadline-${body.matter_id}-${body.deadline_at}` },
    account_id: body.account_id,
  });
  const token = await infrai.realtime.token.issue(client, {
    client_id: body.client_id,
    channels: [channel],
    capabilities: ["subscribe", "publish"],
    ttl_seconds: 900,
  });
  return { status: 201, channel, token: token.token, events };
}
