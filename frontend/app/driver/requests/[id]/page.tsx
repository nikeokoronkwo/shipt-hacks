import { notFound } from "next/navigation";
import { DriverRequest } from "@/components/driver-dashboard";
export const metadata = { title: "Demo ride request" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; if (id !== "123") notFound(); return <DriverRequest id={id} />; }
