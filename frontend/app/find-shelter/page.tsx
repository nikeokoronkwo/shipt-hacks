import type { Metadata } from "next";
import { Suspense } from "react";
import { ShelterSearch } from "@/components/shelter-search";

export const metadata: Metadata = { title: "Find shelter" };
type SearchProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function Page({ searchParams }: SearchProps) {
  return <Suspense fallback={<p className="container-wide py-12" role="status">Loading shelter search…</p>}>
    <SearchResults searchParams={searchParams} />
  </Suspense>;
}

async function SearchResults({ searchParams }: SearchProps) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const filter = typeof params.filter === "string" ? params.filter : "All Beds";
  return <ShelterSearch key={`${q}:${filter}`} initialQuery={q} initialFilter={filter} />;
}
