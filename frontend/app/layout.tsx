import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Wayfinder — A way to somewhere safe", template: "%s | Wayfinder" },
  description: "Find shelter, explore available beds, and connect with volunteer transport. Wayfinder frontend demonstration.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Shell>{children}</Shell></body></html>;
}
