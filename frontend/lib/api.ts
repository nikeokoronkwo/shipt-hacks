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

export function initializeDriver(phone_number: string) {
  return apiFetch("/api/drivers/me/initialize", {
    method: "POST",
    authenticated: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number }),
  });
}
