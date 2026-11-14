"use client";

import { useState } from "react";
import { getPickupCoordinates, type PickupCoordinates } from "@/lib/location";

export function PickupLocation({ coordinates, onChange }: {
  coordinates: PickupCoordinates | null;
  onChange: (value: PickupCoordinates | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function locate() {
    setBusy(true); setError("");
    try { onChange(await getPickupCoordinates()); }
    catch (error) { setError(error instanceof Error ? error.message : "Location unavailable."); }
    finally { setBusy(false); }
  }
  return <fieldset className="space-y-3">
    <legend className="text-sm">Pickup location</legend>
    <p className="text-xs leading-6 text-muted">Share your current location or enter an address. Your pickup details are sent to the service and shared with your assigned driver.</p>
    <button type="button" disabled={busy} onClick={locate} className="btn btn-secondary">{busy ? "Finding your location…" : "Share my current location"}</button>
    {busy && <p role="status" className="text-xs text-muted">Allow location in your browser’s prompt. This can take up to 15 seconds.</p>}
    {coordinates && <p role="status" className="text-xs text-accent">Location selected: {coordinates.pickup_latitude.toFixed(5)}, {coordinates.pickup_longitude.toFixed(5)} <button type="button" className="underline" onClick={() => onChange(null)}>Remove</button></p>}
    {error && <div className="space-y-3"><p role="alert" className="text-sm text-gold">{error}</p><details className="text-xs leading-6 text-muted"><summary className="cursor-pointer text-accent">How to enable location access</summary><ul className="mt-2 list-disc space-y-2 pl-5"><li>Safari on Mac: Safari → Settings → Websites → Location. Set this website to Ask or Allow.</li><li>macOS: System Settings → Privacy &amp; Security → Location Services. Enable it for Safari Websites (or your browser).</li><li>Chrome or Edge: open the site controls beside the address bar and allow Location.</li><li>After changing permissions, reload this page and select Share my current location again. The app cannot bypass a blocked permission. You can also enter a pickup address below.</li></ul></details></div>}
    <label className="block text-xs text-muted">Pickup address {coordinates ? "(optional meeting instructions)" : "(required without location sharing)"}<input name="pickup_address" required={!coordinates} maxLength={400} className="field mt-2" autoComplete="street-address" placeholder="Street address and meeting point" /></label>
  </fieldset>;
}
