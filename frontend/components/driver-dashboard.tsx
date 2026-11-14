"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Car, CheckCircle2, MapPin, MessageSquare, ShieldCheck, UserRound } from "lucide-react";

import { NeighborhoodMap } from "@/components/neighborhood-map";
import { authClient } from "@/lib/auth-client";
import {
  acceptRide,
  ApiError,
  getActiveRide,
  getDriverProfile,
  listDriverRequests,
  setDriverAvailability,
  updateDriverPreferences,
  updateRideStatus,
  type AssignedRide,
  type DriverProfile,
  type DriverRideRequest,
} from "@/lib/api";

const POLL_MS = 10_000;

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} hr ago`;
}

type DriverState = {
  profile: DriverProfile | null;
  activeRide: AssignedRide | null;
  requests: DriverRideRequest[];
  missingProfile: boolean;
  loaded: boolean;
  error: string;
};

/** Loads and polls the signed-in driver's profile, active ride and open requests. */
function useDriverState(enabled: boolean) {
  const [state, setState] = useState<DriverState>({
    profile: null,
    activeRide: null,
    requests: [],
    missingProfile: false,
    loaded: false,
    error: "",
  });

  const refresh = useCallback(async () => {
    try {
      const profile = await getDriverProfile();
      const activeRide = await getActiveRide();
      const requests = profile.is_verified && profile.is_available && !activeRide ? await listDriverRequests() : [];
      setState({ profile, activeRide, requests, missingProfile: false, loaded: true, error: "" });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setState((previous) => ({ ...previous, missingProfile: true, loaded: true, error: "" }));
      } else {
        setState((previous) => ({ ...previous, loaded: true, error: errorText(error, "Could not load driver tools.") }));
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void refresh();
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [enabled, refresh]);

  return { ...state, refresh, setState };
}

function SignedOut({ message }: { message: string }) {
  return (
    <div className="panel mx-auto my-10 max-w-xl p-10 text-center">
      <UserRound className="mx-auto mb-5 text-accent" size={36} strokeWidth={1.3} />
      <h2 className="font-serif text-3xl">Driver tools need a driver account.</h2>
      <p className="my-5 text-sm leading-7 text-muted">{message}</p>
      <Link href="/become-a-driver" className="btn btn-primary">Sign in or sign up <ArrowRight size={16} /></Link>
    </div>
  );
}

export function DriverDashboard() {
  const { data: session, isPending } = authClient.useSession();
  const ready = Boolean(session && session.user.role === "driver" && session.user.phoneNumberVerified);
  const driver = useDriverState(ready);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const router = useRouter();

  async function act(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setNotice("");
    try {
      await action();
      await driver.refresh();
    } catch (error) {
      setNotice(errorText(error, fallback));
    } finally {
      setBusy(false);
    }
  }

  if (isPending) return <section className="container-wide py-12"><p role="status" className="panel p-8">Loading your dashboard…</p></section>;
  if (!session) return <section className="container-wide py-12"><SignedOut message="Sign in to go online, see nearby ride requests, and manage your rides." /></section>;
  if (session.user.role !== "driver") return <section className="container-wide py-12"><SignedOut message="This account is not a driver account. Sign out and use a driver account to continue." /></section>;
  if (!session.user.phoneNumberVerified || driver.missingProfile) {
    return <section className="container-wide py-12"><SignedOut message="Finish driver setup — verify your phone and create your driver profile — to unlock the dashboard." /></section>;
  }

  const { profile, activeRide, requests } = driver;
  const firstName = session.user.name?.split(" ")[0] || "driver";
  const online = Boolean(profile?.is_available);

  return (
    <section className="container-wide py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow mb-3">Volunteer driver dashboard</p>
          <h1 className="page-title">Welcome back, {firstName}.</h1>
          <p className="mt-4 text-sm text-muted">Small journeys. Real possibilities.</p>
        </div>
        {profile && (
          <span className={`chip ${profile.is_verified ? "text-accent" : "text-gold"}`}>
            {profile.is_verified ? "Verified driver" : "Awaiting verification"}
          </span>
        )}
      </div>
      {(notice || driver.error) && <p role="alert" className="mb-6 rounded-xl border border-gold/50 p-4 text-sm text-gold">{notice || driver.error}</p>}
      {!driver.loaded ? (
        <p role="status" className="panel p-8">Loading driver tools…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
          <div className="space-y-6">
            <div className="panel flex flex-wrap items-center gap-5 p-6">
              <span className="flex size-16 items-center justify-center rounded-t-full rounded-b-xl bg-raised text-accent"><UserRound size={34} strokeWidth={1.2} /></span>
              <div className="flex-1">
                <h2 className="font-serif text-2xl">{session.user.name}</h2>
                <p className="mt-1 text-xs text-muted">{profile?.phone_number} · {session.user.email.endsWith(".invalid") ? "Phone account" : session.user.email}</p>
              </div>
              <button className="chip" onClick={async () => { await authClient.signOut(); router.push("/"); }}>Sign out</button>
            </div>

            {activeRide && (
              <Link href={`/driver/requests/${activeRide.id}`} className="panel block border-accent p-6 hover:border-accent">
                <p className="eyebrow mb-3">Your active ride · {activeRide.status.replaceAll("_", " ")}</p>
                <p className="flex items-center gap-2 text-lg"><MapPin size={18} className="text-accent" />{activeRide.pickup_address ?? "Shared location"}</p>
                <p className="mt-2 text-sm text-muted">Pick up {activeRide.first_name} → {activeRide.shelter_name}</p>
                <p className="mt-4 text-xs text-accent">Open ride details →</p>
              </Link>
            )}

            <div className="panel p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-serif text-2xl">Open ride requests</h2>
                <span className="text-xs text-muted">{online ? "Refreshes every 10 s" : ""}</span>
              </div>
              {activeRide ? (
                <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Finish your active ride to see new requests.</p>
              ) : !online ? (
                <div className="rounded-xl border border-dashed border-line p-8 text-center">
                  <Car size={28} strokeWidth={1.3} className="mx-auto mb-3 text-muted" />
                  <p className="text-sm">Take a breather. You&apos;re offline.</p>
                  <p className="mt-2 text-xs text-muted">{profile?.is_verified ? "Go online to see riders who need a lift." : "You can go online once your profile is verified."}</p>
                </div>
              ) : requests.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">No one is waiting right now. We&apos;ll show new requests here.</p>
              ) : (
                <div className="space-y-3">
                  {requests.map((request) => (
                    <div key={request.id} className="rounded-xl border border-line bg-background p-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm"><MapPin size={17} className="text-accent" />{request.pickup_area}</span>
                        <span className="text-[11px] text-muted">{timeAgo(request.created_at)}</span>
                      </div>
                      <p className="mt-3 text-xs text-muted">To {request.shelter_name}</p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          className="btn btn-primary"
                          disabled={busy}
                          onClick={() => act(async () => { await acceptRide(request.id); router.push(`/driver/requests/${request.id}`); }, "Could not accept this ride.")}
                        >
                          Accept ride <ArrowRight size={16} />
                        </button>
                        <Link href={`/driver/requests/${request.id}`} className="btn btn-secondary">Details <ArrowUpRight size={16} /></Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="panel p-6">
              <h2 className="font-serif text-2xl">Your availability</h2>
              <p className="mb-6 mt-3 text-xs leading-6 text-muted">Go online when you&apos;re ready to lend a hand.</p>
              <Toggle
                checked={online}
                disabled={busy || !profile?.is_verified || Boolean(activeRide)}
                onChange={(value) => act(async () => { await setDriverAvailability(value); }, "Could not change availability.")}
                label={online ? "Online · Accepting requests" : "Offline · Not accepting requests"}
              />
              <div className="mt-6 border-t border-line pt-6">
                <div className="mb-4 flex items-center gap-2 text-sm"><MessageSquare size={17} className="text-accent" />Ride-request text alerts</div>
                <Toggle
                  checked={Boolean(profile?.sms_notifications_enabled)}
                  disabled={busy}
                  onChange={(value) => act(async () => { await updateDriverPreferences(value); }, "Could not update SMS alerts.")}
                  label="Text me new requests while I'm online"
                />
                <p className="mt-3 text-[11px] leading-6 text-muted">Sent to {profile?.phone_number}. Message and data rates may apply. Reply STOP to opt out.</p>
              </div>
            </div>
            <NeighborhoodMap className="h-64 rounded-2xl border border-line" />
            <div className="rounded-xl border border-line p-5">
              <p className="flex items-center gap-2 text-sm"><ShieldCheck size={18} className="text-accent" />Privacy along the way</p>
              <p className="mt-3 text-xs leading-6 text-muted">Rider names are only shared with the driver who accepts the request.</p>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={`flex items-center justify-between gap-4 text-xs ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-gold ${checked ? "justify-end bg-accent" : "justify-start bg-line"}`}>
        <span className="size-5 rounded-full bg-background" />
      </span>
    </label>
  );
}

export function DriverRequest({ id }: { id: string }) {
  const rideId = Number(id);
  const { data: session, isPending } = authClient.useSession();
  const ready = Boolean(session && session.user.role === "driver" && session.user.phoneNumberVerified);
  const driver = useDriverState(ready);
  const [finished, setFinished] = useState<AssignedRide | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function act(action: () => Promise<AssignedRide>, fallback: string) {
    setBusy(true);
    setNotice("");
    try {
      const ride = await action();
      if (ride.status === "COMPLETED" || ride.status === "CANCELLED") setFinished(ride);
      await driver.refresh();
    } catch (error) {
      setNotice(errorText(error, fallback));
      await driver.refresh();
    } finally {
      setBusy(false);
    }
  }

  const back = <Link href="/driver-profile" className="text-xs text-muted">← Driver dashboard</Link>;
  if (isPending) return <section className="container-wide max-w-4xl py-12"><p role="status" className="panel p-8">Loading…</p></section>;
  if (!ready || driver.missingProfile) return <section className="container-wide max-w-4xl py-12">{back}<SignedOut message="Sign in with a verified driver account to view ride requests." /></section>;

  const assigned = finished?.id === rideId ? finished : driver.activeRide?.id === rideId ? driver.activeRide : null;
  const pending = driver.requests.find((request) => request.id === rideId) ?? null;

  return (
    <section className="container-wide max-w-4xl py-12">
      {back}
      <p className="eyebrow mb-4 mt-8">Ride request #{rideId}</p>
      <h1 className="page-title">A neighbor needs a way there.</h1>
      {notice && <p role="alert" className="mt-6 rounded-xl border border-gold/50 p-4 text-sm text-gold">{notice}</p>}
      <div className="panel my-8 p-7">
        {!driver.loaded ? (
          <p role="status" className="text-sm text-muted">Loading ride…</p>
        ) : assigned ? (
          <>
            <p className="text-xs uppercase tracking-widest text-accent">{assigned.status.replaceAll("_", " ")}</p>
            <div className="my-7 space-y-6">
              <div>
                <p className="mb-2 text-xs text-muted">Rider</p>
                <p className="text-lg">{assigned.first_name} {assigned.last_name}</p>
              </div>
              <div>
                <p className="mb-2 text-xs text-muted">Pickup location</p>
                <p className="flex items-center gap-2 text-lg"><MapPin size={18} className="text-accent" />{assigned.pickup_address ?? `${assigned.pickup_latitude}, ${assigned.pickup_longitude}`}</p>
                {assigned.pickup_address && (
                  <a className="mt-2 inline-block text-xs text-accent" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(assigned.pickup_address)}`}>Open directions →</a>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs text-muted">Destination</p>
                <p className="text-lg">{assigned.shelter_name}</p>
                <p className="mt-1 text-xs text-muted">{assigned.shelter_address} · Shelter admission is not guaranteed.</p>
              </div>
            </div>
            {assigned.status === "ACCEPTED" && (
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-primary" disabled={busy} onClick={() => act(() => updateRideStatus(rideId, "IN_PROGRESS"), "Could not start the ride.")}>Rider picked up — start ride <ArrowRight size={16} /></button>
                <button className="btn btn-secondary" disabled={busy} onClick={() => { if (confirm("Cancel this ride? The rider will see it as cancelled.")) void act(() => updateRideStatus(rideId, "CANCELLED"), "Could not cancel the ride."); }}>Cancel ride</button>
              </div>
            )}
            {assigned.status === "IN_PROGRESS" && (
              <button className="btn btn-primary" disabled={busy} onClick={() => act(() => updateRideStatus(rideId, "COMPLETED"), "Could not complete the ride.")}>Arrived — complete ride <CheckCircle2 size={16} /></button>
            )}
            {(assigned.status === "COMPLETED" || assigned.status === "CANCELLED") && (
              <div className="flex flex-wrap items-center gap-4">
                <p className="text-sm">{assigned.status === "COMPLETED" ? "Ride complete. Thank you for driving." : "Ride cancelled."}</p>
                <Link href="/driver-profile" className="btn btn-secondary">Back to dashboard</Link>
              </div>
            )}
          </>
        ) : pending ? (
          <>
            <p className="text-xs uppercase tracking-widest text-accent">Waiting for a driver · {timeAgo(pending.created_at)}</p>
            <div className="my-7 space-y-6">
              <div>
                <p className="mb-2 text-xs text-muted">Pickup area</p>
                <p className="flex items-center gap-2 text-lg"><MapPin size={18} className="text-accent" />{pending.pickup_area}</p>
              </div>
              <div>
                <p className="mb-2 text-xs text-muted">Destination</p>
                <p className="text-lg">{pending.shelter_name}</p>
              </div>
            </div>
            <button className="btn btn-primary" disabled={busy} onClick={() => act(() => acceptRide(rideId), "Could not accept this ride.")}>Accept ride <ArrowRight size={16} /></button>
            <p className="mt-4 text-xs text-muted">The rider&apos;s name is shared once you accept.</p>
          </>
        ) : (
          <div className="py-4">
            <p className="text-sm">This request is no longer available.</p>
            <p className="mt-2 text-xs text-muted">
              {driver.activeRide ? "You already have an active ride." : driver.profile?.is_available ? "Another driver may have accepted it." : "Go online from your dashboard to see open requests."}
            </p>
            <Link href="/driver-profile" className="btn btn-secondary mt-5">Back to dashboard</Link>
          </div>
        )}
      </div>
    </section>
  );
}
