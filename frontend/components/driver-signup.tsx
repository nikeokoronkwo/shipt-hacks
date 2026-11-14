"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, HeartHandshake, ShieldCheck } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { ApiError, getDriverProfile, initializeDriver, type DriverProfile } from "@/lib/api";

type Notice = { tone: "error" | "success"; text: string } | null;

/** Accept "205-555-0100" style US numbers as well as full E.164 input. */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function DriverSignup() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading, refetch } = authClient.useSession();
  const [notice, setNotice] = useState<Notice>(null);
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [mode, setMode] = useState<"sign-up" | "sign-in">("sign-up");
  const [phone, setPhone] = useState("");
  const [phoneName, setPhoneName] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);

  const userId = session?.user.id;
  const phoneVerified = session?.user.phoneNumberVerified === true;

  useEffect(() => {
    if (!userId || !phoneVerified) return;
    let active = true;
    getDriverProfile()
      .then((existing) => {
        if (active) setProfile(existing);
      })
      .catch((error: unknown) => {
        // 404 means the account exists but driver setup is not finished yet.
        if (active && !(error instanceof ApiError && error.status === 404)) {
          setNotice({ tone: "error", text: errorText(error, "Could not load your driver profile.") });
        }
      })
      .finally(() => {
        if (active) setProfileChecked(true);
      });
    return () => {
      active = false;
    };
  }, [userId, phoneVerified]);

  async function run(action: () => Promise<void>, fallback: string) {
    setSubmitting(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setNotice({ tone: "error", text: errorText(error, fallback) });
    } finally {
      setSubmitting(false);
    }
  }

  function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    void run(async () => {
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({ name: String(values.get("name") ?? "").trim(), email, password })
          : await authClient.signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message ?? "Authentication failed.");
      await refetch();
      setNotice({
        tone: "success",
        text: mode === "sign-up" ? "Account created. Next, verify your mobile number." : "Welcome back.",
      });
    }, "Authentication failed.");
  }

  function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      const phoneNumber = normalizePhone(phone);
      setPhone(phoneNumber);
      const result = await authClient.phoneNumber.sendOtp({ phoneNumber });
      if (result.error) throw new Error(result.error.message ?? "Could not send a code.");
      setOtpSent(true);
      setNotice({ tone: "success", text: `We texted a 6-digit code to ${phoneNumber}. It expires in five minutes.` });
    }, "Could not send a code.");
  }

  function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      const signedIn = Boolean(session);
      const result = await authClient.phoneNumber.verify({
        phoneNumber: phone,
        code: code.trim(),
        ...(signedIn ? { updatePhoneNumber: true } : {}),
      });
      if (result.error) throw new Error(result.error.message ?? "That code could not be verified.");
      if (!signedIn && phoneName.trim()) {
        await authClient.updateUser({ name: phoneName.trim() });
      }
      setOtpSent(false);
      setCode("");
      await refetch();
      setNotice({ tone: "success", text: "Phone verified. One last step." });
    }, "That code could not be verified.");
  }

  function handleSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      const created = await initializeDriver(smsAlerts);
      setProfile(created);
      router.push("/driver-profile");
    }, "Could not save your driver profile.");
  }

  const step = !session ? 1 : !phoneVerified ? 2 : 3;
  const isDriver = !session || session.user.role === "driver";

  return (
    <section className="container-wide grid gap-10 py-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-20 lg:py-16" id="driver-access">
      <div>
        <p className="eyebrow mb-5">A small act. A meaningful difference.</p>
        <h1 className="page-title max-w-lg">Be someone&apos;s way forward.</h1>
        <p className="mt-6 max-w-md text-sm leading-8 text-muted">
          Join volunteer drivers helping neighbors reach safe shelter. Create an account, verify your
          phone, and you can start accepting nearby ride requests.
        </p>
        <div className="my-10 flex size-28 items-center justify-center rounded-t-full rounded-b-2xl border border-line bg-raised text-accent">
          <HeartHandshake size={53} strokeWidth={1} />
        </div>
        <ol className="max-w-sm space-y-3 border-t border-line pt-6 text-sm">
          {["Create your account", "Verify your mobile number", "Set up your driver profile"].map((label, index) => (
            <li key={label} className={`flex items-center gap-3 ${index + 1 <= step ? "text-accent" : "text-muted"}`}>
              <span className="flex size-7 items-center justify-center rounded-full border border-current text-xs">
                {index + 1 < step ? <CheckCircle2 size={15} /> : index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <p className="mt-6 flex max-w-sm items-start gap-2 text-xs leading-6 text-muted">
          <ShieldCheck size={18} className="shrink-0 text-accent" />
          Riders&apos; pickup details are only shown to the driver who accepts their request.
        </p>
      </div>

      <div className="panel self-start p-6 sm:p-9">
        {notice && (
          <p
            role={notice.tone === "error" ? "alert" : "status"}
            className={`mb-6 rounded-xl border p-4 text-sm ${notice.tone === "error" ? "border-gold/50 text-gold" : "border-accent/40 text-accent"}`}
          >
            {notice.text}
          </p>
        )}

        {sessionLoading ? (
          <p role="status" className="text-sm text-muted">Checking your session…</p>
        ) : !isDriver ? (
          <div className="space-y-4">
            <h2 className="font-serif text-2xl">You&apos;re signed in as {session?.user.role?.replace("_", " ")}.</h2>
            <p className="text-sm text-muted">Driver tools are only available to driver accounts.</p>
            <button className="btn btn-secondary" onClick={() => authClient.signOut()}>Sign out</button>
          </div>
        ) : !session ? (
          <>
            <div className="mb-6 flex gap-2" role="tablist" aria-label="Sign-in method">
              {(["email", "phone"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={method === value}
                  onClick={() => { setMethod(value); setNotice(null); setOtpSent(false); }}
                  className={`chip ${method === value ? "border-accent bg-accent text-background" : "text-muted"}`}
                >
                  {value === "email" ? "Email & password" : "Phone by SMS"}
                </button>
              ))}
            </div>
            {method === "email" ? (
              <form onSubmit={handleEmail} className="space-y-5">
                <div className="flex items-end justify-between gap-3 border-b border-line pb-5">
                  <h2 className="font-serif text-2xl">{mode === "sign-up" ? "Become a volunteer driver" : "Driver sign in"}</h2>
                  <button
                    type="button"
                    className="text-xs text-accent"
                    onClick={() => { setMode(mode === "sign-up" ? "sign-in" : "sign-up"); setNotice(null); }}
                  >
                    {mode === "sign-up" ? "Already a driver? Sign in" : "New here? Create an account"}
                  </button>
                </div>
                {mode === "sign-up" && (
                  <Field label="Full name" name="name" required autoComplete="name" placeholder="Alex Morgan" maxLength={100} />
                )}
                <Field label="Email address" name="email" type="email" required autoComplete="email" placeholder="alex@example.org" />
                <Field
                  label="Password"
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                  placeholder={mode === "sign-up" ? "At least 12 characters" : ""}
                />
                <button className="btn btn-primary w-full" disabled={submitting}>
                  {submitting ? "One moment…" : mode === "sign-up" ? "Create driver account" : "Sign in"}
                  <ArrowRight size={16} />
                </button>
              </form>
            ) : (
              <PhoneForm
                title="Sign in or join with your phone"
                phone={phone}
                setPhone={setPhone}
                code={code}
                setCode={setCode}
                otpSent={otpSent}
                submitting={submitting}
                onSend={handleSendCode}
                onVerify={handleVerifyCode}
                onChangeNumber={() => { setOtpSent(false); setCode(""); }}
                extra={!otpSent && (
                  <Field
                    label="Full name (for new accounts)"
                    name="phoneName"
                    autoComplete="name"
                    placeholder="Alex Morgan"
                    value={phoneName}
                    onChange={(event) => setPhoneName(event.target.value)}
                    maxLength={100}
                  />
                )}
              />
            )}
          </>
        ) : !phoneVerified ? (
          <PhoneForm
            title="Verify your mobile number"
            description="Ride alerts and rider coordination use your verified number. We'll text you a one-time code."
            phone={phone}
            setPhone={setPhone}
            code={code}
            setCode={setCode}
            otpSent={otpSent}
            submitting={submitting}
            onSend={handleSendCode}
            onVerify={handleVerifyCode}
            onChangeNumber={() => { setOtpSent(false); setCode(""); }}
          />
        ) : !profileChecked ? (
          <p role="status" className="text-sm text-muted">Loading your driver profile…</p>
        ) : profile ? (
          <div className="py-6 text-center">
            <CheckCircle2 size={44} strokeWidth={1.3} className="mx-auto mb-6 text-accent" />
            <h2 className="font-serif text-3xl">You&apos;re set up, {session.user.name.split(" ")[0]}.</h2>
            <p className="my-5 text-sm leading-7 text-muted">
              {profile.is_verified
                ? "Your driver profile is verified. Go online from your dashboard to see ride requests."
                : "Your profile is waiting for verification by the shelter network."}
            </p>
            <Link href="/driver-profile" className="btn btn-primary">Open driver dashboard <ArrowRight size={16} /></Link>
          </div>
        ) : (
          <form onSubmit={handleSetup} className="space-y-5">
            <div className="border-b border-line pb-5">
              <h2 className="font-serif text-2xl">Set up your driver profile</h2>
              <p className="mt-2 text-xs text-muted">Verified phone · {session.user.phoneNumber}</p>
            </div>
            <label className="flex items-start gap-3 rounded-xl bg-raised p-4 text-xs leading-6">
              <input type="checkbox" className="mt-1.5" checked={smsAlerts} onChange={(event) => setSmsAlerts(event.target.checked)} />
              <span>
                Text me when new ride requests are available while I&apos;m online. Message frequency varies.
                Message and data rates may apply. Reply STOP to opt out.
              </span>
            </label>
            <label className="flex items-start gap-3 text-xs leading-6 text-muted">
              <input type="checkbox" required className="mt-1.5" />
              <span>I agree to follow the shelter network&apos;s volunteer driver guidelines and keep rider details private. *</span>
            </label>
            <button className="btn btn-primary w-full" disabled={submitting}>
              {submitting ? "Saving…" : "Finish driver setup"}
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {session && (
          <p className="mt-8 border-t border-line pt-5 text-xs text-muted">
            Signed in as {session.user.phoneNumber ?? session.user.email}.{" "}
            <button className="text-accent" onClick={() => authClient.signOut()}>Sign out</button>
          </p>
        )}
      </div>
    </section>
  );
}

function PhoneForm(props: {
  title: string;
  description?: string;
  phone: string;
  setPhone: (value: string) => void;
  code: string;
  setCode: (value: string) => void;
  otpSent: boolean;
  submitting: boolean;
  onSend: (event: FormEvent<HTMLFormElement>) => void;
  onVerify: (event: FormEvent<HTMLFormElement>) => void;
  onChangeNumber: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <form onSubmit={props.otpSent ? props.onVerify : props.onSend} className="space-y-5">
      <div className="border-b border-line pb-5">
        <h2 className="font-serif text-2xl">{props.title}</h2>
        {props.description && <p className="mt-2 text-xs leading-6 text-muted">{props.description}</p>}
      </div>
      {props.extra}
      <Field
        label="Mobile number"
        name="phoneNumber"
        required
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="(205) 555-0100"
        value={props.phone}
        disabled={props.otpSent}
        onChange={(event) => props.setPhone(event.target.value)}
      />
      {props.otpSent && (
        <>
          <Field
            label="6-digit code"
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={props.code}
            onChange={(event) => props.setCode(event.target.value)}
          />
          <button type="button" className="text-xs text-accent" onClick={props.onChangeNumber}>Use a different number</button>
        </>
      )}
      <button className="btn btn-primary w-full" disabled={props.submitting}>
        {props.submitting ? "One moment…" : props.otpSent ? "Verify code" : "Text me a code"}
        <ArrowRight size={16} />
      </button>
    </form>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      {props.required ? " *" : ""}
      <input {...props} className="field mt-2" />
    </label>
  );
}
