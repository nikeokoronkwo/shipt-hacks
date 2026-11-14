import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DriverRequest } from "@/components/driver-dashboard";
export const metadata = { title: "Ride request" };
type Props = { params: Promise<{ id: string }> };
export default function Page({ params }: Props) {
  return <Suspense fallback={<p className="container-wide py-12" role="status">Loading request…</p>}><Request params={params} /></Suspense>;
}
async function Request({ params }: Props) {
  const { id } = await params;
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) notFound();
  return <DriverRequest id={id} />;
}
