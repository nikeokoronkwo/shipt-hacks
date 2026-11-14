"use client";

import { authClient } from "@/lib/auth-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Shelter = {
  id: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  total_beds: number;
  available_beds: number;
  food_available: boolean;
  services: string[];
  updated_at: string;
};

export type RideCreated = {
  id: number;
  status: string;
  tracking_token: string;
};

export type RideStatus = {
  id: number;
  shelter_id: number;
  status: string;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  driver_assigned: boolean;
};

export type VehicleProfile = {
  id: number;
  make: string;
  model: string;
  color: string;
  license_plate: string;
};

export type ActiveRide = {
  id: number;
  first_name: string;
  last_name: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  pickup_address: string | null;
  shelter_id: number;
  status: string;
  accepted_at: string | null;
};

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
  status: string;
  accepted_at: string | null;
};

export type RideStatusUpdate = "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type DriverProfile = {
  id: number;
  auth_user_id: string;
  phone_number: string;
  is_verified: boolean;
  is_available: boolean;
  sms_notifications_enabled: boolean;
  vehicle: VehicleProfile | null;
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...request,
    headers: requestHeaders,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(body?.detail ?? `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export function listShelters() {
  return apiFetch<Shelter[]>("/api/shelters");
}

export function getShelter(shelterId: number) {
  return apiFetch<Shelter>(`/api/shelters/${shelterId}`);
}

export function requestRide(payload: {
  first_name: string;
  last_name: string;
  pickup_address?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  shelter_id: number;
}) {
  return apiFetch<RideCreated>("/api/rides", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getRideStatus(rideId: number, trackingToken: string) {
  return apiFetch<RideStatus>(`/api/rides/${rideId}`, {
    headers: { "X-Tracking-Token": trackingToken },
  });
}

export function getDriverProfile() {
  return apiFetch<DriverProfile>("/api/drivers/me", { authenticated: true });
}

export function initializeDriver(
  sms_notifications_enabled: boolean,
  vehicle: Omit<VehicleProfile, "id">,
) {
  return apiFetch<DriverProfile>("/api/drivers/me/initialize", {
    method: "POST",
    authenticated: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sms_notifications_enabled, vehicle }),
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

export function updateDriverVehicle(vehicle: Omit<VehicleProfile, "id">) {
  return apiFetch<DriverProfile>("/api/drivers/me/vehicle", {
    method: "PATCH",
    authenticated: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vehicle),
  });
}

export function updateDriverAvailability(is_available: boolean) {
  return apiFetch<DriverProfile>("/api/drivers/me/availability", {
    method: "PATCH",
    authenticated: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_available }),
  });
}

export function getActiveRide() {
  return apiFetch<ActiveRide | null>("/api/drivers/me/active-ride", { authenticated: true });
}

export function listDriverRequests() {
  return apiFetch<DriverRideRequest[]>("/api/drivers/requests", { authenticated: true });
}

export function acceptDriverRide(rideId: number) {
  return apiFetch<AssignedRide>(`/api/rides/${rideId}/accept`, {
    method: "POST",
    authenticated: true,
  });
}

export function updateDriverRideStatus(rideId: number, status: RideStatusUpdate) {
  return apiFetch<AssignedRide>(`/api/rides/${rideId}/status`, {
    method: "PATCH",
    authenticated: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}
