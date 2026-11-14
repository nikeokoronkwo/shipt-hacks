"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, requestRide, type Shelter, type RideCreated } from "@/lib/api";
import { saveRide } from "@/lib/ride-session";
import type { PickupCoordinates } from "@/lib/location";
import { PickupLocation } from "@/components/pickup-location";

export function ShelterDetails({ id }: { id: number }) {
  const [shelter, setShelter] = useState<Shelter | null>(null);
  const [error, setError] = useState("");
  const [coordinates, setCoordinates] = useState<PickupCoordinates | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<RideCreated | null>(null);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    apiFetch<Shelter>(`/api/shelters/${id}`, { signal: controller.signal })
      .then(setShelter).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [id]);
  async function request(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || created) return;
    const values = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const ride = await requestRide({
        first_name: String(values.get("first_name")).trim(),
        last_name: String(values.get("last_name")).trim(),
        pickup_address: String(values.get("pickup_address") || "").trim() || undefined,
        ...coordinates,
        shelter_id: id,
      });
      setCreated(ride);
      try { saveRide(ride); router.push("/track-ride"); }
      catch { setError("Your request was created, but browser storage is blocked. Keep the private reference below; do not submit another request."); }
    } catch (error) { setError(error instanceof Error ? error.message : "Could not request a ride."); }
    finally { setBusy(false); }
  }
  return <section className="container-wide max-w-4xl space-y-6 py-12">
    <Link href="/find-shelter" className="text-accent">← Back to shelters</Link>
    {error && <p role="alert" className="text-gold">{error}</p>}
    {!shelter ? <p role="status">{error ? "Shelter details unavailable." : "Loading shelter…"}</p> : <>
      <h1 className="page-title">{shelter.name}</h1><p>{shelter.address}</p>
      <div className="panel space-y-4 p-6"><p className="text-accent">{shelter.available_beds} reported beds available / {shelter.total_beds} total</p><p>{shelter.food_available ? "Meals available" : "Ask about meals"}</p><p>{shelter.services.join(" · ")}</p><p className="text-xs text-muted">Updated {new Date(shelter.updated_at).toLocaleString()}. Seeded facilities are fictional. Reported beds do not guarantee admission; a ride is not a bed reservation.</p></div>
      {created ? <div role="status" className="panel space-y-3 p-6"><h2>Ride #{created.id} created · {created.status}</h2><p>Private tracking token (keep this secret):</p><code className="break-all">{created.tracking_token}</code><Link className="block text-accent" href="/track-ride">Track your ride</Link></div> :
      <form onSubmit={request} className="panel space-y-5 p-6"><h2 className="font-serif text-2xl">Request a volunteer pickup</h2>
        <div className="grid gap-4 sm:grid-cols-2">{["first_name", "last_name"].map(name => <label key={name} className="text-xs text-muted">{name === "first_name" ? "First name" : "Last name"}<input required maxLength={100} name={name} autoComplete={name === "first_name" ? "given-name" : "family-name"} className="field mt-2" /></label>)}</div>
        <PickupLocation coordinates={coordinates} onChange={setCoordinates} />
        <p className="text-xs text-muted">No account is required. Names and pickup details are sent to the backend, not saved in browser storage. Only your private ride reference is kept in this tab.</p>
        <button disabled={busy || shelter.available_beds === 0} className="btn btn-primary">{busy ? "Sending request…" : shelter.available_beds ? "Request pickup" : "No beds reported available"}</button>
      </form>}
    </>}
  </section>;
}
