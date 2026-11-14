type SmsMessage = {
  to: string;
  body: string;
};

/** Send a server-side SMS through the configured Twilio account. */
export async function sendSms({ to, body }: SmsMessage): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    if (process.env.NODE_ENV !== "production" && process.env.SMS_DEV_CONSOLE === "true") {
      // LOCAL DEVELOPMENT ONLY: print the message (including any OTP) to the
      // Next.js terminal so driver sign-up can be tested without Twilio.
      console.warn(`[dev sms] To ${to}: ${body}`);
      return;
    }
    throw new Error("Twilio SMS is not configured. Set the TWILIO_* environment variables.");
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    // Do not log the OTP, recipient, or Twilio response body.
    throw new Error(`Twilio rejected the SMS request (HTTP ${response.status}).`);
  }
}
