"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Compass, Menu, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const links = [
  ["Find shelter", "/find-shelter"],
  ["Volunteer drivers", "/become-a-driver"],
  ["For shelters", "/shelter-registration"],
  ["Track ride", "/track-ride"],
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { data: session } = authClient.useSession();
  const driverLink: [string, string] = session ? ["Driver dashboard", "/driver-profile"] : ["Driver sign in", "/become-a-driver"];
  // Main's service portal retains its own layout and live auth workflow.
  if (path === "/access") return <>{children}</>;
  return <div className="flex min-h-screen flex-col">
    <div className="border-b border-line bg-raised px-5 py-2 text-center text-[11px] tracking-wide text-muted">Hackathon prototype · Sample shelter locations · <Link href="/become-a-driver" className="text-accent underline">Volunteer as a driver</Link></div>
    <header className="sticky top-0 z-40 border-b border-line bg-background/95 backdrop-blur-xl">
      <div className="container-wide flex h-20 items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-3" aria-label="Wayfinder home"><span className="flex size-10 items-center justify-center rounded-full border border-accent/50 text-accent"><Compass size={25} strokeWidth={1.4} /></span><span className="font-serif text-2xl tracking-tight">Wayfinder<span className="text-accent">.</span></span></Link>
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">{links.map(([label, href]) => <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className={`text-sm transition-colors hover:text-accent ${path === href ? "text-accent" : "text-muted"}`}>{label}</Link>)}</nav>
        <div className="flex items-center gap-3"><Link href={driverLink[1]} className="text-xs text-accent">{session ? "Dashboard" : "Sign in"}</Link><Link href="/find-shelter" className="btn btn-primary hidden sm:inline-flex">Find a bed <ArrowUpRight size={16} /></Link><button onClick={() => setOpen(!open)} className="rounded-full border border-line p-2.5 lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-nav">{open ? <X size={20} /> : <Menu size={20} />}</button></div>
      </div>
      {open && <nav id="mobile-nav" className="container-wide grid gap-1 border-t border-line pb-5 pt-3 lg:hidden" aria-label="Mobile navigation">{[...links, driverLink, ["Emergency contacts", "/emergency-contacts"], ["Submit feedback", "/submit-feedback"]].map(([label, href]) => <Link key={href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-3 text-sm hover:bg-raised" href={href}>{label}</Link>)}</nav>}
    </header>
    <main id="main-content" className="flex-1">{children}</main>
    <footer className="border-t border-line pt-12">
      <div className="container-wide grid gap-10 pb-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div><Link href="/" className="font-serif text-2xl">Wayfinder.</Link><p className="mt-4 max-w-xs text-sm leading-7 text-muted">A little direction. A safe place to land.<br />Connecting neighbors with shelter and a way there.</p><p className="mt-5 text-xs text-accent">Built for people. Powered by community.</p></div>
        <FooterGroup title="Find your way" links={[["Find shelter", "/find-shelter"], ["Track a ride", "/track-ride"], ["Emergency contacts", "/emergency-contacts"]]} />
        <FooterGroup title="Lend a hand" links={[["Become a driver", "/become-a-driver"], ["Driver dashboard", "/driver-profile"], ["Register a shelter", "/shelter-registration"]]} />
        <FooterGroup title="Stay connected" links={[["Share feedback", "/submit-feedback"], ["How it works", "/#how-it-works"], ["Community resources", "/emergency-contacts"]]} />
      </div><div className="container-wide flex flex-wrap justify-between gap-3 border-t border-line py-5 text-xs text-muted"><span>© 2026 Wayfinder · ShelterConnect</span><span>Prototype · Not an emergency service. In immediate danger, call 911.</span></div>
    </footer>
  </div>;
}

function FooterGroup({ title, links }: { title: string; links: string[][] }) {
  return <div><h2 className="mb-5 text-xs uppercase tracking-widest text-muted">{title}</h2><ul className="space-y-3">{links.map(([label, href]) => <li key={href}><Link className="text-sm hover:text-accent" href={href}>{label}</Link></li>)}</ul></div>;
}
