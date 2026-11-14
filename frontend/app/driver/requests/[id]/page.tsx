import { notFound } from "next/navigation";
import { DriverRequest } from "@/components/driver-dashboard";
export const metadata = { title: "Ride request" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <DriverRequest id={id} />;
}
