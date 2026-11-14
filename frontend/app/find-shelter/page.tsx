import type { Metadata } from "next";
import { ShelterSearch } from "@/components/shelter-search";
export const metadata: Metadata = { title: "Find shelter" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const filter = typeof params.filter === "string" ? params.filter : "All Beds";
  return <ShelterSearch key={`${q}:${filter}`} initialQuery={q} initialFilter={filter} />;
}
