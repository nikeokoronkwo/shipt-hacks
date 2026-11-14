"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BedDouble, Check, MapPin, Share2, ShieldCheck } from "lucide-react";
import { NeighborhoodMap } from "@/components/neighborhood-map";
import type { Shelter } from "@/lib/demo-data";
import { listShelters, requestRide, saveRide } from "@/lib/api";

export function ShelterDetails({ shelter }: { shelter: Shelter }) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [shared, setShared] = useState("");
  const [requestError, setRequestError] = useState("");
  const [sending, setSending] = useState(false);
  const router = useRouter();
  async function request(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setSending(true);
    setRequestError("");
    try {
      // The listing page uses design fixtures; the API owns the live record.
      const live = (await listShelters()).find(s => s.name === shelter.name);
      if (!live) throw new Error("This shelter is not in the live network yet. Restart the API to load the demo shelters.");
      const created = await requestRide({
        first_name: String(values.get("first_name") ?? "").trim(),
        last_name: String(values.get("last_name") ?? "").trim(),
        pickup_address: String(values.get("pickup") ?? "").trim(),
        shelter_id: live.id,
      });
      try { saveRide({ id: created.id, token: created.tracking_token, shelterName: live.name }); } catch { /* the URL below still carries the token */ }
      router.push(`/track-ride?ride=${created.id}#${encodeURIComponent(created.tracking_token)}`);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Could not request a ride.");
      setSending(false);
    }
  }
  return <section className="container-wide py-10"><Link href="/find-shelter" className="mb-8 inline-flex items-center gap-2 text-xs text-muted hover:text-accent"><ArrowLeft size={15} />Back to shelters</Link><div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
    <div><div className="mb-6 flex items-center gap-2 text-xs text-accent"><span className="size-1.5 rounded-full bg-accent" /> Birmingham · Sample facility</div><h1 className="page-title">{shelter.name}</h1><p className="mt-4 flex items-center gap-2 text-sm text-muted"><MapPin size={16} />{shelter.address}</p><div className="my-6 flex flex-wrap gap-2">{shelter.tags.map(tag => <span className="chip text-muted" key={tag}>{tag}</span>)}</div><NeighborhoodMap className="h-[340px] rounded-2xl border border-line" selected={shelter.id} /><div className="mt-7 flex items-center justify-between"><h2 className="font-serif text-2xl">A little more information</h2><button className="chip" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setShared("Demo listing link copied."); } catch { setShared("Copy the page URL from your address bar."); } }}><Share2 size={14} />Share</button></div><p role="status" className="mt-2 text-xs text-accent">{shared}</p><dl className="mt-3 divide-y divide-line">{[["Sample intake hours", shelter.intake], ["Who this demo serves", shelter.audience], ["Accessibility", shelter.tags.includes("ADA Accessible") ? "Sample accessible facility" : "Contact facility to confirm"], ["Pet policy", shelter.tags.includes("Pet Friendly") ? "Sample pet-friendly facility" : "Confirm with shelter before traveling"]].map(([k, v]) => <div key={k} className="grid gap-2 py-4 text-sm sm:grid-cols-2"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>)}</dl></div>
    <aside className="space-y-5"><div className="panel p-7 sm:p-8"><p className="eyebrow">Sample availability</p><div className="my-7 flex items-center gap-4"><span className="flex size-14 items-center justify-center rounded-full bg-accent/10 text-accent"><BedDouble size={26} /></span><div><p className="font-serif text-5xl text-accent">{shelter.beds}</p><p className="mt-1 text-xs text-muted">demo beds available</p></div></div><p className="mb-6 text-sm leading-7 text-muted">Request a ride and a verified volunteer driver nearby will be asked to pick you up. You don&apos;t need an account.</p><button disabled={!shelter.beds} onClick={() => setRequestOpen(!requestOpen)} className="btn btn-primary w-full" aria-expanded={requestOpen}>{shelter.beds ? "Request a ride here" : "No beds available"}<ArrowRight size={16} /></button><p className="mt-4 text-xs leading-6 text-muted">Reported available beds do not guarantee shelter admission. A ride request is not a bed reservation.</p></div>
      {requestOpen && <form onSubmit={request} className="panel space-y-4 p-6"><h2 className="font-serif text-2xl">Where are we picking you up?</h2><p className="text-xs leading-6 text-muted">We only ask for what a driver needs to find you. Your pickup details are shared only with the driver who accepts.</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-muted">First name<input required name="first_name" maxLength={100} autoComplete="given-name" className="field mt-2" placeholder="Alex" /></label><label className="text-xs text-muted">Last name<input required name="last_name" maxLength={100} autoComplete="family-name" className="field mt-2" placeholder="Morgan" /></label></div><label className="block text-xs text-muted">Pickup address<input required name="pickup" maxLength={400} className="field mt-2" placeholder="Address, landmark, or intersection" /></label><label className="flex items-start gap-3 text-xs leading-6 text-muted"><input type="checkbox" required className="mt-1.5" />I understand a ride request is not a bed reservation, and shelter admission is not guaranteed.</label>{requestError && <p role="alert" className="text-sm text-gold">{requestError}</p>}<button disabled={sending} className="btn btn-primary w-full">{sending ? "Finding a driver…" : "Find me a driver"} <Check size={16} /></button></form>}
      <div className="flex gap-3 rounded-xl border border-line p-5"><ShieldCheck size={23} className="shrink-0 text-accent" /><div><p className="text-sm">Your privacy comes first.</p><p className="mt-2 text-xs leading-6 text-muted">Your ride reference and private tracking code stay in this browser tab. Only the accepting driver sees your name and pickup point.</p></div></div><Link href="/emergency-contacts" className="block text-center text-sm text-accent">Need real assistance? View resources →</Link>
    </aside>
  </div></section>;
}
