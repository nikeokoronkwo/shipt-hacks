"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { BIRMINGHAM_CENTER, shelters, type Shelter } from "@/lib/demo-data";

const publicToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export function NeighborhoodMap({ className = "", selected, locations = shelters }: { className?: string; selected?: number; locations?: Shelter[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const tokenReady = publicToken?.startsWith("pk.");

  useEffect(() => {
    if (!tokenReady || !container.current) return;
    let cancelled = false;
    let map: import("mapbox-gl").Map | undefined;
    let resize: ResizeObserver | undefined;
    async function initialize() {
      try {
        const { default: mapboxgl } = await import("mapbox-gl");
        if (cancelled || !container.current) return;
        const focus = locations.find(s => s.id === selected);
        map = new mapboxgl.Map({
          container: container.current,
          accessToken: publicToken,
          style: "mapbox://styles/mapbox/dark-v11",
          center: focus?.coordinates ?? BIRMINGHAM_CENTER,
          zoom: selected ? 13 : 11.8,
          attributionControl: true,
          cooperativeGestures: true,
        });
        map.addControl(new mapboxgl.NavigationControl(), "top-right");
        map.addControl(new mapboxgl.ScaleControl({ unit: "imperial" }), "bottom-left");
        locations.forEach(shelter => {
          const marker = document.createElement("a");
          marker.href = `/shelter-details/${shelter.id}`;
          marker.className = `shelter-marker ${selected === shelter.id ? "shelter-marker-selected" : ""}`;
          marker.textContent = `${shelter.beds} beds`;
          marker.setAttribute("aria-label", `${shelter.name}: ${shelter.beds} sample beds. View details`);
          new mapboxgl.Marker({ element: marker }).setLngLat(shelter.coordinates).addTo(map!);
        });
        map.on("load", () => { if (!cancelled) { setLoaded(true); setError(""); } });
        map.on("error", () => { if (!cancelled) setError("Map unavailable. Check your Mapbox token, allowed URLs, and internet connection. Shelter listings are still available."); });
        resize = new ResizeObserver(() => map?.resize());
        resize.observe(container.current);
      } catch {
        if (!cancelled) setError("The map could not start. Check your connection and that your browser supports WebGL.");
      }
    }
    void initialize();
    return () => { cancelled = true; resize?.disconnect(); map?.remove(); };
  }, [tokenReady, selected, locations]);

  return <div className={`relative overflow-hidden bg-[#202d25] ${className}`}>
    <div ref={container} className="absolute inset-0" aria-label="Mapbox map of Birmingham, Alabama" />
    {(!tokenReady || error) && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface p-8 text-center" role="status"><MapPin size={34} strokeWidth={1.2} className="text-accent" /><p className="font-serif text-2xl">Birmingham, Alabama</p><p className="max-w-sm text-sm leading-6 text-muted">{error || "Add your public Mapbox token to show the interactive Birmingham map."}</p>{!tokenReady && <code className="max-w-full break-all rounded-lg border border-line bg-background p-3 text-xs text-accent">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code>}</div>}
    {tokenReady && !loaded && !error && <div role="status" className="absolute left-4 top-4 rounded-full bg-background/90 px-4 py-2 text-xs text-muted">Loading Birmingham map…</div>}
    {loaded && !error && <span className="pointer-events-none absolute left-4 top-4 rounded-full border border-line bg-background/90 px-3 py-2 text-[10px] uppercase tracking-widest text-muted">Birmingham, AL · Demo shelter markers</span>}
  </div>;
}
