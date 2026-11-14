"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { initializeDriver } from "@/lib/api";

export function DriverRegistration() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      const signup = await authClient.signUp.email({
        name: String(values.get("name")).trim(),
        email: String(values.get("email")).trim(),
        password: String(values.get("password")),
      });
      if (signup.error) throw new Error(signup.error.message || "Could not create your account.");
      const profile = await initializeDriver({
        phone_number: String(values.get("phone")).trim(),
        vehicle_make: String(values.get("vehicle_make")).trim(),
        vehicle_model: String(values.get("vehicle_model")).trim(),
        vehicle_color: String(values.get("vehicle_color")).trim(),
        license_plate: String(values.get("license_plate")).trim(),
        sms_notifications_enabled: values.get("sms_notifications_enabled") === "on",
      });
      if (!profile.is_verified) throw new Error("Your driver profile could not be verified.");
      router.replace("/driver-profile");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not register as a driver.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="container-wide max-w-2xl py-12 sm:py-20">
    <p className="eyebrow mb-3">Volunteer drivers</p>
    <h1 className="page-title">Register as a driver</h1>
    <p className="mb-8 mt-4 text-sm leading-7 text-muted">Create your account and add the vehicle you’ll use to help neighbors reach shelter.</p>
    <form onSubmit={submit} className="panel space-y-5 p-6 sm:p-8">
      {error && <p role="alert" className="text-sm text-gold">{error}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-xs text-muted">Full name<input required name="name" autoComplete="name" className="field mt-2" /></label>
        <label className="block text-xs text-muted">Phone number<input required name="phone" type="tel" autoComplete="tel" className="field mt-2" /></label>
      </div>
      <label className="block text-xs text-muted">Email address<input required name="email" type="email" autoComplete="email" className="field mt-2" /></label>
      <label className="block text-xs text-muted">Password<input required name="password" type="password" minLength={12} autoComplete="new-password" className="field mt-2" /><span className="mt-2 block text-[11px]">Use at least 12 characters.</span></label>
      <div className="border-t border-line pt-5"><h2 className="font-serif text-2xl">Vehicle details</h2><div className="mt-4 grid gap-5 sm:grid-cols-2">
        <label className="block text-xs text-muted">Make<input required name="vehicle_make" placeholder="Toyota" className="field mt-2" /></label>
        <label className="block text-xs text-muted">Model<input required name="vehicle_model" placeholder="Prius" className="field mt-2" /></label>
        <label className="block text-xs text-muted">Color<input required name="vehicle_color" placeholder="Blue" className="field mt-2" /></label>
        <label className="block text-xs text-muted">License plate<input required name="license_plate" placeholder="ABC 1234" className="field mt-2" /></label>
      </div></div>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="sms_notifications_enabled" className="mt-1" /><span>Send me SMS alerts for new ride requests.</span></label>
      <p className="text-xs leading-6 text-muted">For this local demo, driver profiles are automatically verified after registration. SMS alerts still require a working phone number and Twilio configuration.</p>
      <button disabled={busy} className="btn btn-primary w-full">{busy ? "Creating driver profile…" : "Create driver account"}</button>
    </form>
  </section>;
}
