import { notFound } from "next/navigation";
import { ShelterDetails } from "@/components/shelter-details";
import { shelters } from "@/lib/demo-data";
export function generateStaticParams() { return shelters.map(s => ({ id: String(s.id) })); }
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return { title: shelters.find(s => String(s.id) === id)?.name ?? "Shelter not found" }; }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shelter = shelters.find(s => String(s.id) === id);
  if (!shelter) notFound();
  return <ShelterDetails shelter={shelter} />;
}
