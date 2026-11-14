"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { readRide } from "@/lib/ride-session";

type Ride = { id: number; shelter_id: number; status: string; driver_assigned: boolean };
const descriptions: Record<string, string> = {
  PENDING: "Waiting for a volunteer driver.", ACCEPTED: "A volunteer has accepted your request.",
  IN_PROGRESS: "Your ride is in progress.", COMPLETED: "Your ride is complete.", CANCELLED: "Your request was cancelled.",
};
export function RideTracker() {
  const [ride, setRide] = useState<Ride | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const saved = readRide();
        if (!saved) return;
        const data = await apiFetch<Ride>(`/api/rides/${saved.id}`, {
          headers: { "X-Tracking-Token": saved.tracking_token }, cache: "no-store",
        });
        if (active) { setRide(data); setError(""); }
        if (active && !["COMPLETED", "CANCELLED"].includes(data.status)) timer = setTimeout(refresh, 4000);
      } catch (error) {
        if (active) { setError(error instanceof Error ? error.message : "Could not read ride."); timer = setTimeout(refresh, 4000); }
      } finally { if (active) setReady(true); }
    }
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  }, []);
  return <section className="container-wide max-w-3xl space-y-6 py-12"><h1 className="page-title">Your ride, one step at a time.</h1>
    {error && <p role="alert" className="text-gold">Status unavailable: {error}. Any displayed status may be out of date.</p>}
    {!ready ? <p role="status">Loading ride…</p> : !ride ? <div className="panel space-y-4 p-8"><p>No ride status is available in this browser tab.</p><Link href="/find-shelter" className="text-accent">Find a shelter</Link></div> :
      <div className="panel space-y-5 p-8"><p className="text-xs text-muted">Request #{ride.id}</p><p role="status" className="text-accent">{ride.status.replaceAll("_", " ")}</p><h2 className="font-serif text-3xl">{descriptions[ride.status] || ride.status}</h2><p>{ride.driver_assigned ? "Driver assigned" : "No driver assigned yet"}</p><Link href={`/shelter-details/${ride.shelter_id}`} className="text-accent">View destination shelter →</Link><p className="text-xs text-muted">Status updates automatically. This is not live vehicle GPS tracking. Shelter admission is not confirmed. Your tracking token is private and is never included in the URL.</p></div>}
  </section>;
}
