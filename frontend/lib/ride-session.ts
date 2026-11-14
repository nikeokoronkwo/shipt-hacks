import type { RideCreated } from "@/lib/api";

const KEY = "wayfinder-ride";
export type SavedRide = Pick<RideCreated, "id" | "tracking_token">;
export function saveRide(ride: SavedRide) {
  sessionStorage.setItem(KEY, JSON.stringify({ id: ride.id, tracking_token: ride.tracking_token }));
}
export function readRide(): SavedRide | null {
  const value = JSON.parse(sessionStorage.getItem(KEY) || "null");
  return value && Number.isInteger(value.id) && value.id > 0 && typeof value.tracking_token === "string" && value.tracking_token ? value : null;
}
