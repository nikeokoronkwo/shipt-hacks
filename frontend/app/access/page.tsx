"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, isPending, error: sessionError } = authClient.useSession();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (session) router.replace(session.user.role === "driver" ? "/driver-profile" : "/");
  }, [session, router]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setBusy(true);
    const values = new FormData(event.currentTarget);
    try {
      const result = method === "email"
        ? await authClient.signIn.email({ email: String(values.get("email")).trim(), password: String(values.get("password")) })
        : codeSent
          ? await authClient.phoneNumber.verify({ phoneNumber: phone, code })
          : await authClient.phoneNumber.sendOtp({ phoneNumber: phone });
      if (result.error) throw new Error(result.error.message || "Sign-in failed. Please try again.");
      if (method === "phone" && !codeSent) { setCodeSent(true); return; }
      const refreshed = await authClient.getSession();
      if (refreshed.error || !refreshed.data) throw new Error("Could not confirm your session. Please try signing in again.");
      router.replace(refreshed.data.user.role === "driver" ? "/driver-profile" : "/");
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not sign in."); }
    finally { setBusy(false); }
  }
  return <section className="container-wide max-w-lg py-12 sm:py-20">
    <p className="eyebrow mb-3">Welcome back</p><h1 className="page-title">Sign in</h1>
    <p className="mb-8 mt-4 text-sm leading-7 text-muted">Access your Wayfinder account. You don’t need an account to find shelter or request a pickup.</p>
    {isPending || session ? <p role="status">{session ? "Opening your account…" : "Checking session…"}</p> : <form onSubmit={signIn} className="panel space-y-5 p-6 sm:p-8">
      <div className="flex gap-3"><button type="button" disabled={busy} aria-pressed={method === "email"} onClick={() => { setMethod("email"); setError(""); }} className="chip">Email and password</button><button type="button" disabled={busy} aria-pressed={method === "phone"} onClick={() => { setMethod("phone"); setError(""); }} className="chip">SMS code</button></div>
      {(error || sessionError) && <p role="alert" className="text-sm text-gold">{error || "The sign-in service is unavailable. Please try again later."}</p>}
      {method === "email" ? <>
        <label className="block text-xs text-muted">Email address<input required name="email" type="email" autoComplete="username" className="field mt-2" /></label>
        <label className="block text-xs text-muted">Password<input required name="password" type="password" autoComplete="current-password" className="field mt-2" /></label>
      </> : <>
        <label className="block text-xs text-muted">Mobile number<input required type="tel" autoComplete="tel" pattern="\+[1-9][0-9]{7,14}" placeholder="+12055550100" value={phone} disabled={codeSent} onChange={e => setPhone(e.target.value)} className="field mt-2" /></label>
        <p className="text-xs leading-6 text-muted">Use international format. SMS sign-in can also create a new driver account. Message and data rates may apply.</p>
        {codeSent && <><p role="status" className="text-xs text-accent">Code sent. Check your messages; it expires in five minutes.</p><label className="block text-xs text-muted">SMS code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value)} className="field mt-2" /></label><button type="button" disabled={busy} onClick={() => { setCodeSent(false); setCode(""); }} className="text-xs text-accent">Change number or resend code</button></>}
      </>}
      <button disabled={busy} className="btn btn-primary w-full">{busy ? "Please wait…" : method === "phone" && !codeSent ? "Send sign-in code" : "Sign in"}</button>
      <p className="text-center text-xs text-muted">New volunteer? <Link className="text-accent underline" href="/become-a-driver">Create a driver account</Link></p>
    </form>}
  </section>;
}
