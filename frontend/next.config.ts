import type { NextConfig } from "next";
const pages = ["home", "find-shelter", "shelter-details", "track-ride", "become-a-driver", "driver-profile", "emergency-contacts", "shelter-registration", "submit-feedback"];
const config: NextConfig = { async redirects() { return [...pages.map(page => ({ source: `/${page}.html`, destination: page === "home" ? "/" : `/${page}`, permanent: false })), { source: "/UnhousedView.html", destination: "/find-shelter", permanent: false }]; } };
export default config;
