"use client";

import { authClient } from "@/lib/auth-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Shelter = {
  id: number;
  name: string;
  address: string;
  total_beds: number;
  available_beds: number;
  food_available: boolean;
  services: string[];
};

export type RideCreated = {
  id: number;
  status: string;
  tracking_token: string;
};

export type DriverProfile = {
  id: number;
  auth_user_id: string;
  phone_number: string;
  is_verified: boolean;
  is_available: boolean;
  sms_notifications_enabled: boolean;
};

type ApiOptions = RequestInit & { authenticated?: boolean };

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { authenticated = false, headers, ...request } = options;
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");

  if (authenticated) {
    const { data, error } = await authClient.token();
    if (error || !data?.token) {
      throw new Error("Your session has expired. Sign in again to continue.");
    }
    requestHeaders.set("Authorization", `Bearer ${data.token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...request,
      headers: requestHeaders,
    });
  } catch {
    throw new ApiError("Could not reach the Hermes API. Is the FastAPI service running on port 8000?", 0);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      detail?: unknown;
    } | null;
    const detail = typeof body?.detail === "string" ? body.detail : undefined;
    throw new ApiError(detail ?? `Request failed (${response.status}).`, response.status);
  }
  return response.json() as Promise<T>;
}

export function listShelters() {
  return apiFetch<Shelter[]>("/api/shelters");
}

export function requestRide(payload: {
  first_name: string;
  last_name: string;
  pickup_address: string;
  shelter_id: number;
}) {
  return apiFetch<RideCreated>("/api/rides", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getDriverProfile() {
  return apiFetch<DriverProfile>("/api/drivers/me", { authenticated: true });
}

export function initializeDriver(sms_notifications_enabled: boolean) {
  return apiFetch<DriverProfile>("/api/drivers/me/initialize", {
    method: "POST",
    authenticated: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sms_notifications_enabled }),
  });
}

export function updateDriverPreferences(sms_notifications_enabled: boolean) {
  return apiFetch<DriverProfile>("/api/drivers/me", {
    method: "PATCH",
    authenticated: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sms_notifications_enabled }),
  });
}

export type DriverRideRequest = {
  id: number;
  pickup_area: string;
  shelter_id: number;
  shelter_name: string;
  status: string;
  created_at: string;
};

export type AssignedRide = {
  id: number;
  first_name: string;
  last_name: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  pickup_address: string | null;
  shelter_id: number;
  shelter_name: string;
  shelter_address: string;
  status: "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  accepted_at: string | null;
  completed_at: string | null;
};

export type PublicRide = {
  id: number;
  shelter_id: number;
  shelter_name: string;
  status: "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  driver_assigned: boolean;
};

/** Error carrying the HTTP status so callers can tell "no profile yet" apart. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function setDriverAvailability(is_available: boolean) {
  return apiFetch<DriverProfile>("/api/drivers/me/availability", {
    method: "PATCH",
    authenticated: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_available }),
  });
}

export function listDriverRequests() {
  return apiFetch<DriverRideRequest[]>("/api/drivers/requests", { authenticated: true });
}

export function getActiveRide() {
  return apiFetch<AssignedRide | null>("/api/drivers/me/active-ride", { authenticated: true });
}

export function acceptRide(rideId: number) {
  return apiFetch<AssignedRide>(`/api/rides/${rideId}/accept`, {
    method: "POST",
    authenticated: true,
  });
}

export function updateRideStatus(rideId: number, status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED") {
  return apiFetch<AssignedRide>(`/api/rides/${rideId}/status`, {
    method: "PATCH",
    authenticated: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export function getPublicRide(rideId: number, trackingToken: string) {
  return apiFetch<PublicRide>(`/api/rides/${rideId}`, {
    headers: { "X-Tracking-Token": trackingToken },
  });
}

/** The rider's own ride reference, kept only for this browser tab. */
export type SavedRide = { id: number; token: string; shelterName: string };
const SAVED_RIDE_KEY = "hermes-ride";

export function saveRide(ride: SavedRide) {
  sessionStorage.setItem(SAVED_RIDE_KEY, JSON.stringify(ride));
}

export function loadSavedRide(): SavedRide | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(SAVED_RIDE_KEY) ?? "null") as Partial<SavedRide> | null;
    if (value && typeof value.id === "number" && typeof value.token === "string") {
      return { id: value.id, token: value.token, shelterName: String(value.shelterName ?? "") };
    }
  } catch {
    // Storage can be blocked or hold an old value; treat as no saved ride.
  }
  return null;
}

export function clearSavedRide() {
  try {
    sessionStorage.removeItem(SAVED_RIDE_KEY);
  } catch {
    // Nothing to clear.
  }
}
