"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Car, Check, MapPin, ShieldCheck } from "lucide-react";

import { NeighborhoodMap } from "@/components/neighborhood-map";
import { ApiError, clearSavedRide, getPublicRide, loadSavedRide, saveRide, type PublicRide, type SavedRide } from "@/lib/api";
import { shelters } from "@/lib/demo-data";

const POLL_MS = 5_000;
const statuses = ["PENDING", "ACCEPTED", "IN_PROGRESS", "COMPLETED"] as const;
const labels = ["Request sent", "Driver on the way", "Ride in progress", "Arrived"];
const descriptions: Record<PublicRide["status"], string> = {
  PENDING: "Finding a volunteer driver near you…",
  ACCEPTED: "A volunteer driver accepted and is on the way.",
  IN_PROGRESS: "On your way to somewhere safe.",
  COMPLETED: "You've arrived. We hope tonight is a little easier.",
  CANCELLED: "This ride was cancelled.",
};

/** Ride from ?ride=<id>#<token> (shareable within the device) or this tab's storage. */
function initialRide(): SavedRide | null {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("ride"));
  const token = decodeURIComponent(window.location.hash.slice(1));
  if (Number.isInteger(id) && id > 0 && token) return { id, token, shelterName: "" };
  return loadSavedRide();
}

export function RideTracker() {
  const [saved, setSaved] = useState<SavedRide | null>(null);
  const [ride, setRide] = useState<PublicRide | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Read after mount to avoid SSR hydration differences.
    const timer = setTimeout(() => {
      setSaved(initialRide());
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!saved) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const next = await getPublicRide(saved.id, saved.token);
        if (cancelled) return;
        setRide(next);
        setError("");
        try { saveRide({ ...saved, shelterName: next.shelter_name }); } catch { /* storage optional */ }
        if (next.status === "COMPLETED" || next.status === "CANCELLED") return;
      } catch (caught) {
        if (cancelled) return;
        if (caught instanceof ApiError && (caught.status === 404 || caught.status === 401)) {
          setError("We couldn't find that ride. Check the ride number and tracking code.");
          setRide(null);
          return;
        }
        setError(caught instanceof Error ? caught.message : "Could not check your ride.");
      }
      timer = setTimeout(poll, POLL_MS);
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [saved]);

  function lookUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const id = Number(values.get("ride"));
    const token = String(values.get("token") ?? "").trim();
    if (!Number.isInteger(id) || id <= 0 || !token) return;
    setRide(null);
    setSaved({ id, token, shelterName: "" });
  }

  function forget() {
    clearSavedRide();
    window.history.replaceState(null, "", "/track-ride");
    setSaved(null);
    setRide(null);
    setError("");
  }

  const step = ride ? statuses.indexOf(ride.status as (typeof statuses)[number]) : -1;
  const mapShelter = shelters.find((shelter) => shelter.name === ride?.shelter_name);

  return (
    <section className="container-wide py-12">
      <p className="eyebrow mb-3">A little peace of mind</p>
      <h1 className="page-title">Your ride, one step at a time.</h1>
      <p className="mb-8 mt-4 text-sm text-muted">This page updates automatically. Keep it open while you wait.</p>
      {error && <p role="alert" className="mb-5 text-sm text-gold">{error}</p>}
      {!ready ? (
        <p role="status" className="panel p-8">Loading your ride…</p>
      ) : !saved || (!ride && error) ? (
        <div className="panel mx-auto my-10 max-w-xl p-10">
          <Car className="mx-auto mb-5 text-accent" size={36} strokeWidth={1.3} />
          <h2 className="text-center font-serif text-3xl">Track a ride</h2>
          <p className="my-5 text-center text-sm leading-7 text-muted">Enter the ride number and private tracking code from your request, or choose a shelter to request a new ride.</p>
          <form onSubmit={lookUp} className="space-y-4">
            <label className="block text-xs text-muted">Ride number<input name="ride" required inputMode="numeric" pattern="\d+" className="field mt-2" /></label>
            <label className="block text-xs text-muted">Tracking code<input name="token" required autoComplete="off" className="field mt-2" /></label>
            <button className="btn btn-primary w-full">Check my ride <ArrowRight size={16} /></button>
          </form>
          <Link href="/find-shelter" className="mt-6 block text-center text-sm text-accent">Find a shelter →</Link>
        </div>
      ) : !ride ? (
        <p role="status" className="panel p-8">Checking your ride…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <div className="space-y-5">
            <div className="panel p-7">
              <span className="chip bg-accent/10 text-accent">{ride.status.replaceAll("_", " ")}</span>
              <h2 className="my-5 font-serif text-3xl">{descriptions[ride.status]}</h2>
              <p className="text-xs text-muted">Ride #{ride.id}</p>
              {ride.status !== "CANCELLED" && (
                <ol className="mt-8 space-y-6">
                  {statuses.map((status, index) => (
                    <li key={status} className={`flex items-center gap-3 text-sm ${index <= step ? "text-accent" : "text-muted"}`}>
                      <span className="flex size-7 items-center justify-center rounded-full border border-current text-xs">
                        {index < step || ride.status === "COMPLETED" ? <Check size={14} /> : index + 1}
                      </span>
                      {labels[index]}
                    </li>
                  ))}
                </ol>
              )}
              {ride.status === "CANCELLED" && <Link href="/find-shelter" className="btn btn-primary mt-6">Request a new ride <ArrowRight size={16} /></Link>}
            </div>
            <div className="panel p-6">
              <p className="eyebrow mb-3">Destination</p>
              <p className="flex items-start gap-2 text-sm"><MapPin size={17} className="shrink-0 text-accent" />{ride.shelter_name}</p>
              <p className="mt-4 text-xs leading-6 text-muted">Shelter admission is not confirmed by this request.</p>
            </div>
            <div className="rounded-xl border border-dashed border-line p-5">
              <p className="text-xs leading-6 text-muted">Private tracking code — save it to check this ride from another device:</p>
              <code className="mt-2 block break-all text-xs text-accent">{saved.token}</code>
              <button onClick={forget} className="mt-4 text-xs text-muted hover:text-ink">Forget this ride on this device</button>
            </div>
          </div>
          <div>
            <NeighborhoodMap className="h-[500px] rounded-2xl border border-line" selected={mapShelter?.id} />
            <p className="mt-4 flex items-center gap-2 text-xs text-muted"><ShieldCheck size={15} />Birmingham map, not live vehicle tracking or navigation.</p>
          </div>
        </div>
      )}
    </section>
  );
}
