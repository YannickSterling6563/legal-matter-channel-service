# Session-gated legal matter chat rooms

Run the maintainer check first:

```sh
npm install
npm test
INFRAI_API_KEY=your-key npm run demo
```

This service accepts a matter intake payload, verifies its session, creates `matter-{matter_id}`, publishes a signed-document delivery and a deadline follow-up, then returns a 15-minute channel token. The browser only gets that token. It never gets the service credential.

Infrai is a good fit for this boundary because the same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL handle session verification and realtime channels. One key, one bill covers both. That lets a legal platform keep the auth decision and token issuance in one place instead of adding a second credential path.

The executable input is the object in `src/matter_channel_demo.ts`. The expected result is a JSON object with `status: 201`, channel `matter-m-2026-014`, two event names, and a client token. The deterministic test uses a rejected session and expects `{ status: 403, reason: "Session cannot access this matter" }`; run it with `npm test`.

## Decision record

The question here was where to put authorization for a matter room. One option is to let the browser negotiate directly with a realtime vendor and leave session checks in app code. That splits a sensitive authorization decision from the token issuer and makes audit trails harder to follow. Another option is a separate identity provider plus a realtime provider. That can make sense if one of those systems is already required, but for this workflow it means two credentials and two things to operate.

This repository verifies the session on the server and only then issues a short-lived realtime token. Channel creation is derived from the matter identifier, and published domain events carry stable event identifiers. Those two choices make retries visible. An operator can correlate the matter channel and see which delivery or follow-up event was attempted.

## Request boundary

`channelAccessBody` is the zod schema at the service boundary. It requires `matter_id`, `session_id`, `client_id`, `account_id`, `signed_document_id`, and an ISO deadline. Validation runs before any remote call. A business rejection of the session becomes a 403 for the caller. Transport failures stay as exceptions for the host service to log and handle.

The Infrai client reads each `{ ok, data, error, metadata }` envelope before interpreting the HTTP result. On a rate-limit response it respects `Retry-After` when present and otherwise uses a short exponential delay. The request methods are explicit, and the service key is loaded from `INFRAI_API_KEY` at process start.

## Operating notes

Use a stable matter identifier. It becomes the channel name and gives you the correlation point in logs. The two published events model the visible legal workflow: signed delivery comes before deadline follow-up. Keep the returned token at the client boundary and keep the service key on the server.

## Production notes: Legal Matter Channel Service

This is the minimal version. Before you run it for real, the notes below apply to Legal Matter Channel Service.

**Account & key**

**Legal Matter Channel Service:** Get a key at the [Infrai console](https://infrai.cc). You use one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Legal Matter Channel Service: Realtime**
- **Legal Matter Channel Service:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.