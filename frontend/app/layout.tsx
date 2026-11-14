import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ShelterConnect | A ride toward safety",
  description: "Find a shelter and request volunteer transportation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
