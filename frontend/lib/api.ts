"use client";

import { authClient } from "@/lib/auth-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Shelter = {
  id: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  updated_at: string;
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
  vehicle_make: string;
  vehicle_model: string;
  vehicle_color: string;
  license_plate: string;
};

type ApiOptions = RequestInit & { authenticated?: boolean };

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

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
    signal: request.signal ? AbortSignal.any([request.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === "TimeoutError") throw new Error("The shelter service took too long to respond. Please try again.");
    throw error;
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      detail?: string | { msg: string; loc?: (string | number)[] }[];
    } | null;
    const detail = body?.detail;
    throw new ApiError(typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map(item => `${item.loc?.slice(1).join(".") || "Request"}: ${item.msg}`).join("; ") : `Request failed (${response.status}).`, response.status);
  }
  return response.json() as Promise<T>;
}

export function listShelters() {
  return apiFetch<Shelter[]>("/api/shelters");
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

export function getDriverProfile() {
  return apiFetch<DriverProfile>("/api/drivers/me", { authenticated: true });
}

export function initializeDriver(payload: {
  phone_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_color: string;
  license_plate: string;
  sms_notifications_enabled: boolean;
}) {
  return apiFetch<DriverProfile>("/api/drivers/me/initialize", {
    method: "POST",
    authenticated: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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
