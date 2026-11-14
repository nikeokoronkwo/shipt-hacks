"use client";

export type PickupCoordinates = { pickup_latitude: number; pickup_longitude: number };

const TIMEOUT_MESSAGE = "Location lookup timed out. Check the browser’s location prompt, then retry or enter a pickup address.";

export function getPickupCoordinates(): Promise<PickupCoordinates> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext || !navigator.geolocation) {
      reject(new Error("Location sharing requires HTTPS (or localhost) and a supported browser. Enter a pickup address instead."));
      return;
    }
    // A browser may not call either callback while permission is unresolved.
    // Keep our own deadline so the UI can always recover and offer a retry.
    let settled = false;
    const timer = window.setTimeout(() => finish(new Error(TIMEOUT_MESSAGE)), 15000);
    function finish(result: PickupCoordinates | Error) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (result instanceof Error) reject(result);
      else resolve(result);
    }
    try {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude) || Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) {
            finish(new Error("Your browser returned an invalid location. Retry or enter a pickup address."));
            return;
          }
          finish({ pickup_latitude: coords.latitude, pickup_longitude: coords.longitude });
        },
        error => finish(new Error(error.code === 1
          ? "Location permission was denied. Allow location for this website in your browser settings and enable Location Services for your browser in your device settings. Then retry, or enter a pickup address."
          : error.code === 3 ? TIMEOUT_MESSAGE
          : "Your location is unavailable. Enable Location Services for your browser and check your connection, then retry or enter a pickup address.")),
        // Desktop browsers may locate via Wi-Fi rather than GPS. Avoid requiring
        // high accuracy, but still request a fresh position for this pickup.
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
      );
    } catch {
      finish(new Error("Your browser blocked location access. Check site permissions or enter a pickup address."));
    }
  });
}
