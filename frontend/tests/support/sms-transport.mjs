import { appendFileSync } from "node:fs";

const captureFile = process.env.SHELTERCONNECT_E2E_SMS_FILE;
const dummyAccount = `AC${"0".repeat(32)}`;
if (!captureFile || process.env.TWILIO_ACCOUNT_SID !== dummyAccount) {
  throw new Error("The test SMS transport requires its isolated capture file and dummy account.");
}

const realFetch = globalThis.fetch;
globalThis.fetch = async function testSmsFetch(input, options) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.hostname !== "api.twilio.com") return realFetch(input, options);
  if (url.href !== `https://api.twilio.com/2010-04-01/Accounts/${dummyAccount}/Messages.json`) {
    throw new Error("The test SMS transport refuses requests for non-test Twilio accounts.");
  }
  const body = new URLSearchParams(options?.body?.toString());
  // Exercise rejected delivery without contacting a provider or capturing an
  // undelivered OTP. All other test numbers use the successful transport.
  if (body.get("To") === "+12055550103") {
    return new Response(JSON.stringify({ message: "Test delivery rejected" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  appendFileSync(captureFile, `${JSON.stringify({ to: body.get("To"), body: body.get("Body") })}\n`, { mode: 0o600 });
  return new Response(JSON.stringify({ sid: "SM-test-only", status: "queued" }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
