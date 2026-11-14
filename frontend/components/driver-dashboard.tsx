"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, getDriverProfile, updateDriverPreferences, type DriverProfile } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

type PendingRide = { id: number; pickup_area: string; shelter_id: number; shelter_name: string };
type AssignedRide = { id: number; first_name: string; last_name: string; pickup_address: string | null; pickup_latitude: number | null; pickup_longitude: number | null; shelter_id: number; status: string };
const protectedOptions = { authenticated: true, cache: "no-store" as const };
function mutation<T>(path: string, method: string, body?: object) {
  return apiFetch<T>(path, { ...protectedOptions, method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

export function DriverDashboard() {
  const { data: session, isPending } = authClient.useSession();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [requests, setRequests] = useState<PendingRide[]>([]);
  const [activeRide, setActiveRide] = useState<AssignedRide | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const profile = await getDriverProfile();
        const active = await apiFetch<AssignedRide | null>("/api/drivers/me/active-ride", protectedOptions);
        const pending = profile.is_verified && profile.is_available && !active ? await apiFetch<PendingRide[]>("/api/drivers/requests", protectedOptions) : [];
        if (!cancelled) { setProfile(profile); setActiveRide(active); setRequests(pending); setError(""); }
      } catch (error) { if (!cancelled) setError(error instanceof Error ? error.message : "Could not load driver profile."); }
      finally { if (!cancelled) { setReady(true); timer = setTimeout(refresh, 4000); } }
    }
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [session]);
  async function change(kind: "availability" | "sms", value: boolean) {
    setBusy(true); setError("");
    try {
      const updated = kind === "sms" ? await updateDriverPreferences(value) : await mutation<DriverProfile>("/api/drivers/me/availability", "PATCH", { is_available: value });
      setProfile(updated);
      if (!updated.is_available) setRequests([]);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save preference."); }
    finally { setBusy(false); }
  }
  return <section className="container-wide max-w-4xl space-y-6 py-12"><h1 className="page-title">Volunteer driver dashboard</h1>
    {isPending ? <p>Loading session…</p> : !session ? <Link className="text-accent" href="/access#driver-access">Sign in or register to drive →</Link> : <>
      <p>Welcome, {session.user.name}. <button className="text-accent underline" onClick={() => authClient.signOut()}>Sign out</button></p>
      {error && <p role="alert" className="text-gold">{error} <Link href="/access#driver-access" className="underline">Driver account setup</Link></p>}
      {!ready ? <p role="status">Loading driver profile…</p> : profile && <>
        <div className="panel space-y-5 p-6"><p>{profile.is_verified ? "Verified driver" : "Awaiting administrator verification"} · {profile.phone_number}</p>
          <label className="flex gap-3"><input type="checkbox" disabled={busy || !profile.is_verified || !!activeRide} checked={profile.is_available} onChange={e => change("availability", e.target.checked)} />Online · Accepting requests</label>
          <label className="flex gap-3"><input type="checkbox" disabled={busy} checked={profile.sms_notifications_enabled} onChange={e => change("sms", e.target.checked)} />Opt in to new-ride SMS alerts</label><p className="text-xs text-muted">Alerts require verified, online availability. Message and data rates may apply. Reply STOP to opt out.</p>
        </div>
        {activeRide ? <Link className="panel block p-6 text-accent" href={`/driver/requests/${activeRide.id}`}>Resume ride #{activeRide.id} · {activeRide.status} →</Link> : <div className="panel space-y-4 p-6"><h2 className="font-serif text-2xl">Pending ride requests</h2><p className="text-xs text-muted" aria-live="polite">{requests.length} requests · Refreshes every 4 seconds</p>{requests.map(ride => <Link className="block rounded-xl border border-line p-4" key={ride.id} href={`/driver/requests/${ride.id}`}><p>{ride.pickup_area}</p><p className="mt-2 text-sm text-accent">To {ride.shelter_name} →</p></Link>)}{!requests.length && <p className="text-sm text-muted">{profile.is_available ? "No pending requests." : "Go online when you’re ready to help."}</p>}</div>}
      </>}
    </>}
  </section>;
}

export function DriverRequest({ id }: { id: string }) {
  const [pending, setPending] = useState<PendingRide | null>(null);
  const [ride, setRide] = useState<AssignedRide | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const active = await apiFetch<AssignedRide | null>("/api/drivers/me/active-ride", protectedOptions);
        if (active?.id === Number(id)) { if (!cancelled) setRide(active); }
        else if (active) throw new Error("Finish your active ride before accepting another request.");
        else {
          const requests = await apiFetch<PendingRide[]>("/api/drivers/requests", protectedOptions);
          const request = requests.find(ride => ride.id === Number(id));
          if (!request) throw new Error("This request is no longer available.");
          if (!cancelled) setPending(request);
        }
      } catch (error) { if (!cancelled) setError(error instanceof Error ? error.message : "Could not load request."); }
      finally { if (!cancelled) setReady(true); }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);
  async function update(status?: string) {
    setBusy(true); setError("");
    try {
      const updated = await mutation<AssignedRide>(`/api/rides/${id}/${status ? "status" : "accept"}`, status ? "PATCH" : "POST", status ? { status } : undefined);
      setRide(updated); setPending(null);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not update ride."); }
    finally { setBusy(false); }
  }
  const terminal = ride && ["COMPLETED", "CANCELLED"].includes(ride.status);
  return <section className="container-wide max-w-3xl space-y-6 py-12"><Link href="/driver-profile" className="text-accent">← Driver dashboard</Link><h1 className="page-title">Ride request #{id}</h1>
    {error && <p role="alert" className="text-gold">{error}</p>}
    {!ready ? <p>Loading request…</p> : (pending || ride) && <div className="panel space-y-5 p-6">
      <p className="text-accent">{ride?.status || "PENDING"}</p>
      {ride ? <><h2 className="font-serif text-2xl">{ride.first_name} {ride.last_name}</h2><p>Pickup: {ride.pickup_address || "Shared coordinates"}</p>{ride.pickup_latitude != null && ride.pickup_longitude != null && <p>Latitude: {ride.pickup_latitude} · Longitude: {ride.pickup_longitude}</p>}<Link href={`/shelter-details/${ride.shelter_id}`} className="text-accent">Destination shelter →</Link></> : <><p>General pickup area: {pending?.pickup_area}</p><p>Destination: {pending?.shelter_name}</p><p className="text-xs text-muted">Precise pickup details are available only after assignment.</p></>}
      {!terminal && <button disabled={busy} className="btn btn-primary" onClick={() => update(ride ? ride.status === "ACCEPTED" ? "IN_PROGRESS" : "COMPLETED" : undefined)}>{busy ? "Saving…" : !ride ? "Accept request" : ride.status === "ACCEPTED" ? "Start ride" : "Complete ride"}</button>}
      {ride?.status === "ACCEPTED" && <button disabled={busy} className="btn btn-secondary ml-3" onClick={() => update("CANCELLED")}>Cancel ride</button>}
      <p className="text-xs text-muted">Shelter admission is not guaranteed. Assignment and status transitions are confirmed by the backend.</p>
    </div>}
  </section>;
}
