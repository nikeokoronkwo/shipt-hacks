import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShelterDetails } from "@/components/shelter-details";

type Props = { params: Promise<{ id: string }> };
export default function Page({ params }: Props) {
  return <Suspense fallback={<p role="status" className="container-wide py-12">Loading shelter…</p>}><Details params={params} /></Suspense>;
}
async function Details({ params }: Props) {
  const { id } = await params;
  const shelterId = Number(id);
  if (!Number.isSafeInteger(shelterId) || shelterId <= 0) notFound();
  return <ShelterDetails id={shelterId} />;
}
