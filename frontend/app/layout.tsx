import type { Metadata } from "next";
import { Suspense } from "react";
import { Shell } from "@/components/shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Wayfinder — A way to somewhere safe", template: "%s | Wayfinder" },
  description: "Find shelter, explore available beds, and connect with volunteer transport. Wayfinder frontend demonstration.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Suspense fallback={<p className="container-wide py-12" role="status">Loading Wayfinder…</p>}><Shell>{children}</Shell></Suspense></body></html>;
}
