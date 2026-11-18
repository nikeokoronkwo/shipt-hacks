"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { HeartHandshake, ShieldCheck } from "lucide-react";
import { ApiError, getDriverProfile, initializeDriver, type DriverProfile } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

type ProfileLookup = { userId: string; profile: DriverProfile | null; error: string };

export function DriverSignup() {
  const { data: session, isPending, error: sessionError, refetch } = authClient.useSession();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [phone, setPhone] = useState("");
  const [phoneName, setPhoneName] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [smsConsent, setSmsConsent] = useState<{ userId: string; enabled: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lookup, setLookup] = useState<ProfileLookup | null>(null);
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const userId = session?.user.id;
  const userRole = session?.user.role;
  const smsAlerts = smsConsent?.userId === userId && smsConsent?.enabled === true;

  useEffect(() => {
    if (!userId || userRole !== "driver") return;
    let active = true;
    getDriverProfile().then(
      (profile) => { if (active) setLookup({ userId, profile, error: "" }); },
      (error: unknown) => {
        if (active) setLookup({
          userId,
          profile: null,
          error: error instanceof ApiError && error.status === 404
            ? ""
            : error instanceof Error ? error.message : "Could not check your driver profile. Please retry.",
        });
      },
    );
    return () => { active = false; };
  }, [userId, userRole, lookupAttempt]);

  // Refresh the actual server session after account/phone changes. Hydrating the
  // client store also makes the next step visible before its background poll.
  async function confirmSession() {
    const result = await authClient.getSession({ query: { disableCookieCache: true } });
    if (result.error || !result.data) {
      throw new Error("Could not confirm your session. Sign in again to resume driver setup.");
    }
    authClient.hydrateSession(result.data);
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await authClient.signUp.email({
        name: String(values.get("name") ?? "").trim(),
        email: String(values.get("email") ?? "").trim(),
        password: String(values.get("password") ?? ""),
      });
      if (result.error) throw new Error(result.error.message || "Could not create your account. Please try again.");
      await confirmSession();
      setNotice("Account created. Add your contact and vehicle details to finish setup.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not create your account.");
    } finally { setBusy(false); }
  }

  async function verifyPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (!codeSent) {
        const result = await authClient.phoneNumber.sendOtp({ phoneNumber: phone });
        if (result.error) throw new Error(result.error.message || "Could not send a code. Please try again.");
        setCodeSent(true);
        return;
      }
      const result = await authClient.phoneNumber.verify({
        phoneNumber: phone,
        code,
        ...(!session && phoneName.trim() ? { name: phoneName.trim() } : {}),
        ...(session ? { updatePhoneNumber: true } : {}),
      });
      if (result.error) throw new Error(result.error.message || "That code could not be verified. Please try again.");
      await confirmSession();
      setCodeSent(false); setCode("");
      setNotice("Phone verified. Add your vehicle details and save your driver profile.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not verify your phone. Please try again.");
    } finally { setBusy(false); }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !session || session.user.role !== "driver") return;
    setBusy(true); setError(""); setNotice("");
    try {
      const values = new FormData(event.currentTarget);
      const profile = await initializeDriver({
        phone_number: String(values.get("phone_number") ?? "").trim(),
        vehicle_make: String(values.get("vehicle_make") ?? "").trim(),
        vehicle_model: String(values.get("vehicle_model") ?? "").trim(),
        vehicle_color: String(values.get("vehicle_color") ?? "").trim(),
        license_plate: String(values.get("license_plate") ?? "").trim(),
        sms_notifications_enabled: smsAlerts,
      });
      setLookup({ userId: session.user.id, profile, error: "" });
      setNotice("Driver profile saved.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save your driver profile. Please try again.");
    } finally { setBusy(false); }
  }

  function changeNumber() {
    setCodeSent(false); setCode(""); setError(""); setNotice("");
  }

  const currentLookup = lookup?.userId === userId ? lookup : null;
  const profile = currentLookup?.profile;
  const phoneForm = <form key="phone-auth" onSubmit={verifyPhone}>
    <fieldset disabled={busy} className="space-y-5">
      {!session && !codeSent && <label className="block text-xs text-muted">Full name (optional for new accounts)<input name="name" autoComplete="name" maxLength={100} value={phoneName} onChange={event => setPhoneName(event.target.value)} className="field mt-2" /></label>}
      <label className="block text-xs text-muted">Mobile number<input required name="phone" type="tel" autoComplete="tel" pattern="\+[1-9][0-9]{7,14}" placeholder="+12055550100" disabled={codeSent} value={phone} onChange={event => setPhone(event.target.value)} className="field mt-2" /></label>
      <p className="text-xs leading-6 text-muted">Use international format. We’ll text a one-time verification code. Message and data rates may apply.</p>
      {codeSent && <>
        <p role="status" className="text-sm text-accent">Code sent. It expires in five minutes.</p>
        <label className="block text-xs text-muted">SMS code<input required name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value)} className="field mt-2" /></label>
        <button type="button" onClick={changeNumber} className="text-xs text-accent underline">Change number or resend code</button>
      </>}
      <button className="btn btn-primary w-full">{busy ? "Please wait…" : codeSent ? "Verify phone" : "Send verification code"}</button>
    </fieldset>
  </form>;

  return <section className="container-wide grid gap-10 py-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-20 lg:py-16">
    <div>
      <p className="eyebrow mb-5">A small act. A meaningful difference.</p>
      <h1 className="page-title max-w-lg">Become a volunteer driver</h1>
      <p className="mt-6 max-w-md text-sm leading-8 text-muted">Create your account and add the vehicle you’ll use to help neighbors reach shelter.</p>
      <div className="my-10 flex size-28 items-center justify-center rounded-t-full rounded-b-2xl border border-line bg-raised text-accent"><HeartHandshake size={53} strokeWidth={1} /></div>
      <p className="flex items-center gap-2 text-sm"><ShieldCheck size={18} className="text-accent" />Your account and driver profile stay connected.</p>
      <p className="mt-3 max-w-sm text-xs leading-7 text-muted">For this local demo, profiles are automatically verified after registration and start offline. Ride-request text alerts stay off unless you choose them.</p>
    </div>
    <div className="panel self-start space-y-6 p-6 sm:p-9" aria-busy={busy}>
      {error && <p role="alert" className="text-sm text-gold">{error}</p>}
      {notice && <p role="status" className="text-sm text-accent">{notice}</p>}
      {isPending ? <p role="status">Checking session…</p> : sessionError ? <>
        <p role="alert">The account service is unavailable. Please retry.</p>
        <button className="btn btn-secondary" disabled={busy} onClick={() => void refetch()}>Retry session</button>
      </> : !session ? <>
        <h2 className="font-serif text-2xl">Create a driver account</h2>
        <div className="flex flex-wrap gap-3">
          <button disabled={busy} type="button" aria-pressed={method === "email"} onClick={() => { setMethod("email"); setError(""); }} className="chip">Email and password</button>
          <button disabled={busy} type="button" aria-pressed={method === "phone"} onClick={() => { setMethod("phone"); setError(""); }} className="chip">Phone by SMS</button>
        </div>
        {method === "email" ? <form key="email-auth" onSubmit={createAccount}><fieldset disabled={busy} className="space-y-5">
          <label className="block text-xs text-muted">Full name<input required name="name" autoComplete="name" maxLength={100} className="field mt-2" /></label>
          <label className="block text-xs text-muted">Email address<input required name="email" type="email" autoComplete="username" className="field mt-2" /></label>
          <label className="block text-xs text-muted">Password<input required name="password" type="password" minLength={12} maxLength={256} autoComplete="new-password" aria-describedby="driver-password-hint" className="field mt-2" /></label>
          <p id="driver-password-hint" className="text-xs text-muted">Use at least 12 characters.</p>
          <button className="btn btn-primary w-full">{busy ? "Creating account…" : "Create driver account"}</button>
        </fieldset></form> : phoneForm}
        <p className="text-xs text-muted">Already have an account? <Link className="text-accent underline" href="/access">Sign in to resume setup</Link></p>
      </> : session.user.role !== "driver" ? <>
        <h2 className="font-serif text-2xl">Driver accounts only</h2>
        <p className="text-sm leading-7 text-muted">You’re signed in as {session.user.role?.replaceAll("_", " ") || "an administrator"}. Sign out and use a driver account to volunteer.</p>
        <button disabled={busy} className="btn btn-secondary" onClick={async () => {
          setBusy(true); setError("");
          try {
            const result = await authClient.signOut();
            if (result.error) throw new Error(result.error.message || "Could not sign out. Please retry.");
            setLookup(null); setSmsConsent(null); setNotice("");
          } catch (error) { setError(error instanceof Error ? error.message : "Could not sign out."); }
          finally { setBusy(false); }
        }}>Sign out</button>
      </> : profile ? <>
        <h2 className="font-serif text-2xl">Your driver profile is ready</h2>
        <p className="text-sm text-accent">{profile.is_verified ? "Verified driver" : "Awaiting administrator approval"}</p>
        <p className="text-sm leading-7 text-muted">{profile.phone_number} · Ride-request SMS alerts {profile.sms_notifications_enabled ? "on" : "off"}. {profile.is_verified ? "Manage your availability from your dashboard." : "You’ll stay offline until an administrator verifies your profile."}</p>
        <Link href="/driver-profile" className="btn btn-primary">Open driver dashboard</Link>
      </> : <>
        <p className="text-sm text-muted">Signed in as {session.user.name || session.user.email}.</p>
        <h2 className="font-serif text-2xl">Finish driver setup</h2>
        {!currentLookup ? <p role="status">Checking your driver profile…</p> : currentLookup.error ? <>
          <p role="alert" className="text-sm text-gold">{currentLookup.error}</p>
          <button className="btn btn-secondary" disabled={busy} onClick={() => { setLookup(null); setLookupAttempt(attempt => attempt + 1); }}>Retry profile check</button>
        </> : <form onSubmit={saveProfile}><fieldset disabled={busy} className="space-y-5">
          <label className="block text-xs text-muted">Phone number<input required name="phone_number" type="tel" autoComplete="tel" maxLength={32} defaultValue={session.user.phoneNumber ?? ""} className="field mt-2" /></label>
          <p className="text-xs leading-6 text-muted">Use a working phone number for ride contact. Email registration does not require an SMS code.</p>
          <div className="border-t border-line pt-5"><h3 className="font-serif text-2xl">Vehicle details</h3><div className="mt-4 grid gap-5 sm:grid-cols-2">
            <label className="block text-xs text-muted">Make<input required name="vehicle_make" maxLength={80} placeholder="Toyota" className="field mt-2" /></label>
            <label className="block text-xs text-muted">Model<input required name="vehicle_model" maxLength={80} placeholder="Prius" className="field mt-2" /></label>
            <label className="block text-xs text-muted">Color<input required name="vehicle_color" maxLength={40} placeholder="Blue" className="field mt-2" /></label>
            <label className="block text-xs text-muted">License plate<input required name="license_plate" maxLength={32} placeholder="ABC 1234" className="field mt-2" /></label>
          </div></div>
          <label className="flex items-start gap-3 text-xs leading-6"><input type="checkbox" checked={smsAlerts} onChange={event => setSmsConsent({ userId: session.user.id, enabled: event.target.checked })} className="mt-1.5" /><span>Text me when new ride requests are available while I’m online.</span></label>
          <p className="text-xs leading-6 text-muted">Optional. Message frequency varies. Message and data rates may apply. Reply STOP to opt out.</p>
          <button className="btn btn-primary w-full">{busy ? "Saving profile…" : "Save driver profile"}</button>
        </fieldset></form>}
        <p className="text-xs text-muted">Your account is saved. You can return here to finish setup. <Link className="text-accent underline" href="/access">Sign in again if your session expires.</Link></p>
      </>}
    </div>
  </section>;
}
