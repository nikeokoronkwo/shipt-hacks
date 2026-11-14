"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Car, Check, MapPin, ShieldCheck } from "lucide-react";
import { NeighborhoodMap } from "@/components/neighborhood-map";
import { shelters } from "@/lib/demo-data";

type Ride = { id: string; shelterId: number; status: string };
const statuses = ["PENDING", "ACCEPTED", "IN_PROGRESS", "COMPLETED"];
const descriptions: Record<string, string> = { PENDING: "Looking for a helping hand.", ACCEPTED: "A volunteer is on the way.", IN_PROGRESS: "On your way to somewhere safe.", COMPLETED: "Your demo journey is complete." };

export function RideTracker() {
  const [ride, setRide] = useState<Ride | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    // Read after mount to avoid SSR hydration differences.
    const timer = setTimeout(() => {
      try {
        const value = JSON.parse(sessionStorage.getItem("wayfinder-demo-ride") || "null");
        if (value && typeof value.id === "string" && shelters.some(s => s.id === value.shelterId) && statuses.includes(value.status)) setRide(value);
      } catch { setError("No saved demo ride could be read. Start a new request below."); }
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  const shelter = shelters.find(s => s.id === ride?.shelterId);
  function advance() {
    if (!ride) return;
    const next = { ...ride, status: statuses[Math.min(statuses.indexOf(ride.status) + 1, statuses.length - 1)] };
    try { sessionStorage.setItem("wayfinder-demo-ride", JSON.stringify(next)); setRide(next); }
    catch { setError("Browser storage is unavailable. The demo status could not be saved."); }
  }
  return <section className="container-wide py-12"><p className="eyebrow mb-3">A little peace of mind</p><h1 className="page-title">Your ride, one step at a time.</h1><p className="mb-8 mt-4 text-sm text-muted">Frontend preview only. No driver is dispatched and no live GPS is collected.</p>{error && <p role="alert" className="mb-5 text-sm text-gold">{error}</p>}
    {!ready ? <p role="status" className="panel p-8">Loading demo ride…</p> : !ride ? <div className="panel mx-auto my-10 max-w-xl p-10 text-center"><Car className="mx-auto mb-5 text-accent" size={36} strokeWidth={1.3} /><h2 className="font-serif text-3xl">Your next step starts here.</h2><p className="my-5 text-sm leading-7 text-muted">There isn’t a demo ride in this browser session yet. Choose a shelter to try the request and tracking flow.</p><Link href="/find-shelter" className="btn btn-primary">Find a shelter <ArrowRight size={16} /></Link></div> : <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]"><div className="space-y-5"><div className="panel p-7"><span className="chip bg-accent/10 text-accent">Demo · {ride.status.replaceAll("_", " ")}</span><h2 className="my-5 font-serif text-3xl">{descriptions[ride.status]}</h2><p className="break-all text-xs text-muted">Reference: {ride.id}</p><ol className="mt-8 space-y-6">{statuses.map((status, i) => <li key={status} className={`flex items-center gap-3 text-sm ${i <= statuses.indexOf(ride.status) ? "text-accent" : "text-muted"}`}><span className="flex size-7 items-center justify-center rounded-full border border-current text-xs">{i < statuses.indexOf(ride.status) ? <Check size={14} /> : i + 1}</span>{["Request created", "Driver accepts", "Ride in progress", "Trip completed"][i]}</li>)}</ol></div><div className="panel p-6"><p className="eyebrow mb-3">Demo destination</p><p className="flex items-start gap-2 text-sm"><MapPin size={17} className="shrink-0 text-accent" />{shelter?.name}</p><p className="mt-4 text-xs leading-6 text-muted">Shelter admission is not confirmed by this request.</p></div><div className="rounded-xl border border-dashed border-line p-5"><p className="mb-4 text-xs leading-6 text-gold">Demo controls: manually preview each state. These buttons do not update a real ride.</p><button onClick={advance} disabled={ride.status === "COMPLETED"} className="btn btn-secondary w-full">{ride.status === "COMPLETED" ? "Demo complete" : "Preview next status"}<ArrowRight size={15} /></button></div></div><div><NeighborhoodMap className="h-[500px] rounded-2xl border border-line" selected={ride.shelterId} /><p className="mt-4 flex items-center gap-2 text-xs text-muted"><ShieldCheck size={15} />Birmingham map, not live vehicle tracking or navigation.</p></div></div>}
  </section>;
}
