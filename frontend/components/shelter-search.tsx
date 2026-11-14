"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listShelters, type Shelter } from "@/lib/api";
import { NeighborhoodMap } from "@/components/neighborhood-map";

export function ShelterSearch({ initialQuery = "", initialFilter = "All Beds" }: { initialQuery?: string; initialFilter?: string }) {
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState(initialFilter);
  const [showFull, setShowFull] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    async function refresh() {
      try { const data = await listShelters(); if (active) { setShelters(data); setError(""); } }
      catch (error) { if (active) setError(error instanceof Error ? error.message : "Could not load shelters."); }
      finally { if (active) setLoading(false); }
    }
    void refresh();
    const timer = setInterval(refresh, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [attempt]);
  const services = [...new Set(shelters.flatMap(s => s.services))];
  const results = shelters.filter(s => (showFull || s.available_beds > 0) &&
    (filter === "All Beds" || s.services.includes(filter)) &&
    `${s.name} ${s.address} ${s.services.join(" ")}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.available_beds - a.available_beds);
  return <section className="container-wide space-y-6 py-12">
    <h1 className="page-title">Find your next safe place.</h1>
    <p className="text-sm text-muted">Availability from the shelter service. Seeded facilities are fictional; reported beds are not a reservation or confirmed admission.</p>
    <label className="block text-sm">Search shelters<input className="field mt-2" value={query} onChange={e => setQuery(e.target.value)} placeholder="Shelter name, address, or service" /></label>
    <label className="block text-sm">Service<select className="field mt-2" value={filter} onChange={e => setFilter(e.target.value)}>{["All Beds", ...services, ...(filter !== "All Beds" && !services.includes(filter) ? [filter] : [])].map(service => <option key={service}>{service}</option>)}</select></label>
    <label className="flex gap-3 text-sm"><input type="checkbox" checked={showFull} onChange={e => setShowFull(e.target.checked)} />Include shelters with no reported beds</label>
    {error && <div role="alert" className="space-y-3 text-gold"><p>Could not load current availability: {error}. {shelters.length ? "Previously loaded results may be out of date." : "No shelter data is available until the service reconnects."}</p><button type="button" className="btn btn-secondary" onClick={() => { setLoading(true); setError(""); setAttempt(value => value + 1); }}>Retry loading shelters</button></div>}
    {loading ? <p role="status">Loading shelters…</p> : <div className="grid gap-6 lg:grid-cols-2"><div className="space-y-4"><h2 className="font-serif text-2xl">{results.length} shelters</h2>
      {results.map(shelter => <Link key={shelter.id} href={`/shelter-details/${shelter.id}`} className="panel block space-y-3 p-6"><h3 className="font-serif text-2xl">{shelter.name}</h3><p className="text-sm text-muted">{shelter.address}</p><p className="text-accent">{shelter.available_beds} reported beds available</p><p className="text-xs text-muted">{shelter.services.join(" · ")}</p></Link>)}
      {!results.length && !error && <div className="space-y-3"><p>{shelters.length ? "No matching shelters. Try another search, service, or include full shelters." : "No shelters have been published yet."}</p>{shelters.length > 0 && <button className="btn btn-secondary" onClick={() => { setQuery(""); setFilter("All Beds"); setShowFull(true); }}>Show all shelters</button>}</div>}
    </div><NeighborhoodMap className="h-[500px] rounded-2xl border border-line" locations={results} /></div>}
  </section>;
}
